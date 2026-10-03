import { useState, useEffect, useMemo, useRef, memo, useCallback, startTransition } from 'react'
import {
  Search,
  X,
  Layers,
  AlertCircle,
  RefreshCw,
  GraduationCap,
  Sigma,
  Settings as SettingsIcon,
  Play,
  ClipboardList,
  FileText,
  Folder as FolderIcon,
  ArrowUpDown,
  Check,
  Star,
  Swords,
} from 'lucide-react'
import { GauntletArcadeHome } from '../components/gauntlet/GauntletArcadeHome'
import type { GauntletArcadeConfig } from '../lib/gauntlet'
import { getFavoriteOverrides, isTopicFavorite, toggleTopicFavorite, FavoriteOverrides } from '../services/favorites.service'
import { openDatabase, dbService, TopicWithCardCount, getPreviouslyImportedDbPath, Folder } from '../services/db.service'
import { importDatabaseFile, UserCancelledError } from '../services/import.service'
import { getSubjectBadgeClasses, getSubjectFilterClasses, SUBJECT_MAP } from '../lib/subjectColors'
import { LearnSettingsModal, LearnSettings, DEFAULT_LEARN_SETTINGS } from '../components/LearnSettingsModal'
import { TestSettingsModal, DEFAULT_TEST_SETTINGS } from '../components/TestSettingsModal'
import { FlashcardSettingsModal, FlashcardSettings, DEFAULT_FLASHCARD_SETTINGS } from '../components/FlashcardSettingsModal'
import { FolderDrawer } from '../components/FolderDrawer'
import type { TestSettings } from '../pages/TestMode'
import appIcon from '../assets/images/ecengine-icon.png'

export type BrowserMode = 'looksfam' | 'test' | 'testpaper' | 'flashcards' | 'formulas' | 'gauntlet'
export type DeckType = 'mcq' | 'flashcard' | 'formula' | 'mixed' | null

/**
 * Classifies a topic into a deckType based on its comma-separated types string.
 */
function getTopicDeckType(typesStr?: string | null): DeckType {
  if (!typesStr) return null
  const typeList = typesStr
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)

  if (typeList.includes('mcq') && typeList.includes('flashcard')) {
    return 'mixed'
  }
  if (typeList.includes('flashcard')) {
    return 'flashcard'
  }
  if (typeList.includes('mcq')) {
    return 'mcq'
  }
  if (typeList.length === 1 && typeList[0] === 'formula') {
    return 'formula'
  }
  return null
}

/**
 * Format type key to friendly display label.
 */
function formatTypeChip(type: string): string {
  switch (type.toLowerCase()) {
    case 'mcq':
      return 'MCQ'
    case 'flashcard':
      return 'Flashcard'
    case 'formula':
      return 'Formula'
    case 'concept':
      return 'Concept'
    default:
      return type.toUpperCase()
  }
}

const SUBJECT_ORDER = ['MATH', 'GEAS', 'ELECS', 'EST']

type SortMode = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'date-desc', label: 'Newest First' },
  { value: 'date-asc', label: 'Oldest First' },
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
]

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasWholeWord(text: string, term: string): boolean {
  if (!text || !term) return false
  const escaped = escapeRegExp(term)
  return new RegExp(`(?<=[^a-zA-Z0-9]|^)${escaped}(?=[^a-zA-Z0-9]|$)`, 'i').test(text)
}

function hasWordPrefix(text: string, term: string): boolean {
  if (!text || !term) return false
  const escaped = escapeRegExp(term)
  return new RegExp(`(?<=[^a-zA-Z0-9]|^)${escaped}`, 'i').test(text)
}

/**
 * Calculates a search relevance score for a topic against fullQuery and terms.
 * Enforces word boundaries: will NOT match arbitrary substrings in the middle of words
 * (e.g. 'ECT' will match 'ECT', 'ECTs', or '... for ECT exam', but NOT 'SECTION' or 'ELECTRONIC').
 */
function calculateTopicScore(
  topic: TopicWithCardCount,
  fullQuery: string,
  terms: string[]
): { score: number; isFullMatch: boolean; partialMatch: boolean } {
  const name = topic.name || ''
  const desc = topic.description || ''
  const subject = topic.subject || ''
  const tags = (topic.tags || []).join(' ')

  const nameLower = name.toLowerCase()
  const descLower = desc.toLowerCase()
  const q = fullQuery.toLowerCase()

  let score = 0
  let isFullMatch = false
  let partialMatch = false

  // ─── 1. Exact & Phrase Matching at Word Boundaries ───────────
  if (nameLower === q) {
    score += 3000 // Exact name match is highest possible
    isFullMatch = true
  } else if (nameLower.startsWith(q)) {
    score += 2000 // Name starts with entire query
    isFullMatch = true
  } else if (hasWholeWord(name, q)) {
    score += 1500 // Full query appears as standalone whole word in name
    isFullMatch = true
  } else if (hasWordPrefix(name, q)) {
    score += 1000 // A word in name starts with entire query
    isFullMatch = true
  }

  // Exact & Phrase match in description (word-boundary only)
  if (descLower === q) {
    score += 2500 // Description is exact match
    isFullMatch = true
  } else if (descLower.startsWith(q)) {
    score += 1600 // Description starts with entire query
    isFullMatch = true
  } else if (hasWholeWord(desc, q)) {
    score += 1300 // Full query appears as whole word in description
    isFullMatch = true
  } else if (hasWordPrefix(desc, q)) {
    score += 800 // A word in description starts with entire query
    isFullMatch = true
  }

  // Subject and tags whole word / prefix match
  if (hasWholeWord(subject, q)) {
    score += 500
    isFullMatch = true
  } else if (hasWordPrefix(subject, q)) {
    score += 300
    isFullMatch = true
  }

  if (hasWholeWord(tags, q)) {
    score += 400
    isFullMatch = true
  } else if (hasWordPrefix(tags, q)) {
    score += 250
    isFullMatch = true
  }

  // ─── 2. Multi-term Token Scoring (Word Boundaries Only) ─────
  if (terms.length > 1) {
    let termsMatchedCount = 0
    let allInName = true
    let allInDesc = true

    for (const term of terms) {
      let termMatchedInTopic = false

      // Check name (word-boundary only)
      if (hasWholeWord(name, term)) {
        termMatchedInTopic = true
        score += 200
      } else if (hasWordPrefix(name, term)) {
        termMatchedInTopic = true
        score += 120
      } else {
        allInName = false
      }

      // Check description (word-boundary only)
      if (hasWholeWord(desc, term)) {
        termMatchedInTopic = true
        score += 180
      } else if (hasWordPrefix(desc, term)) {
        termMatchedInTopic = true
        score += 100
      } else {
        allInDesc = false
      }

      // Check subject & tags
      if (!termMatchedInTopic && (hasWholeWord(subject, term) || hasWordPrefix(subject, term))) {
        termMatchedInTopic = true
        score += 60
      }
      if (!termMatchedInTopic && (hasWholeWord(tags, term) || hasWordPrefix(tags, term))) {
        termMatchedInTopic = true
        score += 50
      }

      if (termMatchedInTopic) {
        termsMatchedCount++
      }
    }

    if (termsMatchedCount === terms.length) {
      isFullMatch = true
      score += 700 // Heavy bonus for matching all query terms
      if (allInName) score += 400 // All terms in title
      if (allInDesc) score += 300 // All terms in description
    } else if (termsMatchedCount > 0) {
      partialMatch = true
      score += termsMatchedCount * 80
    }
  } else if (terms.length === 1) {
    const singleTerm = terms[0]
    // For single term, must match at a word boundary
    if (
      hasWordPrefix(name, singleTerm) ||
      hasWordPrefix(desc, singleTerm) ||
      hasWordPrefix(subject, singleTerm) ||
      hasWordPrefix(tags, singleTerm)
    ) {
      isFullMatch = true
    }
  }

  // ─── 3. Specificity / Length Ratio Bonus ───────────────────
  if (isFullMatch) {
    if (nameLower.startsWith(q) || hasWholeWord(name, q)) {
      score += Math.round((q.length / Math.max(name.length, 1)) * 120)
    }
    if (descLower.startsWith(q) || hasWholeWord(desc, q)) {
      score += Math.round((q.length / Math.max(desc.length, 1)) * 80)
    }
  }

  return { score, isFullMatch, partialMatch }
}

/**
 * Highlights matching search words within text using the neon green theme.
 * Only highlights matches starting at word boundaries so words like 'section' or 'electronic'
 * are not falsely chopped up when searching for 'ect'.
 */
const HighlightText = memo(function HighlightText({
  text,
  query,
}: {
  text: string
  query: string
}) {
  const q = query.trim()
  if (!q || !text) return <>{text}</>

  const terms = Array.from(new Set(q.split(/\s+/).filter(Boolean)))
  if (terms.length === 0) return <>{text}</>

  // Sort terms by length descending so longer sequences match first
  terms.sort((a, b) => b.length - a.length)

  // Ensure highlight only matches at word boundaries
  const pattern = new RegExp(
    `(?<=[^a-zA-Z0-9]|^)(${terms.map(escapeRegExp).join('|')})`,
    'gi'
  )
  const parts = text.split(pattern)

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = terms.some((t) => t.toLowerCase() === part.toLowerCase())
        return isMatch ? (
          <mark
            key={i}
            className="text-[#00ff41] bg-[#00ff41]/20 rounded px-0.5 not-italic font-semibold"
          >
            {part}
          </mark>
        ) : (
          part
        )
      })}
    </>
  )
})

const TOPICS_BATCH_SIZE = 24

interface TopicCardProps {
  topic: TopicWithCardCount
  mode: BrowserMode
  searchQuery: string
  isFavorite: boolean
  onToggleFavorite: (e: React.MouseEvent, topic: TopicWithCardCount) => void
  onOpenLearn: (topic: TopicWithCardCount) => void
  onOpenTest: (topic: TopicWithCardCount) => void
  onOpenFlashcard: (topic: TopicWithCardCount) => void
  onView: (topic: TopicWithCardCount) => void
}

const TopicCard = memo(function TopicCard({
  topic,
  mode,
  searchQuery,
  isFavorite,
  onToggleFavorite,
  onOpenLearn,
  onOpenTest,
  onOpenFlashcard,
  onView,
}: TopicCardProps) {
  const parsedTypes = useMemo(() => {
    return topic.types
      ? topic.types
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : []
  }, [topic.types])

  const badgeClasses = getSubjectBadgeClasses(topic.subject || 'ALL')

  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-neutral-800 bg-neutral-900/80 p-4 transition-all duration-200 hover:border-neutral-700 hover:bg-neutral-900 shadow-sm">
      {/* Top Section: Topic Name & Stats */}
      <div>
        {/* Row 1: Topic Name (Left) + Subject Badge (Right) */}
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold leading-snug tracking-tight text-neutral-100 uppercase group-hover:text-[#00ff41] transition-colors line-clamp-2 flex-1 min-w-0">
            <HighlightText text={topic.name} query={searchQuery} />
          </h2>
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border shrink-0 ${badgeClasses}`}
          >
            {topic.subject || 'OTHER'}
          </span>
        </div>

        {/* Row 2: Type & Tag Chips (Left) + Card Count (Right) */}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {parsedTypes.map((type) => (
              <span
                key={type}
                className="rounded bg-neutral-950 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-neutral-300 border border-neutral-800"
              >
                {formatTypeChip(type)}
              </span>
            ))}

            {/* Render custom tags if available (capped at 2 for mobile compactness) */}
            {topic.tags &&
              topic.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-neutral-950 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-neutral-300 border border-neutral-800"
                >
                  {tag}
                </span>
              ))}
          </div>

          <span className="text-[11px] font-mono font-medium text-neutral-400 bg-neutral-950/60 px-2 py-0.5 rounded border border-neutral-800 shrink-0 ml-auto">
            {topic.cardCount} {topic.cardCount === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Description if present */}
        {topic.description && topic.description.trim() !== '' && (
          <p className={`mt-1.5 text-xs text-neutral-400 leading-relaxed ${searchQuery ? 'line-clamp-3' : 'line-clamp-2'}`}>
            <HighlightText text={topic.description} query={searchQuery} />
          </p>
        )}
      </div>

      {/* Bottom Row: Action Buttons — only shown in looksfam mode */}
      {mode === 'looksfam' && (
        <div className="mt-3.5 flex items-center justify-between gap-2 pt-2.5 border-t border-neutral-800/60">
          <button
            type="button"
            onClick={(e) => onToggleFavorite(e, topic)}
            className={`p-1.5 rounded-md transition-all active:scale-90 ${
              isFavorite ? 'text-[#00ff41]' : 'text-neutral-600 hover:text-neutral-400'
            }`}
            title="Toggle Favorite"
          >
            <Star size={16} className={isFavorite ? 'fill-[#00ff41]' : ''} />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenLearn(topic)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold uppercase tracking-wider text-neutral-100 hover:bg-neutral-800 hover:text-white hover:border-neutral-600 active:scale-95 transition-all"
            >
              <Play size={13} className="fill-current" />
              Learn
            </button>
            <button
              type="button"
              onClick={() => onOpenTest(topic)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold uppercase tracking-wider text-neutral-100 hover:bg-neutral-800 hover:text-white hover:border-neutral-600 active:scale-95 transition-all"
            >
              <ClipboardList size={13} />
              Test
            </button>
            <button
              type="button"
              onClick={() => onView(topic)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold uppercase tracking-wider text-neutral-100 hover:bg-neutral-800 hover:text-white hover:border-neutral-600 active:scale-95 transition-all"
            >
              <FileText size={13} />
              VIEW
            </button>
          </div>
        </div>
      )}

      {/* Bottom Row: Action Buttons — shown in flashcards and formulas modes */}
      {(mode === 'flashcards' || mode === 'formulas') && (
        <div className="mt-3.5 flex items-center justify-between gap-2 pt-2.5 border-t border-neutral-800/60">
          <button
            type="button"
            onClick={(e) => onToggleFavorite(e, topic)}
            className={`p-1.5 rounded-md transition-all active:scale-90 ${
              isFavorite ? 'text-[#00ff41]' : 'text-neutral-600 hover:text-neutral-400'
            }`}
            title="Toggle Favorite"
          >
            <Star size={16} className={isFavorite ? 'fill-[#00ff41]' : ''} />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenFlashcard(topic)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold uppercase tracking-wider text-neutral-100 hover:bg-neutral-800 hover:text-white hover:border-neutral-600 active:scale-95 transition-all"
            >
              <Play size={13} className="fill-current" />
              Learn
            </button>
            <button
              type="button"
              onClick={() => onView(topic)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold uppercase tracking-wider text-neutral-100 hover:bg-neutral-800 hover:text-white hover:border-neutral-600 active:scale-95 transition-all"
            >
              <FileText size={13} />
              VIEW
            </button>
          </div>
        </div>
      )}
    </div>
  )
})

export interface TopicBrowserProps {
  folders?: Folder[]
  formulaFolders?: Folder[]
  selectedFolderId?: string | 'all'
  onSelectedFolderIdChange?: (id: string | 'all') => void
  mode?: BrowserMode
  onModeChange?: (mode: BrowserMode) => void
  searchQuery?: string
  onSearchQueryChange?: (query: string) => void
  selectedSubject?: string
  onSelectedSubjectChange?: (subject: string) => void
  scrollPosition?: number
  onScrollPositionChange?: (pos: number) => void
  onSelectTopic?: (
    topic: TopicWithCardCount,
    mode: BrowserMode,
    learnSettings?: LearnSettings,
    testSettings?: TestSettings,
    flashcardSettings?: FlashcardSettings
  ) => void
  onStartGauntlet?: (config: GauntletArcadeConfig) => void
  onOpenSettings?: () => void
}

export function TopicBrowser({
  folders: controlledFolders,
  formulaFolders: controlledFormulaFolders,
  selectedFolderId: controlledSelectedFolderId,
  onSelectedFolderIdChange,
  mode: controlledMode,
  onModeChange,
  searchQuery: controlledSearchQuery,
  onSearchQueryChange,
  selectedSubject: controlledSelectedSubject,
  onSelectedSubjectChange,
  scrollPosition,
  onScrollPositionChange,
  onSelectTopic,
  onStartGauntlet,
  onOpenSettings,
}: TopicBrowserProps = {}) {
  const [localMode, setLocalMode] = useState<BrowserMode>('looksfam')
  const [localFolders] = useState<Folder[]>([])
  const [localFormulaFolders] = useState<Folder[]>([])
  const [localSelectedFolderId, setLocalSelectedFolderId] = useState<string | 'all'>('all')
  const [isFolderDrawerOpen, setIsFolderDrawerOpen] = useState<boolean>(false)
  const [sortMode, setSortMode] = useState<SortMode>('date-desc')
  const [isSortMenuOpen, setIsSortMenuOpen] = useState<boolean>(false)
  const [topics, setTopics] = useState<TopicWithCardCount[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isImporting, setIsImporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [localSearchQuery, setLocalSearchQuery] = useState<string>('')
  const [localSelectedSubject, setLocalSelectedSubject] = useState<string>('ALL')
  const [favoriteOverrides, setFavoriteOverrides] = useState<FavoriteOverrides>({
    starred: new Set(),
    unstarred: new Set(),
  })
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false)

  useEffect(() => {
    getFavoriteOverrides().then(setFavoriteOverrides)
  }, [])

  const favoriteIds = useMemo(() => {
    const ids = new Set<string>()
    for (const t of topics) {
      if (isTopicFavorite(t.id, Boolean(t.isFavorite), favoriteOverrides)) {
        ids.add(t.id)
      }
    }
    return ids
  }, [topics, favoriteOverrides])

  const handleToggleFavorite = useCallback(async (e: React.MouseEvent, topic: TopicWithCardCount) => {
    e.stopPropagation()
    const updated = await toggleTopicFavorite(topic.id, Boolean(topic.isFavorite), favoriteOverrides)
    setFavoriteOverrides(updated)
  }, [favoriteOverrides])

  const folders = controlledFolders ?? localFolders
  const formulaFolders = controlledFormulaFolders ?? localFormulaFolders
  const selectedFolderId = controlledSelectedFolderId ?? localSelectedFolderId
  const setSelectedFolderId = onSelectedFolderIdChange ?? setLocalSelectedFolderId

  const activeFolders = controlledMode === 'formulas' || localMode === 'formulas'
    ? formulaFolders
    : folders

  // Resolve the selected folder into a set of matching folder ids — selecting
  // a root folder also includes its direct child folders (max nesting depth
  // is 1), since topics are only ever linked to the leaf folder they live in,
  // never to a parent folder directly.
  const effectiveFolderIds = useMemo(() => {
    if (selectedFolderId === 'all') return null
    const ids = new Set<string>([selectedFolderId])
    activeFolders.forEach((f) => {
      if (f.parentId === selectedFolderId) ids.add(f.id)
    })
    return ids
  }, [selectedFolderId, activeFolders])

  const mode = controlledMode ?? localMode
  const setMode = onModeChange ?? setLocalMode

  const searchQuery = controlledSearchQuery ?? localSearchQuery
  const setSearchQuery = onSearchQueryChange ?? setLocalSearchQuery

  const selectedSubject = controlledSelectedSubject ?? localSelectedSubject
  const setSelectedSubject = onSelectedSubjectChange ?? setLocalSelectedSubject

  const browserContainerRef = useRef<HTMLDivElement>(null)
  const getScrollPos = () => browserContainerRef.current?.scrollTop || 0

  // Learn Settings Modal state
  const [learnModalTopic, setLearnModalTopic] = useState<TopicWithCardCount | null>(null)
  const [learnSettings, setLearnSettings] = useState<LearnSettings>({ ...DEFAULT_LEARN_SETTINGS })

  // Test Settings Modal state
  const [testModalTopic, setTestModalTopic] = useState<TopicWithCardCount | null>(null)
  const [testSettings, setTestSettings] = useState<TestSettings>({ ...DEFAULT_TEST_SETTINGS })

  // Flashcard Settings Modal state
  const [flashcardModalTopic, setFlashcardModalTopic] = useState<TopicWithCardCount | null>(null)
  const [flashcardSettings, setFlashcardSettings] = useState<FlashcardSettings>({ ...DEFAULT_FLASHCARD_SETTINGS })

  // Fetch topics on mount
  const fetchTopics = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await dbService.getTopicsWithCardCounts()
      const normalizedTopics = data.map((t) => ({
        ...t,
        subject: SUBJECT_MAP[t.subject] || t.subject,
      }))
      setTopics(normalizedTopics)
    } catch (err: unknown) {
      console.warn('[TopicBrowser] Error fetching topics:', err)
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = async () => {
    setIsImporting(true)
    try {
      const resolvedPath = await importDatabaseFile()
      await openDatabase(resolvedPath)
      await fetchTopics()
    } catch (err: unknown) {
      if (err instanceof UserCancelledError) {
        // Silently stay on the same empty state
        return
      }
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      setError(msg)
    } finally {
      setIsImporting(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      const existingPath = await getPreviouslyImportedDbPath()
      if (existingPath) {
        try {
          await openDatabase(existingPath)
        } catch (err) {
          console.warn('[TopicBrowser] Failed to auto-open previously imported DB:', err)
          // Fall through — fetchTopics() will surface the "No Database
          // Imported" state naturally if openDatabase failed
        }
      }
      await fetchTopics()
    }
    init()
  }, [])

  // Restore scroll position after topics load (one-shot on return from session)
  useEffect(() => {
    if (!isLoading && scrollPosition && scrollPosition > 0) {
      const target = scrollPosition
      requestAnimationFrame(() => {
        browserContainerRef.current?.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior })
      })
      onScrollPositionChange?.(0)
    }
  }, [isLoading, scrollPosition, onScrollPositionChange])

  // Filter topics for current mode
  const topicsForMode = useMemo(() => {
    return topics.filter((t) => {
      const deckType = getTopicDeckType(t.types)
      if (!deckType) return false

      if (mode === 'looksfam') {
        return deckType === 'mcq' || deckType === 'mixed'
      }
      if (mode === 'flashcards') {
        return deckType === 'flashcard' || deckType === 'mixed'
      }
      if (mode === 'formulas') {
        return deckType === 'formula'
      }
      return false
    })
  }, [topics, mode])

  // Topics matching the current mode + folder selection (subject/search
  // filters are applied after this, in filteredTopics below)
  const folderFilteredTopics = useMemo(() => {
    if (!effectiveFolderIds) return topicsForMode
    return topicsForMode.filter((t) => t.folderId && effectiveFolderIds.has(t.folderId))
  }, [topicsForMode, effectiveFolderIds])

  // Per-folder item counts, computed from topicsForMode (mode-filtered but
  // NOT folder-filtered — these are facet totals, same convention as
  // subjectCounts before folder filtering was added). Root folders roll up
  // their direct children's counts so the badge shown next to a parent
  // folder matches everything selecting that parent would surface.
  const folderCounts = useMemo(() => {
    const ownCounts: Record<string, number> = {}
    activeFolders.forEach((f) => { ownCounts[f.id] = 0 })
    topicsForMode.forEach((t) => {
      if (t.folderId && ownCounts[t.folderId] !== undefined) {
        ownCounts[t.folderId] += 1
      }
    })
    const byId: Record<string, number> = {}
    activeFolders.forEach((f) => {
      if (f.parentId === null) {
        const children = activeFolders.filter((c) => c.parentId === f.id)
        const childSum = children.reduce((sum, c) => sum + (ownCounts[c.id] ?? 0), 0)
        byId[f.id] = (ownCounts[f.id] ?? 0) + childSum
      } else {
        byId[f.id] = ownCounts[f.id] ?? 0
      }
    })
    return { total: topicsForMode.length, byId }
  }, [activeFolders, topicsForMode])

  // Derive distinct subjects from current mode's topics
  const availableSubjects = useMemo(() => {
    const set = new Set<string>()
    folderFilteredTopics.forEach((t) => {
      if (t.subject && t.subject.trim() !== '') {
        set.add(t.subject.trim())
      }
    })
    const sorted = Array.from(set).sort((a, b) => {
      const ai = SUBJECT_ORDER.indexOf(a)
      const bi = SUBJECT_ORDER.indexOf(b)
      // Unknown subjects (not in SUBJECT_ORDER) sort to the end, alphabetically among themselves
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    return ['ALL', ...sorted]
  }, [folderFilteredTopics])

  // Count topics per subject for badge counters based on current mode
  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: folderFilteredTopics.length }
    folderFilteredTopics.forEach((t) => {
      const sub = t.subject ? t.subject.trim() : 'OTHER'
      counts[sub] = (counts[sub] || 0) + 1
    })
    return counts
  }, [folderFilteredTopics])

  // Auto-reset subject filter if the selected subject does not exist in current mode
  useEffect(() => {
    if (!isLoading && selectedSubject !== 'ALL' && !availableSubjects.includes(selectedSubject)) {
      setSelectedSubject('ALL')
    }
  }, [isLoading, availableSubjects, selectedSubject, setSelectedSubject])

  // Auto-reset folder filter if the selected folder does not exist in active scope
  useEffect(() => {
    if (!isLoading && selectedFolderId !== 'all') {
      const exists = activeFolders.some((f) => f.id === selectedFolderId)
      if (!exists && activeFolders.length > 0) {
        setSelectedFolderId('all')
      }
    }
  }, [isLoading, activeFolders, selectedFolderId, setSelectedFolderId])

  // Filter and score topics by folder, subject, favorites and search query (name & description)
  const { filteredTopics, scoredMap } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    // 1. Initial filter by subject and favorites
    const baseTopics = folderFilteredTopics.filter((t) => {
      if (favoritesOnly && !favoriteIds.has(t.id)) {
        return false
      }
      const matchesSubject =
        selectedSubject === 'ALL' || (t.subject && t.subject.trim() === selectedSubject)
      return matchesSubject
    })

    if (!q) {
      return { filteredTopics: baseTopics, scoredMap: new Map<string, number>() }
    }

    const terms = q.split(/\s+/).filter((t) => t.length > 0)
    const scoredList: {
      topic: TopicWithCardCount
      score: number
      isFullMatch: boolean
      partialMatch: boolean
    }[] = []

    for (const topic of baseTopics) {
      const { score, isFullMatch, partialMatch } = calculateTopicScore(topic, q, terms)
      if (isFullMatch || partialMatch) {
        scoredList.push({ topic, score, isFullMatch, partialMatch })
      }
    }

    // Prioritize topics that match all terms or have exact/phrase match
    const hasFullMatches = scoredList.some((item) => item.isFullMatch)
    const finalMatches = hasFullMatches
      ? scoredList.filter((item) => item.isFullMatch)
      : scoredList

    const scoreMap = new Map<string, number>()
    for (const item of finalMatches) {
      scoreMap.set(item.topic.id, item.score)
    }

    return {
      filteredTopics: finalMatches.map((item) => item.topic),
      scoredMap: scoreMap,
    }
  }, [folderFilteredTopics, selectedSubject, searchQuery, favoritesOnly, favoriteIds])

  // Final display order — when searching, sort primarily by search relevance score descending!
  // The user's chosen sortMode ('date-desc', 'name-asc', etc.) is used as a tie-breaker.
  // When not searching, purely uses sortMode.
  const sortedTopics = useMemo(() => {
    const arr = [...filteredTopics]
    const q = searchQuery.trim()

    if (q) {
      arr.sort((a, b) => {
        const scoreA = scoredMap.get(a.id) ?? 0
        const scoreB = scoredMap.get(b.id) ?? 0
        if (scoreB !== scoreA) {
          return scoreB - scoreA
        }
        // Tie-breaker using selected sort mode
        switch (sortMode) {
          case 'date-desc':
            return (b.createdAt ?? 0) - (a.createdAt ?? 0)
          case 'date-asc':
            return (a.createdAt ?? 0) - (b.createdAt ?? 0)
          case 'name-asc':
            return a.name.localeCompare(b.name)
          case 'name-desc':
            return b.name.localeCompare(a.name)
          default:
            return 0
        }
      })
      return arr
    }

    switch (sortMode) {
      case 'date-desc':
        arr.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        break
      case 'date-asc':
        arr.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
        break
      case 'name-asc':
        arr.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name-desc':
        arr.sort((a, b) => b.name.localeCompare(a.name))
        break
    }
    return arr
  }, [filteredTopics, scoredMap, searchQuery, sortMode])


  const handleLearnStart = () => {
    if (!learnModalTopic || !onSelectTopic) return
    const topic = learnModalTopic
    const settings = learnSettings
    setLearnModalTopic(null)
    onScrollPositionChange?.(getScrollPos())
    onSelectTopic(topic, 'looksfam', settings)
  }

  const handleTestStart = () => {
    if (!testModalTopic || !onSelectTopic) return
    const topic = testModalTopic
    const settings = testSettings
    setTestModalTopic(null)
    onScrollPositionChange?.(getScrollPos())
    onSelectTopic(topic, 'test', undefined, settings)
  }

  const handleFlashcardStart = () => {
    if (!flashcardModalTopic || !onSelectTopic) return
    const topic = flashcardModalTopic
    const settings = flashcardSettings
    const targetMode = mode === 'formulas' ? 'formulas' : 'flashcards'
    setFlashcardModalTopic(null)
    onScrollPositionChange?.(getScrollPos())
    onSelectTopic(topic, targetMode, undefined, undefined, settings)
  }

  const handleOpenLearn = useCallback((topic: TopicWithCardCount) => {
    setLearnSettings({ ...DEFAULT_LEARN_SETTINGS })
    setLearnModalTopic(topic)
  }, [])

  const handleOpenTest = useCallback((topic: TopicWithCardCount) => {
    setTestSettings({ ...DEFAULT_TEST_SETTINGS })
    setTestModalTopic(topic)
  }, [])

  const handleOpenFlashcard = useCallback((topic: TopicWithCardCount) => {
    setFlashcardSettings({ ...DEFAULT_FLASHCARD_SETTINGS })
    setFlashcardModalTopic(topic)
  }, [])

  const handleView = useCallback((topic: TopicWithCardCount) => {
    onScrollPositionChange?.(getScrollPos())
    onSelectTopic?.(topic, 'testpaper')
  }, [onScrollPositionChange, onSelectTopic])

  // Progressive batching: Render an initial small batch for instant UI switch,
  // then append subsequent batches seamlessly as user scrolls.
  const [visibleCount, setVisibleCount] = useState<number>(() => {
    if (scrollPosition && scrollPosition > 0) {
      return Math.max(TOPICS_BATCH_SIZE, Math.ceil((scrollPosition / 150) * 3) + TOPICS_BATCH_SIZE)
    }
    return TOPICS_BATCH_SIZE
  })

  // Reset visible card batch whenever filters or sorting change (render-phase state adjustment)
  const filterKey = `${mode}|${searchQuery}|${selectedSubject}|${selectedFolderId}|${favoritesOnly}|${sortMode}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)

  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey)
    setVisibleCount(TOPICS_BATCH_SIZE)
  }

  const displayedTopics = useMemo(() => {
    return sortedTopics.slice(0, visibleCount)
  }, [sortedTopics, visibleCount])

  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => {
            if (prev >= sortedTopics.length) return prev
            return Math.min(prev + TOPICS_BATCH_SIZE, sortedTopics.length)
          })
        }
      },
      {
        root: browserContainerRef.current,
        rootMargin: '400px',
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sortedTopics.length, displayedTopics.length])

  return (
    <div ref={browserContainerRef} className="h-full flex flex-col bg-neutral-950 text-neutral-50 overflow-y-auto">
      {mode === 'gauntlet' ? (
        <div className="flex-1 pb-20">
          <GauntletArcadeHome
            cardCount={topics.reduce((acc, t) => acc + t.cardCount, 0)}
            onStartRun={(cfg) => onStartGauntlet?.(cfg)}
            onExit={() => setMode('looksfam')}
          />
        </div>
      ) : (
        <>
          {/* Header */}
          <header className="sticky top-0 z-20 border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={appIcon}
              alt="ECEngine logo"
              className="h-8 w-8 object-contain shrink-0"
            />
            <div>
              <h1 className="font-['Orbitron'] text-base font-bold tracking-wider text-white sm:text-lg">
                <span className="text-[#00ff41]">ECE</span>ngine
              </h1>
              <p className="text-[11px] text-neutral-400">
                {isLoading
                  ? 'Loading topics...'
                  : `${filteredTopics.length} topic${filteredTopics.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFavoritesOnly((prev) => !prev)}
              className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
                favoritesOnly
                  ? 'border-[#00ff41]/60 bg-[#00ff41]/20 text-[#00ff41] shadow-[0_0_16px_rgba(0,255,65,0.25)]'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200'
              }`}
              title="Favorites Only"
            >
              <Star size={15} className={favoritesOnly ? 'fill-[#00ff41]' : ''} />
            </button>
            <button
              type="button"
              onClick={() => setIsFolderDrawerOpen(true)}
              title="Folders"
              className={`p-1.5 rounded-lg border bg-neutral-900 active:scale-95 transition-all ${
                selectedFolderId !== 'all'
                  ? 'border-[#00ff41]/50 text-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,0.25)]'
                  : 'border-neutral-800 text-neutral-400 hover:text-[#00ff41]'
              }`}
            >
              <FolderIcon size={15} />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSortMenuOpen((v) => !v)}
                title="Sort topics"
                className={`p-1.5 rounded-lg border bg-neutral-900 active:scale-95 transition-all ${
                  isSortMenuOpen
                    ? 'border-[#00ff41]/50 text-[#00ff41]'
                    : 'border-neutral-800 text-neutral-400 hover:text-[#00ff41]'
                }`}
              >
                <ArrowUpDown size={15} />
              </button>
              {isSortMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsSortMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-40 w-40 rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSortMode(opt.value)
                          setIsSortMenuOpen(false)
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-left transition-colors ${
                          sortMode === opt.value
                            ? 'text-[#00ff41] bg-[#00ff41]/10'
                            : 'text-neutral-300 hover:bg-neutral-900'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {sortMode === opt.value && (
                          <Check size={13} className="text-[#00ff41]" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                title="Settings"
                className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-[#00ff41] active:scale-95 transition-all"
              >
                <SettingsIcon size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="mx-auto mt-3 max-w-5xl">
          <div className="relative flex items-center">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 text-neutral-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics by name, description..."
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900/90 py-2 pl-9 pr-9 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus:border-[#00ff41] focus:ring-1 focus:ring-[#00ff41]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 rounded-md p-1 text-neutral-400 hover:text-neutral-200"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Subject Filter Pills */}
        {availableSubjects.length > 1 && (
          <div className="mx-auto mt-2.5 max-w-5xl">
            <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {availableSubjects.map((sub) => {
                const isActive = selectedSubject === sub
                const colorClasses = getSubjectFilterClasses(sub, isActive)
                const count = subjectCounts[sub] ?? 0

                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSubject(sub)}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-all active:scale-95 ${colorClasses} ${
                      !isActive
                        ? 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:bg-neutral-800/80 hover:text-neutral-200'
                        : sub === 'ALL'
                        ? 'bg-[#00ff41] text-[#0d0d0d] font-bold border border-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                        : ''
                    }`}
                  >
                    <span>{sub}</span>
                    <span className="text-[9.5px] font-mono leading-none opacity-80">
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-4 sm:px-6 pb-24">
        <div className="mx-auto max-w-5xl">


          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-[#00ff41] mb-3" />
              <p className="text-sm font-medium text-neutral-400">
                Loading topics from database...
              </p>
            </div>
          )}

          {/* Error / No DB State */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 text-center my-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertCircle size={24} />
              </div>
              <h2 className="text-lg font-semibold text-neutral-200">
                No Database Imported
              </h2>
              <p className="mt-1 max-w-sm text-xs text-neutral-400 leading-relaxed">
                The database is not currently loaded. Import your SQLite database file to browse topics.
              </p>
              <div className="mt-4 rounded border border-neutral-800 bg-neutral-950 p-2.5 font-mono text-[11px] text-neutral-500 max-w-md text-left overflow-x-auto">
                {error}
              </div>

              {/* TEMP: manual test button, replace with real import empty-state UI later */}
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#00ff41]/10 border border-[#00ff41]/20 px-4 py-2.5 text-xs font-semibold text-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.1)] hover:bg-[#00ff41]/20 hover:border-[#00ff41]/40 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <RefreshCw size={14} className={isImporting ? 'animate-spin text-[#00ff41]' : ''} />
                <span>{isImporting ? 'Importing...' : 'Import Database (Temp)'}</span>
              </button>
            </div>
          )}

          {/* Empty Filter Results */}
          {!isLoading && !error && filteredTopics.length === 0 && topicsForMode.length > 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-neutral-400">
                No topics found matching your filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedSubject('ALL')
                }}
                className="mt-3 text-xs font-medium text-[#00ff41] hover:text-[#00ff41]/80 underline"
              >
                Clear search & filters
              </button>
            </div>
          )}

          {/* Empty Topics State for Mode */}
          {!isLoading && !error && topicsForMode.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 text-center my-8">
              <p className="text-sm text-neutral-400">
                No {mode} topics found in the database.
              </p>
            </div>
          )}

          {/* Topics Grid */}
          {!isLoading && !error && filteredTopics.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {displayedTopics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    mode={mode}
                    searchQuery={searchQuery}
                    isFavorite={favoriteIds.has(topic.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onOpenLearn={handleOpenLearn}
                    onOpenTest={handleOpenTest}
                    onOpenFlashcard={handleOpenFlashcard}
                    onView={handleView}
                  />
                ))}
              </div>
              {displayedTopics.length < sortedTopics.length && (
                <div ref={sentinelRef} className="h-6 w-full pointer-events-none" />
              )}
            </>
          )}
        </div>
      </main>
    </>
  )}

      {/* Bottom Tab Bar — Flashcards | LooksFam | Formulas, plain style */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-800/90 bg-neutral-950/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          <button
            type="button"
            onClick={() => startTransition(() => setMode('flashcards'))}
            className={`flex flex-1 flex-col items-center gap-1 py-1 text-xs font-medium transition-all active:scale-95 ${
              mode === 'flashcards'
                ? 'text-[#00ff41]'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers
              size={20}
              className={mode === 'flashcards' ? 'drop-shadow-[0_0_8px_rgba(0,255,65,0.4)]' : ''}
            />
            <span className="text-[11px] tracking-tight">Flashcards</span>
          </button>

          <button
            type="button"
            onClick={() => startTransition(() => setMode('looksfam'))}
            className={`flex flex-1 flex-col items-center gap-1 py-1 text-xs font-medium transition-all active:scale-95 ${
              mode === 'looksfam'
                ? 'text-[#00ff41]'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <GraduationCap
              size={20}
              className={mode === 'looksfam' ? 'drop-shadow-[0_0_8px_rgba(0,255,65,0.4)]' : ''}
            />
            <span className="text-[11px] tracking-tight">LooksFam</span>
          </button>

          <button
            type="button"
            onClick={() => startTransition(() => setMode('formulas'))}
            className={`flex flex-1 flex-col items-center gap-1 py-1 text-xs font-medium transition-all active:scale-95 ${
              mode === 'formulas'
                ? 'text-[#00ff41]'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sigma
              size={20}
              className={mode === 'formulas' ? 'drop-shadow-[0_0_8px_rgba(0,255,65,0.4)]' : ''}
            />
            <span className="text-[11px] tracking-tight">Formulas</span>
          </button>

          <button
            type="button"
            onClick={() => startTransition(() => setMode('gauntlet'))}
            className={`flex flex-1 flex-col items-center gap-1 py-1 text-xs font-medium transition-all active:scale-95 ${
              mode === 'gauntlet'
                ? 'text-amber-400'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Swords
              size={20}
              className={mode === 'gauntlet' ? 'drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]' : ''}
            />
            <span className="text-[11px] tracking-tight">Gauntlet</span>
          </button>
        </div>
      </nav>
      {/* Learn Settings Modal */}
      <LearnSettingsModal
        isOpen={learnModalTopic !== null}
        cardCount={learnModalTopic?.cardCount ?? 0}
        settings={learnSettings}
        onSettingsChange={setLearnSettings}
        onStart={handleLearnStart}
        onClose={() => setLearnModalTopic(null)}
      />

      {/* Test Settings Modal */}
      <TestSettingsModal
        isOpen={testModalTopic !== null}
        cardCount={testModalTopic?.cardCount ?? 0}
        settings={testSettings}
        onSettingsChange={setTestSettings}
        onStart={handleTestStart}
        onClose={() => setTestModalTopic(null)}
      />

      {/* Flashcard Settings Modal */}
      <FlashcardSettingsModal
        isOpen={flashcardModalTopic !== null}
        cardCount={flashcardModalTopic?.cardCount ?? 0}
        settings={flashcardSettings}
        onSettingsChange={setFlashcardSettings}
        onStart={handleFlashcardStart}
        onClose={() => setFlashcardModalTopic(null)}
        cardType={mode === 'formulas' ? 'formula' : 'flashcard'}
      />

      {/* Folder Drawer */}
      <FolderDrawer
        isOpen={isFolderDrawerOpen}
        onClose={() => setIsFolderDrawerOpen(false)}
        folders={activeFolders}
        selectedFolderId={selectedFolderId}
        onSelect={setSelectedFolderId}
        folderCounts={folderCounts}
      />
    </div>
  )
}
export default TopicBrowser
