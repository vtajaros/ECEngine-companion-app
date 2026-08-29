import { useState, useMemo, useEffect } from 'react'
import { TopicBrowser, BrowserMode } from './pages/TopicBrowser'
import { LearnSession } from './pages/LearnSession'
import { TestMode, TestSettings } from './pages/TestMode'
import { TestPaperView } from './pages/TestPaperView'
import { FlashcardSession } from './pages/FlashcardSession'
import { Settings } from './pages/Settings'
import { LearnSettings, DEFAULT_LEARN_SETTINGS } from './components/LearnSettingsModal'
import { DEFAULT_TEST_SETTINGS } from './components/TestSettingsModal'
import type { LearnPipelineSettings } from './lib/learnPipeline'
import { dbService } from './services/db.service'
import { Card } from './types'

interface ActiveSession {
  topicId: string
  topicName?: string
  mode: BrowserMode
  learnSettings?: LearnSettings
  testSettings?: TestSettings
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

  // Lifted browser state to survive session navigation
  const [browserMode, setBrowserMode] = useState<BrowserMode>('looksfam')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL')
  const [scrollPosition, setScrollPosition] = useState<number>(0)

  // Load cards for test mode when a test session begins
  useEffect(() => {
    if (activeSession && activeSession.mode === 'test') {
      dbService.getCardsWithProgress(activeSession.topicId).then(setTestCards).catch((err) => {
        console.error('[App] Failed to load cards for test:', err)
      })
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset test cards when leaving test session
      setTestCards([])
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

  if (showSettings) {
    return (
      <Settings
        onClose={() => setShowSettings(false)}
      />
    )
  }

  if (activeSession && activeSession.mode === 'looksfam') {
    return (
      <LearnSession
        topicId={activeSession.topicId}
        topicName={activeSession.topicName}
        onExit={() => setActiveSession(null)}
        onOpenSettings={() => setShowSettings(true)}
        learnSettings={pipelineSettings}
        ttsEnabled={activeSession.learnSettings?.ttsEnabled}
      />
    )
  }

  if (activeSession && activeSession.mode === 'test') {
    return (
      <TestMode
        cards={testCards}
        title={activeSession.topicName}
        settings={memoizedTestSettings ?? DEFAULT_TEST_SETTINGS}
        onExit={() => setActiveSession(null)}
      />
    )
  }

  if (activeSession && activeSession.mode === 'testpaper') {
    return (
      <TestPaperView
        topicId={activeSession.topicId}
        title={activeSession.topicName}
        onExit={() => setActiveSession(null)}
      />
    )
  }

  if (activeSession && activeSession.mode === 'flashcards') {
    return (
      <FlashcardSession
        topicId={activeSession.topicId}
        topicName={activeSession.topicName}
        onExit={() => setActiveSession(null)}
        onOpenSettings={() => setShowSettings(true)}
      />
    )
  }

  return (
    <TopicBrowser
      mode={browserMode}
      onModeChange={setBrowserMode}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      selectedSubject={selectedSubject}
      onSelectedSubjectChange={setSelectedSubject}
      scrollPosition={scrollPosition}
      onScrollPositionChange={setScrollPosition}
      onOpenSettings={() => setShowSettings(true)}
      onSelectTopic={(topic, mode, selectedLearnSettings, selectedTestSettings) => {
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
            mode,
          })
        } else if (mode === 'flashcards') {
          setActiveSession({
            topicId: topic.id,
            topicName: topic.name,
            mode,
          })
        }
      }}
    />
  )
}

export default App
