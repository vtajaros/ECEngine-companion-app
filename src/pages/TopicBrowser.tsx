import { useState, useEffect, useMemo } from 'react'
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
} from 'lucide-react'
import { openDatabase, dbService, TopicWithCardCount, getPreviouslyImportedDbPath } from '../services/db.service'
import { importDatabaseFile, UserCancelledError } from '../services/import.service'
import { getSubjectBadgeClasses, getSubjectFilterClasses, SUBJECT_MAP } from '../lib/subjectColors'
import { LearnSettingsModal, LearnSettings, DEFAULT_LEARN_SETTINGS } from '../components/LearnSettingsModal'
import { TestSettingsModal, DEFAULT_TEST_SETTINGS } from '../components/TestSettingsModal'
import type { TestSettings } from '../pages/TestMode'

export type BrowserMode = 'looksfam' | 'test' | 'flashcards' | 'formulas'
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

const SUBJECT_ORDER = ['MATH', 'ELECS', 'GEAS', 'EST']

export interface TopicBrowserProps {
  onSelectTopic?: (
    topic: TopicWithCardCount,
    mode: BrowserMode,
    learnSettings?: LearnSettings,
    testSettings?: TestSettings
  ) => void
  onOpenSettings?: () => void
}

export function TopicBrowser({ onSelectTopic, onOpenSettings }: TopicBrowserProps = {}) {
  const [mode, setMode] = useState<BrowserMode>('looksfam')
  const [includeMcqInFlashcards, setIncludeMcqInFlashcards] = useState<boolean>(false)
  const [topics, setTopics] = useState<TopicWithCardCount[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isImporting, setIsImporting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL')

  // Learn Settings Modal state
  const [learnModalTopic, setLearnModalTopic] = useState<TopicWithCardCount | null>(null)
  const [learnSettings, setLearnSettings] = useState<LearnSettings>({ ...DEFAULT_LEARN_SETTINGS })

  // Test Settings Modal state
  const [testModalTopic, setTestModalTopic] = useState<TopicWithCardCount | null>(null)
  const [testSettings, setTestSettings] = useState<TestSettings>({ ...DEFAULT_TEST_SETTINGS })

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

  // Filter topics for current mode
  const topicsForMode = useMemo(() => {
    return topics.filter((t) => {
      const deckType = getTopicDeckType(t.types)
      if (!deckType) return false

      if (mode === 'looksfam') {
        return deckType === 'mcq' || deckType === 'mixed'
      }
      if (mode === 'flashcards') {
        if (deckType === 'flashcard' || deckType === 'mixed') return true
        if (includeMcqInFlashcards && deckType === 'mcq') return true
        return false
      }
      if (mode === 'formulas') {
        return deckType === 'formula'
      }
      return false
    })
  }, [topics, mode, includeMcqInFlashcards])

  // Derive distinct subjects from current mode's topics
  const availableSubjects = useMemo(() => {
    const set = new Set<string>()
    topicsForMode.forEach((t) => {
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
  }, [topicsForMode])

  // Count topics per subject for badge counters based on current mode
  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: topicsForMode.length }
    topicsForMode.forEach((t) => {
      const sub = t.subject ? t.subject.trim() : 'OTHER'
      counts[sub] = (counts[sub] || 0) + 1
    })
    return counts
  }, [topicsForMode])

  // Auto-reset subject filter if the selected subject does not exist in current mode
  useEffect(() => {
    if (selectedSubject !== 'ALL' && !availableSubjects.includes(selectedSubject)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset subject filter when active subject is not in current mode
      setSelectedSubject('ALL')
    }
  }, [availableSubjects, selectedSubject])

  // Filter topics by subject and search query
  const filteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return topicsForMode.filter((t) => {
      const matchesSubject =
        selectedSubject === 'ALL' || (t.subject && t.subject.trim() === selectedSubject)
      const matchesQuery = !q || t.name.toLowerCase().includes(q)
      return matchesSubject && matchesQuery
    })
  }, [topicsForMode, selectedSubject, searchQuery])


  const handleLearnStart = () => {
    if (!learnModalTopic || !onSelectTopic) return
    const topic = learnModalTopic
    const settings = learnSettings
    setLearnModalTopic(null)
    onSelectTopic(topic, 'looksfam', settings)
  }

  const handleTestStart = () => {
    if (!testModalTopic || !onSelectTopic) return
    const topic = testModalTopic
    const settings = testSettings
    setTestModalTopic(null)
    onSelectTopic(topic, 'test', undefined, settings)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 text-neutral-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20">
              <Layers size={18} />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-neutral-100 sm:text-lg">
                ECEngine Companion
              </h1>
              <p className="text-[11px] text-neutral-400">
                {isLoading
                  ? 'Loading topics...'
                  : `${topicsForMode.length} topic${topicsForMode.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {topics.length > 0 && (
              <button
                onClick={fetchTopics}
                title="Refresh topics"
                className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-[#00ff41] active:scale-95 transition-all"
              >
                <RefreshCw size={15} className={isLoading ? 'animate-spin text-[#00ff41]' : ''} />
              </button>
            )}
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
              placeholder="Search topics by name..."
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
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {availableSubjects.map((sub) => {
                const isActive = selectedSubject === sub
                const colorClasses = getSubjectFilterClasses(sub, isActive)
                const count = subjectCounts[sub] ?? 0

                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSubject(sub)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition-all active:scale-95 ${colorClasses} ${
                      !isActive
                        ? 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:bg-neutral-800/80 hover:text-neutral-200'
                        : sub === 'ALL'
                        ? 'bg-[#00ff41] text-[#0d0d0d] font-bold border border-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                        : ''
                    }`}
                  >
                    <span>{sub}</span>
                    <span
                      className={`rounded px-1 text-[10px] font-mono leading-none ${
                        isActive
                          ? 'bg-black/20 text-current'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
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
          {/* Flashcards "Include MCQ decks" toggle */}
          {mode === 'flashcards' && !isLoading && !error && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/60 px-3.5 py-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeMcqInFlashcards}
                  onChange={(e) => setIncludeMcqInFlashcards(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-700 bg-neutral-950 text-[#00ff41] accent-[#00ff41] focus:ring-0 focus:ring-offset-0 transition-colors"
                />
                <span>Include MCQ decks</span>
              </label>
              <span className="text-[11px] text-neutral-500 font-mono">
                {topicsForMode.length} decks available
              </span>
            </div>
          )}

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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTopics.map((topic) => {
                // Parse comma-separated types into distinct cleaned tags
                const parsedTypes = topic.types
                  ? topic.types
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                  : []

                const badgeClasses = getSubjectBadgeClasses(topic.subject || 'ALL')

                return (
                  <div
                    key={topic.id}
                    className="group relative flex flex-col justify-between rounded-xl border border-neutral-800 bg-neutral-900/80 p-4 transition-all duration-200 hover:border-neutral-700 hover:bg-neutral-900 shadow-sm"
                  >
                    {/* Top Row: Subject Badge & Card Count */}
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${badgeClasses}`}
                        >
                          {topic.subject || 'OTHER'}
                        </span>
                        <span className="text-[11px] font-mono font-medium text-neutral-400 bg-neutral-950/60 px-2 py-0.5 rounded border border-neutral-800">
                          {topic.cardCount} {topic.cardCount === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      {/* Topic Name */}
                      <h2 className="mt-2.5 text-base font-semibold leading-snug tracking-tight text-neutral-100 uppercase group-hover:text-[#00ff41] transition-colors line-clamp-2">
                        {topic.name}
                      </h2>

                      {/* Description if present */}
                      {topic.description && topic.description.trim() !== '' && (
                        <p className="mt-1 text-xs text-neutral-400 leading-relaxed line-clamp-2">
                          {topic.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom Row: Type Chips and Learn Button */}
                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-1.5 pt-2.5 border-t border-neutral-800/60">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {parsedTypes.map((type) => (
                          <span
                            key={type}
                            className="rounded bg-neutral-950/80 px-2 py-0.5 text-[10px] font-medium tracking-wide text-neutral-300 border border-neutral-800"
                          >
                            {formatTypeChip(type)}
                          </span>
                        ))}

                        {/* Render custom tags if available (capped at 2 for mobile compactness) */}
                        {topic.tags &&
                          topic.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-neutral-950/80 px-2 py-0.5 text-[10px] font-medium tracking-wide text-neutral-300 border border-neutral-800"
                            >
                              {tag}
                            </span>
                          ))}
                      </div>

                      {/* Learn & Test buttons — only shown in looksfam mode */}
                      {mode === 'looksfam' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setLearnSettings({ ...DEFAULT_LEARN_SETTINGS })
                              setLearnModalTopic(topic)
                            }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#00ff41]/10 border border-[#00ff41]/25 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold uppercase tracking-wider text-[#00ff41] hover:bg-[#00ff41]/20 hover:border-[#00ff41]/50 active:scale-95 transition-all"
                          >
                            <Play size={13} className="fill-[#00ff41]" />
                            Learn
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTestSettings({ ...DEFAULT_TEST_SETTINGS })
                              setTestModalTopic(topic)
                            }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold uppercase tracking-wider text-neutral-200 hover:bg-neutral-700 hover:text-white active:scale-95 transition-all"
                          >
                            <ClipboardList size={13} />
                            Test
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-800/90 bg-neutral-950/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          <button
            type="button"
            onClick={() => setMode('looksfam')}
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
            onClick={() => setMode('flashcards')}
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
            onClick={() => setMode('formulas')}
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
    </div>
  )
}
export default TopicBrowser
