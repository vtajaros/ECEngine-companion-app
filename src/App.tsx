import { useState, useMemo } from 'react'
import { TopicBrowser, BrowserMode } from './pages/TopicBrowser'
import { LearnSession } from './pages/LearnSession'
import { Settings } from './pages/Settings'
import { LearnSettings, DEFAULT_LEARN_SETTINGS } from './components/LearnSettingsModal'
import type { LearnPipelineSettings } from './lib/learnPipeline'

interface ActiveSession {
  topicId: string
  topicName?: string
  mode: BrowserMode
  learnSettings: LearnSettings
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

  const pipelineSettings = useMemo(() => {
    if (!activeSession) return undefined
    return toPipelineSettings(activeSession.learnSettings)
  }, [
    activeSession?.learnSettings.bookmarkedOnly,
    activeSession?.learnSettings.shuffleQuestions,
    activeSession?.learnSettings.shuffleChoices,
    activeSession?.learnSettings.itemCount,
    activeSession?.learnSettings.randomSample,
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
        ttsEnabled={activeSession.learnSettings.ttsEnabled}
      />
    )
  }

  return (
    <TopicBrowser
      onOpenSettings={() => setShowSettings(true)}
      onSelectTopic={(topic, mode, learnSettings) => {
        if (mode === 'looksfam') {
          setActiveSession({
            topicId: topic.id,
            topicName: topic.name,
            mode,
            learnSettings: learnSettings ?? DEFAULT_LEARN_SETTINGS,
          })
        }
      }}
    />
  )
}

export default App
