import { useState } from 'react'
import { TopicBrowser, BrowserMode } from './pages/TopicBrowser'
import { LearnSession } from './pages/LearnSession'
import { Settings } from './pages/Settings'

interface ActiveSession {
  topicId: string
  topicName?: string
  mode: BrowserMode
}

function App() {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  if (showSettings) {
    return <Settings onClose={() => setShowSettings(false)} />
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
