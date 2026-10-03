import { useState, useMemo, useEffect, lazy, Suspense } from 'react'
import { TopicBrowser, BrowserMode } from './pages/TopicBrowser'
import type { TestSettings } from './pages/TestMode'
import { LearnSettings, DEFAULT_LEARN_SETTINGS } from './components/LearnSettingsModal'
import { DEFAULT_TEST_SETTINGS } from './components/TestSettingsModal'
import { FlashcardSettings, DEFAULT_FLASHCARD_SETTINGS } from './components/FlashcardSettingsModal'
import type { LearnPipelineSettings } from './lib/learnPipeline'
import { dbService, Folder, openDatabase, getPreviouslyImportedDbPath } from './services/db.service'
import { ttsService } from './services/tts.service'
import { Card } from './types'
import { App as CapacitorApp } from '@capacitor/app'

const LearnSession = lazy(() =>
  import('./pages/LearnSession').then((m) => ({ default: m.LearnSession }))
)
const TestMode = lazy(() =>
  import('./pages/TestMode').then((m) => ({ default: m.TestMode }))
)
const TestPaperView = lazy(() =>
  import('./pages/TestPaperView').then((m) => ({ default: m.TestPaperView }))
)
const FlashcardSession = lazy(() =>
  import('./pages/FlashcardSession').then((m) => ({ default: m.FlashcardSession }))
)
const SettingsPage = lazy(() =>
  import('./pages/Settings').then((m) => ({ default: m.Settings }))
)
const GauntletSession = lazy(() =>
  import('./pages/GauntletSession').then((m) => ({ default: m.GauntletSession }))
)
import type { GauntletArcadeConfig } from './lib/gauntlet'

function SessionFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-black">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-[#00ff41]" />
    </div>
  )
}

interface ActiveSession {
  topicId: string
  topicName?: string
  topicDescription?: string
  mode: BrowserMode
  learnSettings?: LearnSettings
  testSettings?: TestSettings
  flashcardSettings?: FlashcardSettings
  gauntletConfig?: GauntletArcadeConfig
  customCards?: Card[]
}

function toPipelineSettings(s: LearnSettings): LearnPipelineSettings {
  return {
    bookmarkedOnly: s.bookmarkedOnly,
    shuffleQuestions: s.shuffleQuestions,
    shuffleChoices: s.shuffleChoices,
    itemCount: s.itemCount,
    randomSample: s.randomSample,
  }
}

function App() {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [testCards, setTestCards] = useState<Card[]>([])
  const [gauntletCards, setGauntletCards] = useState<Card[]>([])

  // Lifted browser state to survive session navigation
  const [browserMode, setBrowserMode] = useState<BrowserMode>('looksfam')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL')
  const [selectedFolderId, setSelectedFolderId] = useState<string | 'all'>('all')
  const [scrollPosition, setScrollPosition] = useState<number>(0)
  const [dbVersion, setDbVersion] = useState(0)
  const [folders, setFolders] = useState<Folder[]>([])
  const [formulaFolders, setFormulaFolders] = useState<Folder[]>([])

  // Pre-warm the native TTS service early on app boot to avoid cold-start penalties
  useEffect(() => {
    ttsService.prewarm()
  }, [])

  // Stop TTS immediately on screen lock, minimize, or backgrounding
  useEffect(() => {
    let appListenerHandle: { remove: () => Promise<void> } | null = null

    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        ttsService.stop()
      }
    }).then((handle) => {
      appListenerHandle = handle
    })

    const handleVisibilityChange = () => {
      if (document.hidden) {
        ttsService.stop()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (appListenerHandle) {
        appListenerHandle.remove()
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Fetch folders on mount / dbVersion change
  useEffect(() => {
    let isCancelled = false

    const fetchFolders = async () => {
      try {
        const existingPath = await getPreviouslyImportedDbPath()
        if (existingPath) {
          try {
            await openDatabase(existingPath)
          } catch (err) {
            console.warn('[App] Failed to auto-open previously imported DB:', err)
          }
        }
        const [studyData, formulaData] = await Promise.all([
          dbService.getFolders('study'),
          dbService.getFolders('formula'),
          dbService.getTopicsWithCardCounts(),
        ])
        if (!isCancelled) {
          setFolders(studyData)
          setFormulaFolders(formulaData)
        }
      } catch (err) {
        if (!isCancelled) console.warn('[App] Error fetching folders:', err)
      }
    }

    fetchFolders()

    return () => {
      isCancelled = true
    }
  }, [dbVersion])

  // Load cards for test mode when a test session begins
  useEffect(() => {
    let isCancelled = false

    if (activeSession && activeSession.mode === 'test') {
      dbService.getCardsWithProgress(activeSession.topicId)
        .then((cards) => {
          if (!isCancelled) setTestCards(cards)
        })
        .catch((err) => {
          if (!isCancelled) console.error('[App] Failed to load cards for test:', err)
        })
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset test cards when leaving test session
      setTestCards([])
    }

    return () => {
      isCancelled = true
    }
  }, [activeSession])

  // Memoized Learn Pipeline Settings: keyed on primitive fields to stabilize reference
  const learnSettings = activeSession?.learnSettings
  const pipelineSettings = useMemo(() => {
    if (!learnSettings) return undefined
    return toPipelineSettings(learnSettings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    learnSettings?.bookmarkedOnly,
    learnSettings?.shuffleQuestions,
    learnSettings?.shuffleChoices,
    learnSettings?.itemCount,
    learnSettings?.randomSample,
  ])

  // Memoized Test Settings: keyed on primitive fields to prevent resetting in-progress test on parent re-renders
  const testSettings = activeSession?.testSettings
  const memoizedTestSettings: TestSettings | undefined = useMemo(() => {
    if (!testSettings) return undefined
    return {
      itemCount: testSettings.itemCount,
      instantChecking: testSettings.instantChecking,
      shuffleQuestions: testSettings.shuffleQuestions,
      shuffleChoices: testSettings.shuffleChoices,
      bookmarkedOnly: testSettings.bookmarkedOnly,
      randomSample: testSettings.randomSample,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    testSettings?.itemCount,
    testSettings?.instantChecking,
    testSettings?.shuffleQuestions,
    testSettings?.shuffleChoices,
    testSettings?.bookmarkedOnly,
    testSettings?.randomSample,
  ])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-neutral-950">
      <div className={`h-full w-full ${activeSession || showSettings ? 'hidden' : 'block'}`}>
        <TopicBrowser
          key={dbVersion}
          folders={folders}
          formulaFolders={formulaFolders}
          selectedFolderId={selectedFolderId}
          onSelectedFolderIdChange={setSelectedFolderId}
          mode={browserMode}
          onModeChange={setBrowserMode}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          selectedSubject={selectedSubject}
          onSelectedSubjectChange={setSelectedSubject}
          scrollPosition={scrollPosition}
          onScrollPositionChange={setScrollPosition}
          onOpenSettings={() => setShowSettings(true)}
          onStartGauntlet={async (config) => {
            try {
              const cards = await dbService.getGauntletCards(config.subjects)
              if (cards.length === 0) {
                alert('No MCQ questions available for Gauntlet in ' + config.subjects.join(', '))
                return
              }
              setGauntletCards(cards)
              setActiveSession({
                topicId: 'gauntlet',
                topicName: `Gauntlet: ${config.mode.toUpperCase()}`,
                mode: 'gauntlet',
                gauntletConfig: config,
              })
            } catch (err) {
              console.error('[App] Failed to load cards for Gauntlet:', err)
            }
          }}
          onSelectTopic={(topic, mode, selectedLearnSettings, selectedTestSettings, selectedFlashcardSettings) => {
            if (mode === 'looksfam') {
              setActiveSession({
                topicId: topic.id,
                topicName: topic.name,
                mode,
                learnSettings: selectedLearnSettings ?? DEFAULT_LEARN_SETTINGS,
              })
            } else if (mode === 'test') {
              setActiveSession({
                topicId: topic.id,
                topicName: topic.name,
                mode,
                testSettings: selectedTestSettings ?? DEFAULT_TEST_SETTINGS,
              })
            } else if (mode === 'testpaper') {
              setActiveSession({
                topicId: topic.id,
                topicName: topic.name,
                topicDescription: topic.description,
                mode,
              })
            } else if (mode === 'flashcards' || mode === 'formulas') {
              setActiveSession({
                topicId: topic.id,
                topicName: topic.name,
                mode,
                flashcardSettings: selectedFlashcardSettings ?? DEFAULT_FLASHCARD_SETTINGS,
              })
            }
          }}
        />
      </div>

      {showSettings && (
        <Suspense fallback={<SessionFallback />}>
          <SettingsPage
            onClose={() => setShowSettings(false)}
            onDatabaseImported={() => {
              setDbVersion((v) => v + 1)
              setShowSettings(false)
            }}
          />
        </Suspense>
      )}

      {activeSession && activeSession.mode === 'looksfam' && (
        <Suspense fallback={<SessionFallback />}>
          <LearnSession
            topicId={activeSession.topicId}
            topicName={activeSession.topicName}
            initialCards={activeSession.customCards}
            onExit={() => setActiveSession(null)}
            onOpenSettings={() => setShowSettings(true)}
            learnSettings={pipelineSettings}
            ttsEnabled={activeSession.learnSettings?.ttsEnabled}
          />
        </Suspense>
      )}

      {activeSession && activeSession.mode === 'gauntlet' && activeSession.gauntletConfig && (
        <Suspense fallback={<SessionFallback />}>
          <GauntletSession
            cards={gauntletCards}
            config={activeSession.gauntletConfig}
            onExit={() => setActiveSession(null)}
            onDrillMistakes={(mistakeCards) => {
              setActiveSession({
                topicId: 'gauntlet-mistakes',
                topicName: 'Gauntlet Mistakes Drill',
                mode: 'looksfam',
                customCards: mistakeCards,
                learnSettings: {
                  ...DEFAULT_LEARN_SETTINGS,
                  itemCount: mistakeCards.length,
                },
              })
            }}
          />
        </Suspense>
      )}

      {activeSession && activeSession.mode === 'test' && (
        <Suspense fallback={<SessionFallback />}>
          <TestMode
            key={activeSession.topicId}
            cards={testCards}
            title={activeSession.topicName}
            settings={memoizedTestSettings ?? DEFAULT_TEST_SETTINGS}
            onExit={() => setActiveSession(null)}
          />
        </Suspense>
      )}

      {activeSession && activeSession.mode === 'testpaper' && (
        <Suspense fallback={<SessionFallback />}>
          <TestPaperView
            topicId={activeSession.topicId}
            title={activeSession.topicName}
            description={activeSession.topicDescription}
            onExit={() => setActiveSession(null)}
          />
        </Suspense>
      )}

      {activeSession && (activeSession.mode === 'flashcards' || activeSession.mode === 'formulas') && (
        <Suspense fallback={<SessionFallback />}>
          <FlashcardSession
            topicId={activeSession.topicId}
            topicName={activeSession.topicName}
            onExit={() => setActiveSession(null)}
            onOpenSettings={() => setShowSettings(true)}
            initialSettings={activeSession.flashcardSettings}
            cardType={activeSession.mode === 'formulas' ? 'formula' : 'flashcard'}
          />
        </Suspense>
      )}
    </div>
  )
}

export default App
