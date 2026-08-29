import { useState } from 'react'
import { TopicBrowser, BrowserMode } from './pages/TopicBrowser'
import { LearnSession } from './pages/LearnSession'
import { Settings } from './pages/Settings'
import { TTSTest } from './pages/TTSTest'

interface ActiveSession {
  topicId: string
  topicName?: string
  mode: BrowserMode
}

function App() {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showTTSTest, setShowTTSTest] = useState(false)

  // Temporary route for standalone TTS verification
  if (showTTSTest) {
    return <TTSTest onClose={() => setShowTTSTest(false)} />
  }

  if (showSettings) {
    return (
      <Settings
        onClose={() => setShowSettings(false)}
        onOpenTTSTest={() => setShowTTSTest(true)}
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
      />
    )
  }

  return (
    <TopicBrowser
      onOpenSettings={() => setShowSettings(true)}
      onSelectTopic={(topic, mode) => {
        if (mode === 'looksfam') {
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
