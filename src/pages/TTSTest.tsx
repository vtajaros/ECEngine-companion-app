import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Volume2, Play, Square } from 'lucide-react'
import { TextToSpeech } from '@capacitor-community/text-to-speech'

interface TTSTestProps {
  onClose: () => void
}

interface LogEntry {
  time: string
  source: 'WebSpeech' | 'CapacitorTTS' | 'System'
  type: 'info' | 'success' | 'warn' | 'error'
  message: string
}

export function TTSTest({ onClose }: TTSTestProps) {
  const [hasWebSpeech, setHasWebSpeech] = useState<boolean>(false)
  const [voices, setVoices] = useState<Array<{ name: string; lang: string; default: boolean; localService?: boolean }>>([])
  const [voicesChangedFired, setVoicesChangedFired] = useState<boolean>(false)
  const [voicesChangedCount, setVoicesChangedCount] = useState<number>(0)
  const [testText, setTestText] = useState('Testing text to speech on Android.')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isSpeakingWeb, setIsSpeakingWeb] = useState(false)
  const [isSpeakingCap, setIsSpeakingCap] = useState(false)

  const logRef = useRef<HTMLDivElement>(null)

  const addLog = (source: LogEntry['source'], type: LogEntry['type'], message: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(new Date().getMilliseconds()).padStart(3, '0')
    setLogs((prev) => [...prev, { time, source, type, message }])
  }

  // Initial check and voices listener setup
  useEffect(() => {
    const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && Boolean(window.speechSynthesis)
    setHasWebSpeech(isSupported)

    if (isSupported) {
      addLog('WebSpeech', 'info', `window.speechSynthesis is available (typeof: ${typeof window.speechSynthesis})`)

      const initialVoices = window.speechSynthesis.getVoices()
      addLog('WebSpeech', initialVoices.length > 0 ? 'success' : 'warn', `Initial getVoices() returned ${initialVoices.length} voices`)
      if (initialVoices.length > 0) {
        setVoices(initialVoices.map(v => ({ name: v.name, lang: v.lang, default: v.default, localService: v.localService })))
      }

      const handleVoicesChanged = () => {
        setVoicesChangedFired(true)
        setVoicesChangedCount((c) => c + 1)
        const updated = window.speechSynthesis.getVoices()
        addLog('WebSpeech', updated.length > 0 ? 'success' : 'warn', `voiceschanged event fired! Found ${updated.length} voices.`)
        setVoices(updated.map(v => ({ name: v.name, lang: v.lang, default: v.default, localService: v.localService })))
      }

      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged)

      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
      }
    } else {
      addLog('WebSpeech', 'error', 'window.speechSynthesis is NOT available in this WebView')
    }
  }, [])

  // Check Capacitor plugin support
  useEffect(() => {
    TextToSpeech.getSupportedVoices()
      .then((res) => {
        addLog('CapacitorTTS', 'info', `Capacitor TextToSpeech plugin active: ${res.voices.length} supported voices`)
      })
      .catch((err) => {
        addLog('CapacitorTTS', 'warn', `Capacitor getSupportedVoices() note: ${err?.message || err}`)
      })
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  const handleTestWebSpeech = () => {
    if (!hasWebSpeech || typeof window === 'undefined' || !window.speechSynthesis) {
      addLog('WebSpeech', 'error', 'Cannot speak: window.speechSynthesis is not available')
      return
    }

    try {
      // Cancel any current utterance
      window.speechSynthesis.cancel()
      addLog('WebSpeech', 'info', `Creating SpeechSynthesisUtterance("${testText}")...`)

      const utterance = new SpeechSynthesisUtterance(testText)
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.volume = 1.0

      const currentVoices = window.speechSynthesis.getVoices()
      if (currentVoices.length > 0) {
        // Choose english voice if available
        const enVoice = currentVoices.find(v => v.lang.startsWith('en')) || currentVoices[0]
        utterance.voice = enVoice
        addLog('WebSpeech', 'info', `Using voice: ${enVoice.name} (${enVoice.lang})`)
      } else {
        addLog('WebSpeech', 'warn', 'No voices from getVoices() yet, attempting default utterance.voice')
      }

      utterance.onstart = () => {
        setIsSpeakingWeb(true)
        addLog('WebSpeech', 'success', '▶ utterance.onstart fired! (Speech started)')
      }

      utterance.onend = () => {
        setIsSpeakingWeb(false)
        addLog('WebSpeech', 'success', '⏹ utterance.onend fired! (Speech finished successfully)')
      }

      utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
        setIsSpeakingWeb(false)
        const errMsg = (e as any).message || 'none'
        addLog('WebSpeech', 'error', `❌ utterance.onerror fired! error type: "${e.error}", message: "${errMsg}"`)
      }

      utterance.onpause = () => addLog('WebSpeech', 'info', '⏸ utterance.onpause fired')
      utterance.onresume = () => addLog('WebSpeech', 'info', '▶ utterance.onresume fired')

      setIsSpeakingWeb(true)
      window.speechSynthesis.speak(utterance)
      addLog('WebSpeech', 'info', 'window.speechSynthesis.speak() called.')
    } catch (err: any) {
      setIsSpeakingWeb(false)
      addLog('WebSpeech', 'error', `Exception calling speak(): ${err?.message || err}`)
    }
  }

  const handleStopWebSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      setIsSpeakingWeb(false)
      addLog('WebSpeech', 'info', 'window.speechSynthesis.cancel() called.')
    }
  }

  const handleTestCapacitorTTS = async () => {
    setIsSpeakingCap(true)
    addLog('CapacitorTTS', 'info', `Calling TextToSpeech.speak("${testText}")...`)
    try {
      await TextToSpeech.speak({
        text: testText,
        lang: 'en-US',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      })
      addLog('CapacitorTTS', 'success', 'TextToSpeech.speak() completed successfully!')
    } catch (err: any) {
      addLog('CapacitorTTS', 'error', `TextToSpeech.speak() error: ${err?.message || err}`)
    } finally {
      setIsSpeakingCap(false)
    }
  }

  const handleStopCapacitorTTS = async () => {
    try {
      await TextToSpeech.stop()
      setIsSpeakingCap(false)
      addLog('CapacitorTTS', 'info', 'TextToSpeech.stop() called.')
    } catch (err: any) {
      addLog('CapacitorTTS', 'error', `TextToSpeech.stop() error: ${err?.message || err}`)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 text-neutral-100 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200 active:scale-95 transition-all"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold uppercase tracking-tight text-neutral-100">
                  TTS Diagnostic Test
                </h1>
                <span className="text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded">
                  Temporary
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Verifies Android WebView speech synthesis
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-5">
          {/* Status Overview Card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 space-y-3">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-[#00ff41] flex items-center gap-2">
              <Volume2 size={15} />
              <span>WebView TTS Status</span>
            </h2>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                <span className="text-neutral-400 block text-[11px]">typeof window.speechSynthesis</span>
                <span className={`font-mono font-bold text-sm ${hasWebSpeech ? 'text-[#00ff41]' : 'text-red-400'}`}>
                  {typeof window !== 'undefined' ? typeof (window as any).speechSynthesis : 'undefined'}
                </span>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                <span className="text-neutral-400 block text-[11px]">getVoices().length</span>
                <span className={`font-mono font-bold text-sm ${voices.length > 0 ? 'text-[#00ff41]' : 'text-amber-400'}`}>
                  {voices.length} {voices.length > 0 ? 'voices' : '(empty)'}
                </span>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                <span className="text-neutral-400 block text-[11px]">voiceschanged Event</span>
                <span className={`font-mono font-bold text-xs ${voicesChangedFired ? 'text-[#00ff41]' : 'text-neutral-500'}`}>
                  {voicesChangedFired ? `Fired (${voicesChangedCount}x)` : 'Not fired yet'}
                </span>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                <span className="text-neutral-400 block text-[11px]">speechSynthesis.speaking</span>
                <span className="font-mono font-bold text-xs text-neutral-300">
                  {typeof window !== 'undefined' && window.speechSynthesis?.speaking ? 'TRUE' : 'false'}
                </span>
              </div>
            </div>
          </div>

          {/* Test Input & Action Controls */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 space-y-4">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-300">
              Test Utterance Text
            </h2>

            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3.5 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 outline-none focus:border-[#00ff41]"
            />

            {/* Test Buttons */}
            <div className="space-y-3 pt-1">
              <div className="text-[11px] font-mono text-neutral-400 font-semibold">1. Standard Web Speech API (window.speechSynthesis)</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestWebSpeech}
                  disabled={isSpeakingWeb}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#00ff41] py-3 text-xs font-bold uppercase tracking-wider text-neutral-950 hover:bg-[#00ff41]/90 active:scale-95 disabled:opacity-50 transition-all shadow-[0_0_12px_rgba(0,255,65,0.2)]"
                >
                  <Play size={14} className="fill-current" />
                  <span>{isSpeakingWeb ? 'Speaking (Web)...' : 'Test Web Speech API'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleStopWebSpeech}
                  className="px-4 flex items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 active:scale-95 transition-all"
                  title="Cancel Web Speech"
                >
                  <Square size={14} />
                </button>
              </div>

              <div className="text-[11px] font-mono text-neutral-400 font-semibold pt-2">2. Native Capacitor Plugin (@capacitor-community/text-to-speech)</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestCapacitorTTS}
                  disabled={isSpeakingCap}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-3 text-xs font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/20 active:scale-95 disabled:opacity-50 transition-all"
                >
                  <Play size={14} className="fill-current" />
                  <span>{isSpeakingCap ? 'Speaking (Plugin)...' : 'Test Capacitor Plugin'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleStopCapacitorTTS}
                  className="px-4 flex items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 active:scale-95 transition-all"
                  title="Cancel Plugin Speech"
                >
                  <Square size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Real-time Diagnostics Log Box */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-300">
                On-Screen Diagnostic Event Log
              </h2>
              <button
                type="button"
                onClick={() => setLogs([])}
                className="text-[10px] font-mono text-neutral-400 hover:text-neutral-200 uppercase"
              >
                Clear Log
              </button>
            </div>

            <div
              ref={logRef}
              className="h-64 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950 p-3 font-mono text-[11px] space-y-1.5"
            >
              {logs.length === 0 ? (
                <div className="text-neutral-600 italic">No events logged yet. Tap a test button above.</div>
              ) : (
                logs.map((log, i) => {
                  let color = 'text-neutral-300'
                  if (log.type === 'success') color = 'text-[#00ff41]'
                  if (log.type === 'error') color = 'text-red-400 font-bold'
                  if (log.type === 'warn') color = 'text-amber-400'

                  return (
                    <div key={i} className="leading-snug break-words">
                      <span className="text-neutral-500 mr-2">{log.time}</span>
                      <span className="text-neutral-400 font-semibold mr-1.5">[{log.source}]</span>
                      <span className={color}>{log.message}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Detected Voices List */}
          {voices.length > 0 && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 space-y-3">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-300">
                Available Voices ({voices.length})
              </h2>
              <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs font-mono">
                {voices.slice(0, 15).map((v, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 p-2 text-neutral-300">
                    <span className="truncate flex-1">{v.name}</span>
                    <span className="text-neutral-500 text-[10px] ml-2 shrink-0">{v.lang} {v.default ? '(default)' : ''}</span>
                  </div>
                ))}
                {voices.length > 15 && (
                  <div className="text-center text-neutral-500 text-[11px] pt-1">
                    ...and {voices.length - 15} more voices
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default TTSTest
