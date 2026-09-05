import { useEffect, useCallback } from 'react'
import { ttsService } from '../services/tts.service'

/**
 * useTTS — Companion-specific TTS hook delegating to the singleton TTSService.
 * Pre-warms the native engine on mount and delegates speak/stop/isSpeaking to the service.
 */
export function useTTS() {
  useEffect(() => {
    ttsService.prewarm()
    return () => {
      ttsService.stop()
    }
  }, [])

  const speak = useCallback(async (rawText: string, lang = 'en-US', rate = 1.0) => {
    return ttsService.speak(rawText, lang, rate)
  }, [])

  const stop = useCallback(async () => {
    return ttsService.stop()
  }, [])

  const isSpeaking = useCallback(() => {
    return ttsService.getIsSpeaking()
  }, [])

  return { speak, stop, isSpeaking }
}

