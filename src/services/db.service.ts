import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { z } from 'zod'
import { Card, Topic } from '../types'
import { DB_PRIVATE_FILENAME } from '../config/app-config'

// ── Database Connection State ────────────────────────────────────────────────

const sqlite = new SQLiteConnection(CapacitorSQLite)
let db: SQLiteDBConnection | null = null
let currentDbPath: string | null = null
let cachedTopicsWithCardCounts: TopicWithCardCount[] | null = null

/**
 * Invalidates the in-memory cache for topics with card counts.
 */
export function invalidateTopicsCache(): void {
  cachedTopicsWithCardCounts = null
}


/**
 * Checks if a previously imported database exists in private storage and returns
 * its absolute path if so, or null if it doesn't exist.
 */
export async function getPreviouslyImportedDbPath(): Promise<string | null> {
  try {
    const stat = await Filesystem.stat({ path: DB_PRIVATE_FILENAME, directory: Directory.Data })
    if (!stat) return null
    const uriResult = await Filesystem.getUri({ path: DB_PRIVATE_FILENAME, directory: Directory.Data })
    const uri = uriResult.uri
    return uri.startsWith('file://') ? uri.slice(7) : uri
  } catch {
    // Filesystem.stat throws if the file doesn't exist — treat as "no prior import"
    return null
  }
}

/**
 * Opens a SQLite database at the given file path or database name in read-only mode.
 */
export async function openDatabase(filePath: string): Promise<void> {
  if (db) {
    await closeDatabase()
  } else {
    invalidateTopicsCache()
  }

  // Non-conformed database paths (containing slashes) are opened via createNCConnection
  // which defaults to read-only mode in the plugin. Standard conformed DB names use createConnection.
  const isNC = filePath.includes('/') || filePath.includes('\\')
  if (isNC) {
    db = await sqlite.createNCConnection(filePath, 1)
  } else {
    const dbName = filePath.endsWith('.db') ? filePath.slice(0, -3) : filePath
    db = await sqlite.createConnection(dbName, false, 'no-encryption', 1, true)
  }

  currentDbPath = filePath
  await db.open()
}

/**
 * Closes the active database connection and releases plugin resources.
 */
export async function closeDatabase(): Promise<void> {
  if (!db) return

  try {
    const isOpenRes = await db.isDBOpen()
    if (isOpenRes.result) {
      await db.close()
    }
    if (currentDbPath) {
      const isNC = currentDbPath.includes('/') || currentDbPath.includes('\\')
      if (isNC) {
        await sqlite.closeNCConnection(currentDbPath)
      } else {
        const dbName = currentDbPath.endsWith('.db') ? currentDbPath.slice(0, -3) : currentDbPath
        await sqlite.closeConnection(dbName, true)
      }
    }
  } catch (err) {
    console.warn('[db] Error closing database connection:', err)
  } finally {
    db = null
    currentDbPath = null
    invalidateTopicsCache()
  }
}

/**
 * Helper to get the active SQLite connection or throw if not opened.
 */
function getDb(): SQLiteDBConnection {
  if (!db) {
    throw new Error('Database is not open. Call openDatabase(filePath) first.')
  }
  return db
}

/**
 * Execute a read-only query against the active SQLite connection.
 */
async function executeQuery<T = unknown>(statement: string, values: unknown[] = []): Promise<T[]> {
  const connection = getDb()
  const result = await connection.query(statement, values)
  return (result.values || []) as T[]
}

// ── Zod Row Schemas ──────────────────────────────────────────────────────────

const CardRowSchema = z.object({
  id: z.string(),
  topic_id: z.string(),
  type: z.enum(['flashcard', 'mcq', 'formula', 'concept']),
  data: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable().optional(),
  tags: z.string().nullable().optional(),
  is_custom: z.union([z.boolean(), z.number()]).optional(),
  created_at: z.union([z.number(), z.string()]).optional(),
})

const CardWithProgressRowSchema = CardRowSchema.extend({
  ease_factor: z.number().nullable().optional(),
  interval: z.number().nullable().optional(),
  repetitions: z.number().nullable().optional(),
  next_review: z.string().nullable().optional(),
  last_reviewed: z.string().nullable().optional(),
  correct_count: z.number().nullable().optional(),
  total_count: z.number().nullable().optional(),
  last_result: z.string().nullable().optional(),
})

const FolderRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  parent_id: z.string().nullable().optional(),
  order_index: z.number().nullable().optional(),
})

const TopicWithCountRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  subject: z.string(),
  description: z.string().nullable().optional(),
  created_at: z.union([z.number(), z.string()]).nullable().optional(),
  tags: z.string().nullable().optional(),
  folder_name: z.string().nullable().optional(),
  folder_id: z.string().nullable().optional(),
  order_index: z.number().nullable().optional(),
  card_count: z.number().nullable().optional(),
  types: z.string().nullable().optional(),
  is_favorite: z.union([z.boolean(), z.number()]).nullable().optional(),
})

// ── Types ───────────────────────────────────────────────────────────────────

export interface Folder {
  id: string
  name: string
  parentId: string | null
  orderIndex: number
}

export interface TopicWithCardCount extends Topic {
  cardCount: number
  folderName?: string | null
  folderId?: string | null
  types: string
}

// ── Row Parsers ─────────────────────────────────────────────────────────────

function parseCardRow(row: z.infer<typeof CardWithProgressRowSchema>, topicId?: string): Card {
  let data: unknown = {}
  let tags: string[] = []

  try {
    data = JSON.parse(row.data)
  } catch {
    console.warn(`[db] Corrupt JSON in card.data for card id="${row.id}" — using empty object`)
  }

  try {
    tags = JSON.parse(row.tags || '[]')
  } catch {
    console.warn(`[db] Corrupt JSON in card.tags for card id="${row.id}" — using empty array`)
  }

  return {
    id: row.id,
    topicId: topicId ?? row.topic_id,
    type: row.type as Card['type'],
    data: data as Card['data'],
    difficulty: (row.difficulty ?? undefined) as Card['difficulty'],
    tags,
    isCustom: Boolean(row.is_custom),
    createdAt: row.created_at != null ? String(row.created_at) : '',
    easeFactor: row.ease_factor ?? undefined,
    repetitions: row.repetitions ?? undefined,
    interval: row.interval ?? undefined,
    correct_count: row.correct_count ?? undefined,
    total_count: row.total_count ?? undefined,
    last_result: row.last_result ?? null,
  }
}

function parseTopicRow(row: z.infer<typeof TopicWithCountRowSchema>): TopicWithCardCount {
  let tags: string[] = []

  if (row.tags) {
    try {
      tags = JSON.parse(row.tags)
    } catch {
      console.warn(`[db] Corrupt JSON in topic.tags for topic id="${row.id}" — using empty array`)
    }
  }

  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    description: row.description ?? undefined,
    parentId: null,
    orderIndex: row.order_index ?? 0,
    tags,
    createdAt: row.created_at != null ? Number(row.created_at) : undefined,
    cardCount: row.card_count ?? 0,
    folderName: row.folder_name ?? null,
    folderId: row.folder_id ?? null,
    types: row.types || '',
    isFavorite: Boolean(row.is_favorite),
  }
}

function parseFolderRow(row: z.infer<typeof FolderRowSchema>): Folder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id ?? null,
    orderIndex: row.order_index ?? 0,
  }
}

// ── Service Implementation ──────────────────────────────────────────────────

export const dbService = {
  /**
   * Fetch all folders for a given scope ('study' | 'formula').
   */
  getFolders: async (scope: 'study' | 'formula'): Promise<Folder[]> => {
    const sql = `
      SELECT id, name, parent_id, order_index
      FROM folders
      WHERE scope = ?
      ORDER BY order_index, name
    `
    const rows = await executeQuery(sql, [scope])
    return z.array(FolderRowSchema).parse(rows).map(parseFolderRow)
  },

  /**
   * Fetch all topics joined with their card counts and card types list.
   * Matches desktop query: GROUP BY t.id ORDER BY t.name
   */
  getTopicsWithCardCounts: async (forceRefresh = false): Promise<TopicWithCardCount[]> => {
    if (!forceRefresh && cachedTopicsWithCardCounts) {
      return cachedTopicsWithCardCounts
    }

    // Defensively check if 'is_favorite' column exists on 'topics' table to remain backward-compatible
    let isFavoriteColumnSelect = '0 as is_favorite'
    try {
      const columns = await executeQuery<{ name: string }>('PRAGMA table_info(topics);')
      if (columns.some((col) => col.name === 'is_favorite')) {
        isFavoriteColumnSelect = 't.is_favorite'
      }
    } catch {
      // Fallback to 0 if pragma fails
    }

    const sql = `
      SELECT t.id, t.name, t.subject, t.description, t.created_at, t.tags, t.folder_name, t.folder_id, t.order_index, ${isFavoriteColumnSelect},
             COUNT(c.id) as card_count,
             GROUP_CONCAT(DISTINCT c.type) as types
      FROM topics t LEFT JOIN cards c ON c.topic_id = t.id
      GROUP BY t.id ORDER BY t.name
    `
    const rows = await executeQuery(sql)
    const parsed = z.array(TopicWithCountRowSchema).parse(rows).map(parseTopicRow)
    cachedTopicsWithCardCounts = parsed
    return parsed
  },

  /**
   * Fetch cards for a specific topic, joined with SM-2 progress details.
   */
  getCardsWithProgress: async (topicId: string): Promise<Card[]> => {
    const sql = `
      SELECT 
        c.id, c.topic_id, c.type, c.data, c.difficulty, c.tags, c.is_custom, c.order_index, c.created_at,
        p.ease_factor, p.interval, p.repetitions, p.next_review, p.last_reviewed, p.correct_count, p.total_count, p.last_result
      FROM cards c
      LEFT JOIN progress p ON c.id = p.card_id
      WHERE c.topic_id = ?
      ORDER BY c.order_index ASC
    `
    const rows = await executeQuery(sql, [topicId])
    return z.array(CardWithProgressRowSchema).parse(rows).map(row => parseCardRow(row, topicId))
  },

  /**
   * Fetch cards (optionally filtered by topic), joined with SM-2 progress details.
   */
  getCards: async (topicId?: string): Promise<Card[]> => {
    let sql: string
    let params: unknown[] = []

    if (topicId) {
      sql = `
        SELECT 
          c.id, c.topic_id, c.type, c.data, c.difficulty, c.tags, c.is_custom, c.order_index, c.created_at,
          p.ease_factor, p.interval, p.repetitions, p.next_review, p.last_reviewed, p.correct_count, p.total_count, p.last_result
        FROM cards c
        LEFT JOIN progress p ON c.id = p.card_id
        WHERE c.topic_id = ?
        ORDER BY c.order_index ASC
      `
      params = [topicId]
    } else {
      sql = `
        SELECT 
          c.id, c.topic_id, c.type, c.data, c.difficulty, c.tags, c.is_custom, c.order_index, c.created_at,
          p.ease_factor, p.interval, p.repetitions, p.next_review, p.last_reviewed, p.correct_count, p.total_count, p.last_result
        FROM cards c
        LEFT JOIN progress p ON c.id = p.card_id
        ORDER BY c.order_index ASC
      `
    }

    const rows = await executeQuery(sql, params)
    return z.array(CardWithProgressRowSchema).parse(rows).map(row => parseCardRow(row, topicId))
  },

  /**
   * Fetch all cards for a specific topic without progress join, ordered by order_index.
   */
  getAllCardsByTopic: async (topicId: string): Promise<Card[]> => {
    const sql = `
      SELECT 
        id, topic_id, type, data, difficulty, tags, is_custom, order_index, created_at
      FROM cards
      WHERE topic_id = ?
      ORDER BY order_index ASC
    `
    const rows = await executeQuery(sql, [topicId])
    return z.array(CardRowSchema).parse(rows).map(row => parseCardRow(row, topicId))
  },
}
