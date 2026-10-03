import { useRef, useCallback } from 'react'
import wrongSfx from '../assets/sounds/wrong.wav'
import gameOverSfx from '../assets/sounds/gameover.mp3'
import plusOneSfx from '../assets/sounds/plusone.mp3'

export type SoundEvent = 'correct' | 'wrong' | 'roundComplete' | 'finish' | 'lifeBonus' | 'streakMilestone' | 'gameOver'

const SESSION_MUTE_KEY = 'ecengine_sounds_muted'
const SESSION_VOLUME_KEY = 'ecengine_sound_volume'

let memoryVolume = 1
let memoryMuted = false

export function getSoundVolume(): number {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(SESSION_VOLUME_KEY)
      if (val !== null) {
        const parsed = parseFloat(val)
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          return parsed
        }
      }
    }
    return memoryVolume
  } catch {
    return memoryVolume
  }
}

export function setSoundVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume))
  memoryVolume = clamped
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_VOLUME_KEY, String(clamped))
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ecengine:sound:change'))
  }
}

export function getSoundsMuted(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(SESSION_MUTE_KEY) === 'true'
    }
    return memoryMuted
  } catch {
    return memoryMuted
  }
}

export function setSoundsMuted(muted: boolean): void {
  memoryMuted = muted
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_MUTE_KEY, String(muted))
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ecengine:sound:change'))
  }
}

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

let cachedWrongBuffer: AudioBuffer | null = null
let cachedGameOverBuffer: AudioBuffer | null = null
let cachedPlusOneBuffer: AudioBuffer | null = null

function playBuffer(ctx: AudioContext, buffer: AudioBuffer, volume = 0.6) {
  const vol = getSoundVolume()
  const source = ctx.createBufferSource()
  const gain = ctx.createGain()
  source.buffer = buffer
  gain.gain.value = volume * vol
  source.connect(gain)
  gain.connect(ctx.destination)
  source.start(ctx.currentTime)
}

function playCorrectSound(ctx: AudioContext) {
  const vol = getSoundVolume()
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.connect(g)
  g.connect(ctx.destination)
  o.type = 'sine'
  o.frequency.setValueAtTime(523.25, ctx.currentTime)
  o.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08)
  g.gain.setValueAtTime(0.18 * vol, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
  o.start(ctx.currentTime)
  o.stop(ctx.currentTime + 0.3)
}

function playCustomWrongSound(ctx: AudioContext) {
  if (cachedWrongBuffer) {
    playBuffer(ctx, cachedWrongBuffer, 0.6)
    return
  }
  fetch(wrongSfx)
    .then((res) => res.arrayBuffer())
    .then((buf) => ctx.decodeAudioData(buf))
    .then((decoded) => {
      cachedWrongBuffer = decoded
      playBuffer(ctx, decoded, 0.6)
    })
    .catch(() => {})
}

function playCustomGameOverSound(ctx: AudioContext) {
  if (cachedGameOverBuffer) {
    playBuffer(ctx, cachedGameOverBuffer, 0.7)
    return
  }
  fetch(gameOverSfx)
    .then((res) => res.arrayBuffer())
    .then((buf) => ctx.decodeAudioData(buf))
    .then((decoded) => {
      cachedGameOverBuffer = decoded
      playBuffer(ctx, decoded, 0.7)
    })
    .catch(() => {})
}

function playCustomPlusOneSound(ctx: AudioContext) {
  if (cachedPlusOneBuffer) {
    playBuffer(ctx, cachedPlusOneBuffer, 0.65)
    return
  }
  fetch(plusOneSfx)
    .then((res) => res.arrayBuffer())
    .then((buf) => ctx.decodeAudioData(buf))
    .then((decoded) => {
      cachedPlusOneBuffer = decoded
      playBuffer(ctx, decoded, 0.65)
    })
    .catch(() => {})
}

function playRoundCompleteSound(ctx: AudioContext) {
  const vol = getSoundVolume()
  const notes = [523.25, 659.25, 783.99]
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.type = 'sine'
    o.frequency.value = freq
    const t = ctx.currentTime + i * 0.1
    g.gain.setValueAtTime(0.15 * vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    o.start(t)
    o.stop(t + 0.35)
  })
}

function playFinishSound(ctx: AudioContext) {
  const vol = getSoundVolume()
  const chords = [
    [523.25, 659.25, 783.99],
    [587.33, 698.46, 880.0],
    [659.25, 830.61, 987.77],
    [783.99, 987.77, 1174.66],
  ]
  chords.forEach((chord, step) => {
    const t = ctx.currentTime + step * 0.12
    chord.forEach((freq) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      o.type = 'triangle'
      o.frequency.value = freq
      g.gain.setValueAtTime(0.08 * vol, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
      o.start(t)
      o.stop(t + 0.3)
    })
  })
}

function playStreakMilestoneSound(ctx: AudioContext) {
  const vol = getSoundVolume()
  const notes = [440, 554.37, 659.25, 880]
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.type = 'sine'
    o.frequency.value = freq
    const t = ctx.currentTime + i * 0.06
    g.gain.setValueAtTime(0.12 * vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    o.start(t)
    o.stop(t + 0.25)
  })
}

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = createAudioContext()
    }
    if (ctxRef.current?.state === 'suspended') {
      ctxRef.current.resume().catch(() => {})
    }
    return ctxRef.current
  }, [])

  const play = useCallback(
    (event: SoundEvent) => {
      if (getSoundsMuted()) return
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
          case 'lifeBonus':
            playCustomPlusOneSound(ctx)
            break
          case 'streakMilestone':
            playStreakMilestoneSound(ctx)
            break
          case 'gameOver':
            playCustomGameOverSound(ctx)
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

