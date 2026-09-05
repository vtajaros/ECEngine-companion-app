import { TextToSpeech, QueueStrategy } from '@capacitor-community/text-to-speech'
import { App } from '@capacitor/app'

/**
 * Shared text cleaning pipeline for TTS.
 * Strips LaTeX delimiters, HTML markup, and normalizes engineering and math symbols.
 */
export function cleanTextForSpeech(text: string): string {
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
 * Splits text into intelligent sentence chunks for neural TTS streaming.
 *
 * Rules:
 * 1. NEVER split on commas (,), semicolons (;), colons (:), or hyphens (-).
 *    Mid-sentence clause splitting causes jarring ~1-second silence gaps on Android TTS.
 * 2. Only split on strong sentence terminators (. ! ?) followed by whitespace and a capitalized word or digit.
 * 3. Protect decimals (e.g. 12.5 V, 0.7 mA) and technical abbreviations (e.g., i.e., vs., fig., approx., no.).
 * 4. Merge tiny fragments (< 12 characters, e.g. "Fig. 1." or "Step 1.") with subsequent sentences
 *    while preserving complete sentences (even short ones like "Find the power.") as independent chunks.
 */
export function splitIntoChunks(text: string, minChunkLength = 12): string[] {
  if (!text) return []
  const normalized = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  // Protect common technical and academic abbreviations from sentence splitting
  const ABBREV_REGEX = /\b(e\.g|i\.e|vs|fig|approx|no|vol|dept|est|ref|dr|mr|mrs|prof)\./gi
  const protectedText = normalized.replace(ABBREV_REGEX, '$1__DOT__')

  // Split ONLY on strong sentence terminators followed by whitespace and a capitalized word or digit
  const rawSegments = protectedText
    .split(/(?<=[.?!])\s+(?=[A-Z0-9"']|$)/g)
    .map((s) => s.replace(/__DOT__/g, '.').trim())
    .filter(Boolean)

  if (rawSegments.length <= 1) {
    return rawSegments
  }

  // Merge tiny fragments (< minChunkLength) to avoid isolated prefixes like "Fig. 1."
  const chunks: string[] = []
  let buffer = ''

  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i]
    if (!buffer) {
      buffer = seg
    } else if (buffer.length < minChunkLength) {
      buffer = buffer + ' ' + seg
    } else {
      chunks.push(buffer)
      buffer = seg
    }
  }

  if (buffer) {
    if (chunks.length > 0 && buffer.length < minChunkLength) {
      chunks[chunks.length - 1] = chunks[chunks.length - 1] + ' ' + buffer
    } else {
      chunks.push(buffer)
    }
  }

  return chunks
}

/**
 * Persistent singleton Text-to-Speech service.
 * Pipelined sentence chunking eliminates neural engine latency by speaking Chunk 0
 * immediately via QueueStrategy.Flush and pre-synthesizing subsequent chunks via QueueStrategy.Add.
 */
export class TTSService {
  private isSpeaking = false
  private currentUtteranceId = 0
  private isWarmedUp = false
  private cancelActiveSpeech: (() => void) | null = null

  constructor() {
    this.initBackgroundListeners()
  }

  /**
   * Attaches listeners for app backgrounding and screen locking to stop playback immediately.
   */
  private initBackgroundListeners(): void {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stop()
        }
      })

      try {
        App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            this.stop()
          }
        })
      } catch (err) {
        console.warn('[TTSService] Failed to attach appStateChange listener:', err)
      }
    }
  }

  /**
   * Pre-warms the Android TTS engine on app start to bind the native service IPC early.
   */
  public async prewarm(): Promise<void> {
    if (this.isWarmedUp) return
    try {
      await TextToSpeech.isLanguageSupported({ lang: 'en-US' })
      this.isWarmedUp = true
    } catch {
      // Ignored if engine is still binding
    }
  }

  /**
   * Speaks the provided text by chunking it into sentences.
   * Chunk 0 starts playback in ~200ms; Chunks 1..N pre-synthesize in Android's native queue.
   */
  public async speak(rawText: string, lang = 'en-US', rate = 1.0): Promise<void> {
    if (!rawText) return
    const cleaned = cleanTextForSpeech(rawText)
    if (!cleaned) return

    // Immediately stop any active speech before starting a new utterance
    if (this.isSpeaking) {
      await this.stop()
    }

    const utteranceId = ++this.currentUtteranceId
    const chunks = splitIntoChunks(cleaned)
    if (chunks.length === 0) return

    this.isSpeaking = true

    // Create an explicit cancellation trigger for this utterance sequence
    let cancelSession: () => void
    const cancelPromise = new Promise<never>((_, reject) => {
      cancelSession = () => reject(new Error('Speech cancelled'))
    })
    this.cancelActiveSpeech = cancelSession!

    try {
      // Dispatch Chunk 0 with QueueStrategy.Flush and subsequent chunks with QueueStrategy.Add.
      // Attach catch handler so cancelled chunks do not cause unhandled rejections.
      const chunkPromises = chunks.map((chunk, index) => {
        return TextToSpeech.speak({
          text: chunk,
          lang,
          rate,
          pitch: 1.0,
          volume: 1.0,
          category: 'ambient',
          queueStrategy: index === 0 ? QueueStrategy.Flush : QueueStrategy.Add,
        }).catch((err) => {
          // Silently ignore if utterance has been stopped or superseded
          if (this.currentUtteranceId !== utteranceId) return
          throw err
        })
      })

      await Promise.race([
        Promise.all(chunkPromises),
        cancelPromise,
      ])
    } catch (err) {
      if (this.currentUtteranceId === utteranceId) {
        console.warn('[TTSService] speak() failed:', err)
      }
    } finally {
      if (this.currentUtteranceId === utteranceId) {
        this.isSpeaking = false
        this.cancelActiveSpeech = null
      }
    }
  }

  /**
   * Immediately stops current speech, clears all native queued utterances,
   * and aborts pending synthesis promises.
   */
  public async stop(): Promise<void> {
    this.currentUtteranceId++
    this.isSpeaking = false
    if (this.cancelActiveSpeech) {
      this.cancelActiveSpeech()
      this.cancelActiveSpeech = null
    }
    try {
      await TextToSpeech.stop()
    } catch (err) {
      console.warn('[TTSService] stop() failed:', err)
    }
  }

  /**
   * Returns whether speech is currently in progress.
   */
  public getIsSpeaking(): boolean {
    return this.isSpeaking
  }
}

export const ttsService = new TTSService()

