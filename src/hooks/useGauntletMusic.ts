import gauntletBgUrl from '../assets/sounds/gauntletbg.mp3'
import lowHealthUrl from '../assets/sounds/lowhealth_quiet.mp3'
import { App as CapacitorApp } from '@capacitor/app'
import { getSoundVolume, getSoundsMuted, prewarmSounds } from './useSound'

export type MusicRegion =
  | 'stealth'
  | 'enemiesNearby'
  | 'battle1'
  | 'battle2'
  | 'battle3'
  | 'combatOver'

export interface RegionBounds {
  start: number
  end: number
  loop: boolean
}

export const MUSIC_REGIONS: Record<MusicRegion, RegionBounds> = {
  stealth: { start: 0, end: 53, loop: true },
  enemiesNearby: { start: 54, end: 78, loop: true },
  battle1: { start: 78, end: 105, loop: true },
  battle2: { start: 106, end: 130, loop: true },
  battle3: { start: 131, end: 157, loop: true },
  combatOver: { start: 158, end: 217, loop: false },
}

const CROSSFADE_SEC = 1.8

// Module-level singletons for audio context, cached buffer, and active playback
let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null
let cachedAudioBuffer: AudioBuffer | null = null
let loadingPromise: Promise<AudioBuffer | null> | null = null

// Low-health overlay layer singletons
let cachedLowHealthBuffer: AudioBuffer | null = null
let lowHealthLoadingPromise: Promise<AudioBuffer | null> | null = null
let lowHealthSource: AudioBufferSourceNode | null = null
let lowHealthGain: GainNode | null = null
let fadingLowHealthSource: AudioBufferSourceNode | null = null
let fadingLowHealthGain: GainNode | null = null
let fadingLowHealthTimeout: ReturnType<typeof setTimeout> | null = null
let isLowHealthActive = false

let currentRegion: MusicRegion | null = null
let activeSource: AudioBufferSourceNode | null = null
let activeGain: GainNode | null = null
let isStarted = false

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtxClass) return null
    if (!audioCtx) {
      audioCtx = new AudioCtxClass()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    return audioCtx
  } catch (err) {
    console.warn('[useGauntletMusic] AudioContext creation/resume failed:', err)
    return null
  }
}

function syncMasterVolume() {
  if (!masterGain || !audioCtx) return
  const isMuted = getSoundsMuted()
  const vol = getSoundVolume()
  const targetGain = isMuted ? 0 : vol * 0.75
  try {
    masterGain.gain.setValueAtTime(targetGain, audioCtx.currentTime)
  } catch {
    /* ignore */
  }
}

function getMasterGain(ctx: AudioContext): GainNode {
  if (!masterGain) {
    masterGain = ctx.createGain()
    masterGain.connect(ctx.destination)
    syncMasterVolume()
  }
  return masterGain
}

// React to global volume/mute changes
if (typeof window !== 'undefined') {
  window.addEventListener('ecengine:sound:change', () => {
    syncMasterVolume()
  })

  // Pause/resume music when the app goes to background or screen is locked
  const handleAppVisibilityChange = (hidden: boolean) => {
    if (!audioCtx) return
    if (hidden) {
      // Instantly silence master gain to prevent any leakage while Android suspends threads
      if (masterGain) {
        try {
          masterGain.gain.setValueAtTime(0, audioCtx.currentTime)
        } catch {
          /* ignore */
        }
      }
      // Suspend the audio context to stop playback on lock/background
      if (audioCtx.state === 'running') {
        audioCtx.suspend().catch(() => {})
      }
    } else {
      // Resume playback when coming back to foreground
      if (isStarted) {
        if (audioCtx.state === 'suspended') {
          audioCtx
            .resume()
            .then(() => {
              syncMasterVolume()
            })
            .catch(() => {})
        } else {
          syncMasterVolume()
        }
      }
    }
  }

  document.addEventListener('visibilitychange', () => {
    handleAppVisibilityChange(document.hidden)
  })

  // Capacitor native listener for reliable Android background detection
  CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    handleAppVisibilityChange(!isActive)
  }).catch(() => {})

  // Mobile gesture unlock listener: in case AudioContext suspended due to autoplay policy
  const unlockAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended' && isStarted) {
      audioCtx
        .resume()
        .then(() => {
          syncMasterVolume()
        })
        .catch(() => {})
    }
  }
  window.addEventListener('click', unlockAudio)
  window.addEventListener('touchstart', unlockAudio, { passive: true })
}

export function initGauntletAudio() {
  const ctx = getAudioContext()
  if (ctx) {
    getMasterGain(ctx)
    loadAudioBuffer(ctx).catch(() => {})
    prewarmSounds(ctx)
  }
}

async function loadAudioBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
  if (cachedAudioBuffer) return cachedAudioBuffer
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    try {
      const res = await fetch(gauntletBgUrl)
      if (!res || typeof res.arrayBuffer !== 'function') return null
      const arrayBuf = await res.arrayBuffer()
      const audioBuf = await ctx.decodeAudioData(arrayBuf)
      cachedAudioBuffer = audioBuf
      return audioBuf
    } catch (err) {
      console.warn('[useGauntletMusic] Failed to load/decode gauntletbg.mp3:', err)
      return null
    } finally {
      loadingPromise = null
    }
  })()

  return loadingPromise
}

async function loadLowHealthBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
  if (cachedLowHealthBuffer) return cachedLowHealthBuffer
  if (lowHealthLoadingPromise) return lowHealthLoadingPromise

  lowHealthLoadingPromise = (async () => {
    try {
      const res = await fetch(lowHealthUrl)
      if (!res || typeof res.arrayBuffer !== 'function') return null
      const arrayBuf = await res.arrayBuffer()
      const audioBuf = await ctx.decodeAudioData(arrayBuf)
      cachedLowHealthBuffer = audioBuf
      return audioBuf
    } catch (err) {
      console.warn('[useGauntletMusic] Failed to load/decode lowhealth_quiet.mp3:', err)
      return null
    } finally {
      lowHealthLoadingPromise = null
    }
  })()

  return lowHealthLoadingPromise
}

function startLowHealthLayer(ctx: AudioContext, buffer: AudioBuffer) {
  try {
    const now = ctx.currentTime

    if (fadingLowHealthTimeout) {
      clearTimeout(fadingLowHealthTimeout)
      fadingLowHealthTimeout = null
    }
    if (fadingLowHealthSource) {
      try {
        fadingLowHealthSource.stop()
        fadingLowHealthSource.disconnect()
        fadingLowHealthGain?.disconnect()
      } catch {
        /* ignore */
      }
      fadingLowHealthSource = null
      fadingLowHealthGain = null
    }
    if (lowHealthSource) {
      try {
        lowHealthSource.stop()
        lowHealthSource.disconnect()
        lowHealthGain?.disconnect()
      } catch {
        /* ignore */
      }
      lowHealthSource = null
      lowHealthGain = null
    }

    const newSource = ctx.createBufferSource()
    newSource.buffer = buffer
    newSource.loop = true

    const newGain = ctx.createGain()
    newGain.gain.setValueAtTime(0.0001, now)
    newGain.gain.linearRampToValueAtTime(1.0, now + CROSSFADE_SEC)

    newSource.connect(newGain)
    newGain.connect(getMasterGain(ctx))
    newSource.start(now)

    lowHealthSource = newSource
    lowHealthGain = newGain
  } catch (err) {
    console.warn('[useGauntletMusic] Error starting low-health overlay:', err)
  }
}

function stopLowHealthLayer(fadeDuration = CROSSFADE_SEC) {
  if (!audioCtx || !lowHealthSource || !lowHealthGain) {
    lowHealthSource = null
    lowHealthGain = null
    return
  }

  if (fadingLowHealthTimeout) {
    clearTimeout(fadingLowHealthTimeout)
    fadingLowHealthTimeout = null
  }
  if (fadingLowHealthSource && fadingLowHealthGain) {
    try {
      fadingLowHealthSource.stop()
      fadingLowHealthSource.disconnect()
      fadingLowHealthGain.disconnect()
    } catch {
      /* ignore */
    }
  }

  const source = lowHealthSource
  const gain = lowHealthGain
  lowHealthSource = null
  lowHealthGain = null

  fadingLowHealthSource = source
  fadingLowHealthGain = gain

  try {
    const now = audioCtx.currentTime
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(0.0001, now + fadeDuration)
    source.stop(now + fadeDuration + 0.1)
    fadingLowHealthTimeout = setTimeout(() => {
      try {
        source.disconnect()
        gain.disconnect()
      } catch {
        /* ignore */
      }
      if (fadingLowHealthSource === source) {
        fadingLowHealthSource = null
        fadingLowHealthGain = null
      }
      fadingLowHealthTimeout = null
    }, (fadeDuration + 0.2) * 1000)
  } catch {
    try {
      source.disconnect()
      gain.disconnect()
    } catch {
      /* ignore */
    }
    fadingLowHealthSource = null
    fadingLowHealthGain = null
  }
}

function setLowHealth(active: boolean) {
  if (isLowHealthActive === active) return
  isLowHealthActive = active

  if (active) {
    const ctx = getAudioContext()
    if (!ctx) return

    if (!cachedLowHealthBuffer) {
      loadLowHealthBuffer(ctx).then(buf => {
        if (buf && isLowHealthActive) {
          startLowHealthLayer(ctx, buf)
        }
      })
      return
    }

    startLowHealthLayer(ctx, cachedLowHealthBuffer)
  } else {
    stopLowHealthLayer(CROSSFADE_SEC)
  }
}

function performCrossfade(ctx: AudioContext, buffer: AudioBuffer, region: MusicRegion) {
  const bounds = MUSIC_REGIONS[region]
  if (!bounds) return

  try {
    const now = ctx.currentTime

    const newSource = ctx.createBufferSource()
    newSource.buffer = buffer
    newSource.loop = bounds.loop
    if (bounds.loop) {
      newSource.loopStart = bounds.start
      newSource.loopEnd = bounds.end
    }

    const newGain = ctx.createGain()
    newGain.gain.setValueAtTime(0.0001, now)
    newGain.gain.linearRampToValueAtTime(1.0, now + CROSSFADE_SEC)

    newSource.connect(newGain)
    newGain.connect(getMasterGain(ctx))
    newSource.start(now, bounds.start)

    const outgoingSource = activeSource
    const outgoingGain = activeGain

    if (outgoingSource && outgoingGain) {
      outgoingGain.gain.setValueAtTime(outgoingGain.gain.value, now)
      outgoingGain.gain.linearRampToValueAtTime(0.0001, now + CROSSFADE_SEC)
      try {
        outgoingSource.stop(now + CROSSFADE_SEC + 0.1)
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        try {
          outgoingSource.disconnect()
          outgoingGain.disconnect()
        } catch {
          /* ignore */
        }
      }, (CROSSFADE_SEC + 0.2) * 1000)
    }

    activeSource = newSource
    activeGain = newGain
  } catch (err) {
    console.warn('[useGauntletMusic] Error transitioning region:', err)
  }
}

function transitionToRegion(region: MusicRegion) {
  if (!isStarted) {
    startMusic(region)
    return
  }
  if (currentRegion === region && activeSource) return

  currentRegion = region
  const ctx = getAudioContext()
  if (!ctx) return

  if (!cachedAudioBuffer) {
    loadAudioBuffer(ctx).then(buf => {
      if (buf && currentRegion === region && isStarted) {
        performCrossfade(ctx, buf, region)
      }
    })
    return
  }

  performCrossfade(ctx, cachedAudioBuffer, region)
}

function startMusic(initialRegion: MusicRegion = 'stealth') {
  isStarted = true
  syncMasterVolume()
  transitionToRegion(initialRegion)
}

function stopMusic(fadeDuration = 1.2) {
  isStarted = false
  currentRegion = null
  isLowHealthActive = false
  stopLowHealthLayer(fadeDuration)

  if (!audioCtx || !activeSource || !activeGain) return
  const now = audioCtx.currentTime
  const source = activeSource
  const gain = activeGain
  activeSource = null
  activeGain = null

  try {
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(0.0001, now + fadeDuration)
    source.stop(now + fadeDuration + 0.1)
    setTimeout(() => {
      try {
        source.disconnect()
        gain.disconnect()
      } catch {
        /* ignore */
      }
    }, (fadeDuration + 0.2) * 1000)
  } catch {
    /* ignore */
  }
}

/**
 * Calculates the target region for a timed run based on percentage of time remaining.
 * Gameplay floor is enemiesNearby (100-60%), battle1 (60-35%), battle2 (35-15%), battle3 (<15%).
 * Transitions begin ~2s before the boundary so crossfade finishes at the threshold.
 * Note: stealth is pre-run only and never returned during gameplay.
 */
export function getTimedMusicRegion(timeRemainingSec: number, totalDurationSec: number): MusicRegion {
  if (totalDurationSec <= 0) return 'battle3'
  const effectiveSec = Math.max(0, timeRemainingSec - 2)
  const pct = (effectiveSec / totalDurationSec) * 100

  if (pct >= 60) return 'enemiesNearby'
  if (pct >= 35) return 'battle1'
  if (pct >= 15) return 'battle2'
  return 'battle3'
}

/**
 * Calculates the target region for a survival run based on remaining lives.
 * Full lives = enemiesNearby, stepping down through battle1/battle2/battle3, 1 life = battle3.
 * Note: stealth is pre-run only and never returned during gameplay.
 */
export function getSurvivalMusicRegion(livesLeft: number, startingLives: number): MusicRegion {
  if (livesLeft <= 1) return 'battle3'
  if (livesLeft >= startingLives) return 'enemiesNearby'

  const ratio = (livesLeft - 1) / Math.max(1, startingLives - 1)
  if (ratio >= 0.66) return 'battle1'
  if (ratio >= 0.33) return 'battle2'
  return 'battle3'
}

const gauntletMusicController = {
  init: () => initGauntletAudio(),
  start: (initialRegion?: MusicRegion) => startMusic(initialRegion),
  setState: (region: MusicRegion) => transitionToRegion(region),
  setLowHealth: (active: boolean) => setLowHealth(active),
  stop: (fadeDuration?: number) => stopMusic(fadeDuration),
  getCurrentRegion: () => currentRegion,
  isLowHealthActive: () => isLowHealthActive,
}

/**
 * Hook to control adaptive Gauntlet background music.
 */
export function useGauntletMusic() {
  return gauntletMusicController
}

// For unit testing internal state resets
export function _resetMusicEngineForTest() {
  isStarted = false
  currentRegion = null
  audioCtx = null
  activeSource = null
  activeGain = null
  masterGain = null
  cachedAudioBuffer = null
  loadingPromise = null
  isLowHealthActive = false
  if (fadingLowHealthTimeout) {
    clearTimeout(fadingLowHealthTimeout)
    fadingLowHealthTimeout = null
  }
  lowHealthSource = null
  lowHealthGain = null
  fadingLowHealthSource = null
  fadingLowHealthGain = null
  cachedLowHealthBuffer = null
  lowHealthLoadingPromise = null
}
