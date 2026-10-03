import { Preferences } from '@capacitor/preferences'
import { GauntletGameMode } from '../lib/gauntlet'

const GAUNTLET_STORAGE_KEY = 'ecengine_companion_gauntlet_stats_v1'

export interface GauntletStats {
  survivalHighScore: number
  survivalBestStreak: number
  timetrialHighScore: number
  timetrialBestStreak: number
  totalGames: number
}

const DEFAULT_STATS: GauntletStats = {
  survivalHighScore: 0,
  survivalBestStreak: 0,
  timetrialHighScore: 0,
  timetrialBestStreak: 0,
  totalGames: 0,
}

export const gauntletStorageService = {
  async getStats(): Promise<GauntletStats> {
    try {
      const { value } = await Preferences.get({ key: GAUNTLET_STORAGE_KEY })
      if (!value) return DEFAULT_STATS
      const parsed = JSON.parse(value)
      return {
        ...DEFAULT_STATS,
        ...parsed,
      }
    } catch {
      return DEFAULT_STATS
    }
  },

  async recordRun(
    mode: GauntletGameMode,
    score: number,
    streak: number,
  ): Promise<{ isNewHighScore: boolean; isNewBestStreak: boolean; updatedStats: GauntletStats }> {
    const current = await this.getStats()
    let isNewHighScore = false
    let isNewBestStreak = false

    const updated: GauntletStats = {
      ...current,
      totalGames: current.totalGames + 1,
    }

    if (mode === 'survival') {
      if (score > current.survivalHighScore) {
        updated.survivalHighScore = score
        isNewHighScore = true
      }
      if (streak > current.survivalBestStreak) {
        updated.survivalBestStreak = streak
        isNewBestStreak = true
      }
    } else {
      if (score > current.timetrialHighScore) {
        updated.timetrialHighScore = score
        isNewHighScore = true
      }
      if (streak > current.timetrialBestStreak) {
        updated.timetrialBestStreak = streak
        isNewBestStreak = true
      }
    }

    try {
      await Preferences.set({
        key: GAUNTLET_STORAGE_KEY,
        value: JSON.stringify(updated),
      })
    } catch (err) {
      console.warn('[gauntletStorage] Failed to save stats:', err)
    }

    return { isNewHighScore, isNewBestStreak, updatedStats: updated }
  },
}
