import { useRef, useCallback } from 'react'
import wrongSfx from '../assets/sounds/wrong.wav'

export type SoundEvent = 'correct' | 'wrong' | 'roundComplete' | 'finish'

/**
 * useSound — Companion port of desktop's useSound.ts.
 *
 * Deviation from desktop: no volume/mute/custom-wrong-sound settings UI
 * exists in Companion yet, so this plays at fixed full volume, unmuted,
 * with the custom wrong.wav sound always enabled (falls back to a
 * synthesized tone if the file fails to decode). Porting a settings UI
 * for volume/mute is out of scope for this pass.
 *
 * Uses the Web Audio API (AudioContext + oscillators), which runs fine
 * inside a Capacitor WebView — no native plugin needed, unlike TTS.
 */

function createAudioContext(): AudioContext | null {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    return AudioContextClass ? new AudioContextClass() : null
  } catch {
    return null
  }
}

function playCorrectSound(ctx: AudioContext) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.connect(g); g.connect(ctx.destination)
  o.type = 'sine'
  o.frequency.setValueAtTime(523.25, ctx.currentTime)
  o.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08)
  g.gain.setValueAtTime(0.18, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
  o.start(ctx.currentTime)
  o.stop(ctx.currentTime + 0.3)
}

function playSynthWrongSound(ctx: AudioContext) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.connect(g); g.connect(ctx.destination)
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(220, ctx.currentTime)
  o.frequency.setValueAtTime(180, ctx.currentTime + 0.1)
  g.gain.setValueAtTime(0.12, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
  o.start(ctx.currentTime)
  o.stop(ctx.currentTime + 0.25)
}

function playRoundCompleteSound(ctx: AudioContext) {
  const notes = [523.25, 659.25, 783.99]
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sine'
    o.frequency.value = freq
    const t = ctx.currentTime + i * 0.1
    g.gain.setValueAtTime(0.15, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    o.start(t)
    o.stop(t + 0.35)
  })
}

function playFinishSound(ctx: AudioContext) {
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sine'
    o.frequency.value = freq
    const t = ctx.currentTime + i * 0.12
    g.gain.setValueAtTime(0.18, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    o.start(t)
    o.stop(t + 0.5)
  })
}

let cachedWrongBuffer: AudioBuffer | null = null

function playCustomWrongSound(ctx: AudioContext) {
  const playBuf = (decoded: AudioBuffer) => {
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = decoded
    gain.gain.value = 0.6
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start(ctx.currentTime)
  }

  if (cachedWrongBuffer) {
    playBuf(cachedWrongBuffer)
    return
  }

  fetch(wrongSfx)
    .then((res) => res.arrayBuffer())
    .then((buf) => ctx.decodeAudioData(buf))
    .then((decoded) => {
      cachedWrongBuffer = decoded
      playBuf(decoded)
    })
    .catch(() => {
      playSynthWrongSound(ctx)
    })
}

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = createAudioContext()
    }
    if (ctxRef.current?.state === 'suspended') {
      ctxRef.current.resume()
    }
    return ctxRef.current
  }, [])

  const play = useCallback(
    (event: SoundEvent) => {
      const ctx = getCtx()
      if (!ctx) return
      try {
        switch (event) {
          case 'correct':
            playCorrectSound(ctx)
            break
          case 'wrong':
            playCustomWrongSound(ctx)
            break
          case 'roundComplete':
            playRoundCompleteSound(ctx)
            break
          case 'finish':
            playFinishSound(ctx)
            break
        }
      } catch {
        // Audio failures are non-fatal
      }
    },
    [getCtx]
  )

  return { play }
}
