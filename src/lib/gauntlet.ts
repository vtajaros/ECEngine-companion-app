/**
 * gauntlet.ts (Companion Port)
 * Pure arcade gameplay mechanics, scoring formulas, par-time estimation,
 * and survival difficulty ramps for ECEngine Companion on Android.
 */

import { Subject } from '../types'

export type AnswerOutcome = 'correct' | 'wrong' | 'skipped' | 'timeout'

export type GauntletGameMode = 'survival' | 'timetrial'

export interface GauntletArcadeConfig {
  mode: GauntletGameMode
  subjects: Subject[]
  durationSec: number        // For Time Trial: 300 (5m), 600 (10m), 1500 (25m), 3600 (1 hr)
  perQuestionSec: number     // For Survival: 30, 60, 120, 0 (0 = unlimited)
  startingLives: number      // For Survival: 3, 5, 0 (0 = unlimited)
  tosTopicIds?: string[]     // Optional array of selected TOS topic IDs
  tosTopicId?: string | null // Primary topic ID if single or first selected
}

export const DURATION_PRESETS = [
  { label: '5m', sec: 5 * 60 },
  { label: '10m', sec: 10 * 60 },
  { label: '25m', sec: 25 * 60 },
  { label: '1 hr', sec: 60 * 60 },
]

export const SURVIVAL_LIVES_PRESETS = [
  { label: '3 LIVES', lives: 3 },
  { label: '5 LIVES', lives: 5 },
  { label: 'UNLIMITED', lives: 0 },
]

export const SURVIVAL_TIME_PRESETS = [
  { label: '30 SECONDS', sec: 30 },
  { label: '1 MINUTE', sec: 60 },
  { label: '2 MINUTES', sec: 120 },
  { label: 'UNLIMITED', sec: 0 },
]

export const LINGER_CORRECT_MS = 1800
export const LINGER_WRONG_MS = 1800

export const DEFAULT_GAUNTLET_CONFIG: GauntletArcadeConfig = {
  mode: 'survival',
  subjects: [],
  durationSec: 600,
  perQuestionSec: 30,
  startingLives: 3,
  tosTopicIds: [],
  tosTopicId: null,
}

export const TUNING = {
  // par estimation
  parBaseSec: 4.0,
  parPerStemChar: 0.025,
  parPerChoiceChar: 0.015,
  parNumericBonusSec: 3.5,
  parImageBonusSec: 4.0,
  parMinMs: 4000,
  parMaxMs: 60000,
  parRefMs: 12000,
  // weights
  weightMin: 0.6,
  weightMax: 2.0,
  // speed
  speedMin: 0.5,
  speedMax: 1.5,
  // scoring
  basePoints: 100,
  streakStep: 0.1,
  streakCap: 2.0,
  streakBonusInterval: 10,
  streakBonusPoints: 50,
  wrongBase: 50,
  fastWrongRatio: 0.25,
  fastWrongMult: 1.5,
  // survival rewards
  lifeBonusStreakInterval: 10, // +1 life every 10 consecutive correct answers
  lifeBonusScoreInterval: 20,  // +1 life every 20 total correct answers
  skipEarnInterval: 20,        // +1 skip credit every 20 consecutive correct answers
}

export interface SkipState {
  skipsAvailable: number
  skipEarnStreak: number
}

/**
 * Updates skip-earn streak and banked skip credits.
 * - 'correct': increments skipEarnStreak; every 20 consecutive correct awards +1 skip credit.
 * - 'wrong' | 'timeout': resets skipEarnStreak to 0.
 * - 'use_skip': consumes 1 skip credit and resets skipEarnStreak to 0.
 */
export function updateSkipState(
  current: SkipState,
  action: 'correct' | 'wrong' | 'timeout' | 'use_skip',
): SkipState {
  if (action === 'use_skip') {
    return {
      skipsAvailable: Math.max(0, current.skipsAvailable - 1),
      skipEarnStreak: 0,
    }
  }
  if (action === 'correct') {
    const nextStreak = current.skipEarnStreak + 1
    const earned = nextStreak > 0 && nextStreak % TUNING.skipEarnInterval === 0
    return {
      skipsAvailable: current.skipsAvailable + (earned ? 1 : 0),
      skipEarnStreak: nextStreak,
    }
  }
  return {
    skipsAvailable: current.skipsAvailable,
    skipEarnStreak: 0,
  }
}

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

export interface CardFeatures {
  stemLen: number
  choicesLen: number
  numericChoices: boolean
  hasImage: boolean
}

const NUMERIC_START = /^\s*[-+]?[\d.,$\\(]/

export function extractFeatures(mcq: { question?: string; choices?: string[]; imagePath?: string }): CardFeatures {
  const choices = Array.isArray(mcq.choices) ? mcq.choices : []
  const numericCount = choices.filter(c => NUMERIC_START.test(String(c))).length
  return {
    stemLen: (mcq.question ?? '').length,
    choicesLen: choices.reduce((n, c) => n + String(c).length, 0),
    numericChoices: choices.length > 0 && numericCount >= Math.max(2, Math.floor(choices.length / 2)),
    hasImage: Boolean(mcq.imagePath),
  }
}

/** Expected time (ms) a competent reviewee needs for this question. */
export function estimateParMs(f: CardFeatures): number {
  const T = TUNING
  const sec =
    T.parBaseSec +
    T.parPerStemChar * f.stemLen +
    T.parPerChoiceChar * f.choicesLen +
    (f.numericChoices ? T.parNumericBonusSec : 0) +
    (f.hasImage ? T.parImageBonusSec : 0)
  return Math.round(clamp(sec * 1000, T.parMinMs, T.parMaxMs))
}

/** Difficulty weight: longer par questions yield more points and cost less penalty. */
export function difficultyWeight(parMs: number): number {
  return clamp(parMs / TUNING.parRefMs, TUNING.weightMin, TUNING.weightMax)
}

/** Speed multiplier: 1.5x when answered in <= half par, 1.0x at par, 0.5x at >= 1.5x par. */
export function speedMultiplier(timeMs: number, parMs: number): number {
  const r = timeMs / Math.max(1, parMs)
  return clamp(2 - r, TUNING.speedMin, TUNING.speedMax)
}

export interface ScoreInput {
  outcome: AnswerOutcome
  timeMs: number
  parMs: number
  weight: number
  streakBefore: number
  scoreMult?: number
}

export interface ScoreResult {
  points: number
  speed: number
  streakMult: number
  streakAfter: number
  fastWrong: boolean
  streakBonus: number
}

export function scoreAnswer(i: ScoreInput): ScoreResult {
  const T = TUNING
  const speed = speedMultiplier(i.timeMs, i.parMs)
  const mult = i.scoreMult ?? 1

  if (i.outcome === 'correct') {
    const streakMult = Math.min(T.streakCap, 1 + T.streakStep * i.streakBefore)
    const streakAfter = i.streakBefore + 1
    const isMilestone = streakAfter > 0 && streakAfter % T.streakBonusInterval === 0
    const streakBonus = isMilestone ? Math.max(1, Math.round(T.streakBonusPoints * mult)) : 0
    const basePoints = Math.round(T.basePoints * i.weight * speed * streakMult * mult)
    return {
      points: Math.max(1, basePoints + streakBonus),
      speed,
      streakMult,
      streakAfter,
      fastWrong: false,
      streakBonus,
    }
  }

  if (i.outcome === 'skipped') {
    const streakMult = Math.min(T.streakCap, 1 + T.streakStep * i.streakBefore)
    return { points: 0, speed, streakMult, streakAfter: i.streakBefore, fastWrong: false, streakBonus: 0 }
  }

  // wrong or timeout: light questions cost more, heavy questions cost less
  const fastWrong = i.outcome === 'wrong' && i.timeMs < i.parMs * T.fastWrongRatio
  const penalty = Math.round((T.wrongBase / i.weight) * (fastWrong ? T.fastWrongMult : 1) * mult)
  return { points: -Math.max(1, penalty), speed, streakMult: 1, streakAfter: 0, fastWrong, streakBonus: 0 }
}

/** True when a correct answer streak awards a bonus life (every 10-streak in Survival). */
export function isLifeBonusStreak(streak: number): boolean {
  return streak > 0 && streak % TUNING.lifeBonusStreakInterval === 0
}

/** True when score milestone (every 20 correct answers) in survival mode awards a bonus life. */
export function isScoreLifeBonus(correctCount: number): boolean {
  return correctCount > 0 && correctCount % TUNING.lifeBonusScoreInterval === 0
}

/** Survival mode difficulty ramp: gradually targets heavier questions as streak increases. */
export function rampTargetWeight(streak: number): number {
  return clamp(0.85 + 0.03 * streak, TUNING.weightMin, TUNING.weightMax)
}

/** Picks candidate index near the target difficulty weight. */
export function pickNextIndex(weights: number[], streak: number, rand: () => number = Math.random): number {
  if (weights.length === 0) return -1
  const target = rampTargetWeight(streak)
  const ranked = weights
    .map((w, i) => ({ i, d: Math.abs(w - target) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
  const pool = ranked.slice(0, Math.min(5, ranked.length))
  const k = Math.min(pool.length - 1, Math.floor(rand() * pool.length))
  return pool[k].i
}
