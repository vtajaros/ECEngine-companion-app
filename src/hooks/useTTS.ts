import { useCallback, useRef } from 'react'
import { TextToSpeech } from '@capacitor-community/text-to-speech'

// ── Shared text cleaning pipeline ─────────────────────────────────────────────
// Ported VERBATIM from desktop's useTTS.ts (lines 29-67).
// Single source of truth for LaTeX stripping + symbol normalization.
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/\$[^$]*?\$/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/_{2,}/g, 'blank')
    .replace(/>=/g, ' greater than or equal to ')
    .replace(/<=/g, ' less than or equal to ')
    .replace(/!=/g, ' not equal to ')
    .replace(/==/g, ' equal to ')
    .replace(/=>/g, ' implies ')
    .replace(/>>>/g, ' much much greater than ')
    .replace(/<</g, ' much less than ')
    .replace(/>>/g, ' much greater than ')
    .replace(/>/g, ' greater than ')
    .replace(/</g, ' less than ')
    .replace(/±/g, ' plus or minus ')
    .replace(/×/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/≈/g, ' approximately equal to ')
    .replace(/≠/g, ' not equal to ')
    .replace(/≤/g, ' less than or equal to ')
    .replace(/≥/g, ' greater than or equal to ')
    .replace(/∞/g, ' infinity ')
    .replace(/√/g, ' square root of ')
    .replace(/π/g, ' pi ')
    .replace(/Ω/g, ' ohms ')
    .replace(/μ/g, ' micro ')
    .replace(/θ/g, ' theta ')
    .replace(/φ/g, ' phi ')
    .replace(/α/g, ' alpha ')
    .replace(/β/g, ' beta ')
    .replace(/γ/g, ' gamma ')
    .replace(/δ/g, ' delta ')
    .replace(/λ/g, ' lambda ')
    .replace(/ω/g, ' omega ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * useTTS — Companion-specific TTS hook using @capacitor-community/text-to-speech.
 *
 * Architecture note: This is a deliberate deviation from desktop's useTTS.ts.
 * Desktop uses window.speechSynthesis (Web Speech API) on Windows/macOS and
 * Piper via Electron IPC on Linux. Neither path works in Android's Capacitor
 * WebView (speechSynthesis is undefined). Companion uses the native
 * @capacitor-community/text-to-speech plugin exclusively, confirmed working
 * with 473 voices via the Android TTS engine in on-device testing.
 *
 * Guarantees (matching desktop's contract):
 * - Only one utterance plays at a time — stop() is called before every speak().
 * - LaTeX/HTML markup and math symbols are stripped before speaking (verbatim
 *   from desktop's cleanTextForSpeech, lines 29-67 of useTTS.ts).
 * - isSpeaking() reflects current playback state via a ref (no re-render).
 */
export function useTTS() {
  const isSpeakingRef = useRef(false)

  const speak = useCallback(async (rawText: string) => {
    if (!rawText) return
    const cleaned = cleanTextForSpeech(rawText)
    if (!cleaned) return

    try {
      // Cancel any in-flight speech before starting new speech —
      // mirrors desktop's stop()-before-speak discipline.
      await TextToSpeech.stop()
    } catch {
      // stop() may throw if nothing was speaking — ignore
    }

    try {
      isSpeakingRef.current = true
      await TextToSpeech.speak({
        text: cleaned,
        lang: 'en-US',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      })
    } catch (err) {
      console.warn('[useTTS] speak() failed:', err)
    } finally {
      isSpeakingRef.current = false
    }
  }, [])

  const stop = useCallback(async () => {
    try {
      await TextToSpeech.stop()
    } catch (err) {
      console.warn('[useTTS] stop() failed:', err)
    } finally {
      isSpeakingRef.current = false
    }
  }, [])

  return { speak, stop, isSpeaking: () => isSpeakingRef.current }
}
