import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { z } from 'zod'
import { Card, Topic, Subject } from '../types'
import { SUBJECT_MAP, REVERSE_SUBJECT_MAP } from '../lib/subjectColors'
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
    hasTosColumn = null
    cachedGauntletTablesExist = null
    invalidateTopicsCache()
  }
}

let hasTosColumn: boolean | null = null
let cachedGauntletTablesExist: boolean | null = null

async function checkTosColumnExists(): Promise<boolean> {
  if (hasTosColumn !== null) return hasTosColumn
  try {
    const columns = await executeQuery<{ name: string }>('PRAGMA table_info(cards);')
    hasTosColumn = columns.some((col) => col.name === 'tos_topic_id')
    return hasTosColumn
  } catch {
    return false
  }
}

async function checkGauntletTablesExist(): Promise<boolean> {
  if (cachedGauntletTablesExist !== null) return cachedGauntletTablesExist
  try {
    const rows = await executeQuery<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('gauntlet_flagged_cards', 'gauntlet_allowed_cards');"
    )
    cachedGauntletTablesExist = rows.length === 2
    return cachedGauntletTablesExist
  } catch {
    return false
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
  tos_topic_id: z.string().nullable().optional(),
  is_custom: z.union([z.boolean(), z.number()]).optional(),
  created_at: z.union([z.number(), z.string()]).optional(),
  deck_name: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
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
    tosTopicId: row.tos_topic_id ?? null,
    isCustom: Boolean(row.is_custom),
    createdAt: row.created_at != null ? String(row.created_at) : '',
    easeFactor: row.ease_factor ?? undefined,
    repetitions: row.repetitions ?? undefined,
    interval: row.interval ?? undefined,
    correct_count: row.correct_count ?? undefined,
    total_count: row.total_count ?? undefined,
    last_result: row.last_result ?? null,
    deckName: row.deck_name ?? undefined,
    subject: row.subject ? ((SUBJECT_MAP[row.subject] || row.subject) as Card['subject']) : undefined,
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

/**
 * Card data fields that can hold an image filename across all card types.
 */
const IMAGE_DATA_KEYS = [
  'image',
  'imagePath',
  'imageFront',
  'imageBack',
  'imagePathFront',
  'solutionImagePath',
  'explanationImagePath',
] as const

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
    const tosCol = (await checkTosColumnExists()) ? 'c.tos_topic_id' : 'NULL as tos_topic_id'
    const sql = `
      SELECT 
        c.id, c.topic_id, c.type, c.data, c.difficulty, c.tags, ${tosCol}, c.is_custom, c.order_index, c.created_at,
        p.ease_factor, p.interval, p.repetitions, p.next_review, p.last_reviewed, p.correct_count, p.total_count, p.last_result
      FROM cards c
      LEFT JOIN progress p ON c.id = p.card_id
      WHERE c.topic_id = ?
      ORDER BY c.order_index ASC, c.created_at ASC
    `
    const rows = await executeQuery(sql, [topicId])
    return z.array(CardWithProgressRowSchema).parse(rows).map(row => parseCardRow(row, topicId))
  },

  /**
   * Fetch cards (optionally filtered by topic), joined with SM-2 progress details.
   */
  getCards: async (topicId?: string): Promise<Card[]> => {
    const tosCol = (await checkTosColumnExists()) ? 'c.tos_topic_id' : 'NULL as tos_topic_id'
    let sql: string
    let params: unknown[] = []

    if (topicId) {
      sql = `
        SELECT 
          c.id, c.topic_id, c.type, c.data, c.difficulty, c.tags, ${tosCol}, c.is_custom, c.order_index, c.created_at,
          p.ease_factor, p.interval, p.repetitions, p.next_review, p.last_reviewed, p.correct_count, p.total_count, p.last_result
        FROM cards c
        LEFT JOIN progress p ON c.id = p.card_id
        WHERE c.topic_id = ?
        ORDER BY c.order_index ASC, c.created_at ASC
      `
      params = [topicId]
    } else {
      sql = `
        SELECT 
          c.id, c.topic_id, c.type, c.data, c.difficulty, c.tags, ${tosCol}, c.is_custom, c.order_index, c.created_at,
          p.ease_factor, p.interval, p.repetitions, p.next_review, p.last_reviewed, p.correct_count, p.total_count, p.last_result
        FROM cards c
        LEFT JOIN progress p ON c.id = p.card_id
        ORDER BY c.order_index ASC, c.created_at ASC
      `
    }

    const rows = await executeQuery(sql, params)
    return z.array(CardWithProgressRowSchema).parse(rows).map(row => parseCardRow(row, topicId))
  },

  /**
   * Fetch all cards for a specific topic without progress join, ordered by order_index.
   */
  getAllCardsByTopic: async (topicId: string): Promise<Card[]> => {
    const tosCol = (await checkTosColumnExists()) ? 'c.tos_topic_id' : 'NULL as tos_topic_id'
    const sql = `
      SELECT 
        id, topic_id, type, data, difficulty, tags, ${tosCol}, is_custom, order_index, created_at
      FROM cards
      WHERE topic_id = ?
      ORDER BY order_index ASC, created_at ASC
    `
    const rows = await executeQuery(sql, [topicId])
    return z.array(CardRowSchema).parse(rows).map(row => parseCardRow(row, topicId))
  },

  /**
   * Desktop port: exclude calculation and problem-solving questions in Gauntlet mode.
   * 1. Cards with a solution image containing numbers/math.
   * 2. Questions where choices are predominantly numerical / measurements.
   * 3. Calculation stems ("Calculate...", "Determine...", "Compute...", "Find the...") with numeric choices.
   * Concept questions (definitions, principles, theorems, and pure concept diagrams) remain playable.
   */
  getGauntletCards: async (subjectsInput: Subject[] | Subject | 'ALL' = 'ALL'): Promise<Card[]> => {
    const tosCol = (await checkTosColumnExists()) ? 'c.tos_topic_id' : 'NULL as tos_topic_id'
    const hasGauntletTables = await checkGauntletTablesExist()
    const allowedOverride = hasGauntletTables
      ? 'OR (c.id IN (SELECT card_id FROM gauntlet_allowed_cards))'
      : ''
    const flaggedFilter = hasGauntletTables
      ? 'AND (c.id NOT IN (SELECT card_id FROM gauntlet_flagged_cards))'
      : ''

    const notProblemSolving = `(
      NOT (
        (json_extract(c.data, '$.solutionImagePath') IS NOT NULL AND json_extract(c.data, '$.solutionImagePath') != '' AND json_extract(c.data, '$.choices') GLOB '*[0-9]*')
        OR
        (
          (
            json_extract(c.data, '$.choices[0]') GLOB '[0-9]*'
            OR json_extract(c.data, '$.choices[0]') GLOB '[-+.]*'
            OR json_extract(c.data, '$.choices[0]') GLOB '([0-9]*'
            OR json_extract(c.data, '$.choices[0]') GLOB '$*'
          )
          AND (
            json_extract(c.data, '$.choices[1]') GLOB '[0-9]*'
            OR json_extract(c.data, '$.choices[1]') GLOB '[-+.]*'
            OR json_extract(c.data, '$.choices[1]') GLOB '([0-9]*'
            OR json_extract(c.data, '$.choices[1]') GLOB '$*'
          )
        )
        OR
        (
          json_extract(c.data, '$.choices') GLOB '*[0-9]*'
          AND (
            json_extract(c.data, '$.question') LIKE 'Calculate %'
            OR json_extract(c.data, '$.question') LIKE 'Determine %'
            OR json_extract(c.data, '$.question') LIKE 'Compute %'
            OR json_extract(c.data, '$.question') LIKE 'Find the %'
          )
        )
      )
    )`

    const validMcq = `(json_type(c.data, '$.choices') = 'array' AND json_array_length(c.data, '$.choices') >= 2)`
    const conceptClause = `((${notProblemSolving} ${allowedOverride}) AND ${validMcq} ${flaggedFilter})`

    let sql: string
    let params: unknown[] = []

    const subjects: Subject[] = Array.isArray(subjectsInput)
      ? subjectsInput
      : (subjectsInput === 'ALL' ? ['MATH', 'GEAS', 'ELECS', 'EST'] : [subjectsInput])

    if (subjects.length > 0 && subjects.length < 4) {
      const allowedNames: string[] = []
      for (const s of subjects) {
        allowedNames.push(s)
        if (REVERSE_SUBJECT_MAP[s]) {
          allowedNames.push(REVERSE_SUBJECT_MAP[s])
        }
      }
      const placeholders = allowedNames.map(() => '?').join(', ')
      sql = `
        SELECT 
          c.id, c.topic_id, c.type, c.data, c.difficulty, c.tags, ${tosCol}, c.is_custom, c.order_index, c.created_at,
          t.name as deck_name, t.subject as subject
        FROM cards c
        JOIN topics t ON c.topic_id = t.id
        WHERE c.type = 'mcq' AND t.subject IN (${placeholders}) AND ${conceptClause}
        ORDER BY RANDOM()
      `
      params = allowedNames
    } else {
      sql = `
        SELECT 
          c.id, c.topic_id, c.type, c.data, c.difficulty, c.tags, ${tosCol}, c.is_custom, c.order_index, c.created_at,
          t.name as deck_name, t.subject as subject
        FROM cards c
        JOIN topics t ON c.topic_id = t.id
        WHERE c.type = 'mcq' AND ${conceptClause}
        ORDER BY RANDOM()
      `
    }

    const rows = await executeQuery(sql, params)
    return z.array(CardRowSchema).parse(rows).map(row => parseCardRow(row))
  },

  /**
   * Fetch available MCQ card counts per subject for Gauntlet setup buttons (concept-only).
   */
  getGauntletPoolSizes: async (): Promise<Record<Subject, number>> => {
    const hasGauntletTables = await checkGauntletTablesExist()
    const allowedOverride = hasGauntletTables
      ? 'OR (c.id IN (SELECT card_id FROM gauntlet_allowed_cards))'
      : ''
    const flaggedFilter = hasGauntletTables
      ? 'AND (c.id NOT IN (SELECT card_id FROM gauntlet_flagged_cards))'
      : ''

    const notProblemSolving = `(
      NOT (
        (json_extract(c.data, '$.solutionImagePath') IS NOT NULL AND json_extract(c.data, '$.solutionImagePath') != '' AND json_extract(c.data, '$.choices') GLOB '*[0-9]*')
        OR
        (
          (
            json_extract(c.data, '$.choices[0]') GLOB '[0-9]*'
            OR json_extract(c.data, '$.choices[0]') GLOB '[-+.]*'
            OR json_extract(c.data, '$.choices[0]') GLOB '([0-9]*'
            OR json_extract(c.data, '$.choices[0]') GLOB '$*'
          )
          AND (
            json_extract(c.data, '$.choices[1]') GLOB '[0-9]*'
            OR json_extract(c.data, '$.choices[1]') GLOB '[-+.]*'
            OR json_extract(c.data, '$.choices[1]') GLOB '([0-9]*'
            OR json_extract(c.data, '$.choices[1]') GLOB '$*'
          )
        )
        OR
        (
          json_extract(c.data, '$.choices') GLOB '*[0-9]*'
          AND (
            json_extract(c.data, '$.question') LIKE 'Calculate %'
            OR json_extract(c.data, '$.question') LIKE 'Determine %'
            OR json_extract(c.data, '$.question') LIKE 'Compute %'
            OR json_extract(c.data, '$.question') LIKE 'Find the %'
          )
        )
      )
    )`

    const validMcq = `(json_type(c.data, '$.choices') = 'array' AND json_array_length(c.data, '$.choices') >= 2)`
    const conceptClause = `((${notProblemSolving} ${allowedOverride}) AND ${validMcq} ${flaggedFilter})`

    const sql = `
      SELECT t.subject, COUNT(c.id) as count
      FROM cards c
      JOIN topics t ON c.topic_id = t.id
      WHERE c.type = 'mcq' AND ${conceptClause}
      GROUP BY t.subject
    `
    const rows = await executeQuery<{ subject: string; count: number }>(sql)
    const result: Record<Subject, number> = {
      MATH: 0,
      GEAS: 0,
      ELECS: 0,
      EST: 0,
    }
    for (const row of rows) {
      const code = (SUBJECT_MAP[row.subject] || row.subject) as Subject
      if (result[code] !== undefined) {
        result[code] += row.count
      }
    }
    return result
  },

  /**
   * Retrieves all image filenames referenced in card payloads along with their cardId.
   */
  getImageReferences: async (): Promise<{ cardId: string; filename: string }[]> => {
    const rows = await executeQuery<{ id: string; data: string }>('SELECT id, data FROM cards')
    const references: { cardId: string; filename: string }[] = []

    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.data)
        if (parsed && typeof parsed === 'object') {
          for (const key of IMAGE_DATA_KEYS) {
            const val = (parsed as Record<string, unknown>)[key]
            if (typeof val === 'string' && val.trim() !== '') {
              references.push({ cardId: row.id, filename: val.trim() })
            }
          }
        }
      } catch {
        // Skip corrupt rows silently
      }
    }

    return references
  },
}
