import React, { useState, useEffect } from 'react'
import {
  Flame,
  Timer,
  ArrowLeft,
  Check,
  Zap,
  Play,
  Trophy,
} from 'lucide-react'
import { Subject } from '../../types'
import {
  GauntletArcadeConfig,
  DEFAULT_GAUNTLET_CONFIG,
  DURATION_PRESETS,
  SURVIVAL_LIVES_PRESETS,
  SURVIVAL_TIME_PRESETS,
} from '../../lib/gauntlet'
import { gauntletStorageService, GauntletStats } from '../../services/gauntlet-storage.service'
import { dbService } from '../../services/db.service'
import { SUBJECT_THEME_COLORS } from '../../lib/subjectColors'

interface GauntletArcadeHomeProps {
  onStartRun: (config: GauntletArcadeConfig) => void
  onExit: () => void
  cardCount: number
}

const SUBJECTS: Subject[] = ['MATH', 'GEAS', 'ELECS', 'EST']

export const GauntletArcadeHome: React.FC<GauntletArcadeHomeProps> = ({
  onStartRun,
  onExit,
}) => {
  const [config, setConfig] = useState<GauntletArcadeConfig>(DEFAULT_GAUNTLET_CONFIG)
  const [stats, setStats] = useState<GauntletStats | null>(null)
  const [poolSizes, setPoolSizes] = useState<Record<Subject, number>>({
    MATH: 0,
    GEAS: 0,
    ELECS: 0,
    EST: 0,
  })

  useEffect(() => {
    gauntletStorageService.getStats().then(setStats)
    dbService.getGauntletPoolSizes().then(setPoolSizes).catch(() => {})
  }, [])

  const toggleSubject = (subj: Subject) => {
    setConfig((prev) => {
      const isSelected = prev.subjects.includes(subj)
      if (isSelected) {
        return {
          ...prev,
          subjects: prev.subjects.filter((s) => s !== subj),
        }
      } else {
        return {
          ...prev,
          subjects: [...prev.subjects, subj],
        }
      }
    })
  }

  // Calculate difficulty multiplier for survival
  const getDifficultyMultiplier = () => {
    let mult = 1.0
    if (config.startingLives === 5) mult *= 0.8
    if (config.startingLives === 0) mult *= 0.5
    if (config.perQuestionSec === 60) mult *= 0.75
    if (config.perQuestionSec === 120) mult *= 0.5
    if (config.perQuestionSec === 0) mult *= 0.3
    return mult.toFixed(1)
  }

  return (
    <div className="flex h-full w-full flex-col bg-neutral-950 text-neutral-100 font-rajdhani select-none overflow-y-auto pb-10">
      {/* Header — matches desktop setup screen */}
      <div className="flex items-center justify-between border-b border-neutral-800/80 px-4 py-3 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onExit}
            className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200 active:scale-95 transition-all"
            title="Back to topics"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            {config.mode === 'survival' ? (
              <Flame size={18} className="text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
            ) : (
              <Timer size={18} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
            )}
            <h1 className="font-display text-sm font-bold tracking-wider uppercase text-neutral-100">
              {config.mode === 'survival' ? 'SURVIVAL SETUP' : 'TIME TRIAL SETUP'}
            </h1>
          </div>
        </div>

        {/* Top Right Best Record Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-800 bg-neutral-900/80 text-[11px] font-mono text-neutral-300">
          <Trophy size={12} className="text-amber-400" />
          <span className="text-neutral-400 font-sans font-semibold">BEST:</span>
          <span className="text-[#00ff41] font-bold">
            {(config.mode === 'survival'
              ? stats?.survivalHighScore
              : stats?.timetrialHighScore
            )?.toLocaleString() || 0}{' '}
            pts
          </span>
        </div>
      </div>

      <div className="flex-1 px-4 py-3.5 space-y-4 max-w-md mx-auto w-full">
        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 gap-1.5 bg-neutral-900/80 p-1 rounded-xl border border-neutral-800">
          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, mode: 'survival' }))}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-display uppercase tracking-wider font-bold transition-all active:scale-[0.98] ${
              config.mode === 'survival'
                ? 'bg-neutral-800 text-[#00ff41] shadow-[0_0_12px_rgba(0,255,65,0.2)] border border-[#00ff41]/50'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Flame size={14} className={config.mode === 'survival' ? 'text-[#00ff41]' : 'text-neutral-500'} />
            Survival
          </button>
          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, mode: 'timetrial' }))}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-display uppercase tracking-wider font-bold transition-all active:scale-[0.98] ${
              config.mode === 'timetrial'
                ? 'bg-neutral-800 text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.2)] border border-cyan-400/50'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Timer size={14} className={config.mode === 'timetrial' ? 'text-cyan-400' : 'text-neutral-500'} />
            Time Trial
          </button>
        </div>

        {/* SELECT SUBJECTS (Single row of 4 columns, matches desktop) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-wider text-neutral-300 font-bold font-display">
              SELECT SUBJECTS
            </span>
            <span className="text-[11px] text-neutral-500">
              Tap to toggle · Mix & match
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {SUBJECTS.map((s) => {
              const isSelected = config.subjects.includes(s)
              const count = poolSizes[s] ?? 0
              const theme = SUBJECT_THEME_COLORS[s]

              return (
                <div key={s} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleSubject(s)}
                    className={`w-full py-2.5 px-1 rounded-xl border flex items-center justify-center gap-1.5 font-display text-xs font-bold tracking-wide transition-all text-center select-none active:scale-95 ${
                      isSelected
                        ? `${theme.activeBorder} ${theme.activeBg} ${theme.activeText}`
                        : 'border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <span>{s}</span>
                    {isSelected && <Check size={11} className="stroke-[3]" />}
                  </button>
                  <span className="text-[10px] font-mono text-neutral-400 text-center whitespace-nowrap">
                    {count.toLocaleString()} cards
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* SURVIVAL SPECIFIC OPTIONS */}
        {config.mode === 'survival' && (
          <div className="space-y-4 pt-1">
            {/* STARTING LIVES */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-neutral-300 font-bold font-display">
                STARTING LIVES
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SURVIVAL_LIVES_PRESETS.map((p) => {
                  const isActive = config.startingLives === p.lives
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, startingLives: p.lives }))}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-display font-bold uppercase tracking-wider transition-all active:scale-95 ${
                        isActive
                          ? 'bg-[#ef4444] text-white shadow-[0_0_14px_rgba(239,68,68,0.45)] border border-[#ef4444]'
                          : 'border border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <Flame size={13} className={isActive ? 'text-white' : 'text-neutral-500'} />
                      <span>{p.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* PER-QUESTION TIME LIMIT */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-neutral-300 font-bold font-display">
                PER-QUESTION TIME LIMIT
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SURVIVAL_TIME_PRESETS.map((p) => {
                  const isActive = config.perQuestionSec === p.sec
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, perQuestionSec: p.sec }))}
                      className={`py-2 px-2 rounded-xl text-xs font-display font-bold uppercase tracking-wider transition-all active:scale-95 ${
                        isActive
                          ? 'bg-[#00ff41] text-[#0d0d0d] shadow-[0_0_12px_rgba(0,255,65,0.35)] border border-[#00ff41]'
                          : 'border border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* DIFFICULTY MULTIPLIER BAR */}
            <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/60 px-3.5 py-2.5 text-xs font-mono">
              <span className="text-neutral-400 uppercase tracking-wide">DIFFICULTY MULTIPLIER</span>
              <span className="text-[#00ff41] font-bold">Score Multiplier: {getDifficultyMultiplier()}x</span>
            </div>
          </div>
        )}

        {/* TIME TRIAL SPECIFIC OPTIONS */}
        {config.mode === 'timetrial' && (
          <div className="space-y-4 pt-1">
            {/* SESSION DURATION: 5m, 10m, 25m, 1 hr */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-neutral-300 font-bold font-display">
                SESSION DURATION
              </label>
              <div className="grid grid-cols-4 gap-2">
                {DURATION_PRESETS.map((p) => {
                  const isActive = config.durationSec === p.sec
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, durationSec: p.sec }))}
                      className={`py-2 px-1 rounded-xl text-xs font-display font-bold uppercase tracking-wider transition-all active:scale-95 text-center ${
                        isActive
                          ? 'bg-[#00ff41] text-[#0d0d0d] shadow-[0_0_12px_rgba(0,255,65,0.35)] border border-[#00ff41]'
                          : 'border border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* QUESTION MODE */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="uppercase tracking-wider text-neutral-300 font-bold font-display">
                  QUESTION MODE
                </span>
                <span className="text-[11px] text-neutral-500 font-mono">
                  Continuous streaming
                </span>
              </div>

              <div className="rounded-xl border border-[#00ff41]/50 bg-[#00ff41]/10 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-[#00ff41]" />
                  <span className="text-xs font-display font-bold uppercase tracking-wider text-[#00ff41]">
                    UNLIMITED SPRINT
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded border border-[#00ff41]/40 bg-[#00ff41]/20 text-[10px] font-mono font-bold text-[#00ff41]">
                  CONTINUOUS
                </span>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-200">
                  <Zap size={14} className="text-[#00ff41]" />
                  CONTINUOUS QUESTION FLOW
                </div>
                <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                  Answer as fast as you can until the clock expires. Questions refill dynamically with speed multipliers and streak bonuses.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Big Action Button */}
        <div className="pt-2">
          <button
            type="button"
            disabled={config.subjects.length === 0}
            onClick={() => onStartRun(config)}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-display font-black text-sm uppercase tracking-wider transition-all ${
              config.subjects.length === 0
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50'
                : 'bg-[#00ff41] text-[#0d0d0d] shadow-[0_0_20px_rgba(0,255,65,0.35)] active:scale-[0.98] cursor-pointer'
            }`}
          >
            <Play size={16} className={config.subjects.length === 0 ? 'fill-neutral-500' : 'fill-current'} />
            {config.subjects.length === 0
              ? 'SELECT AT LEAST 1 SUBJECT'
              : `START ${config.mode === 'survival' ? 'SURVIVAL RUN' : 'TIMETRIAL RUN'}`}
          </button>
        </div>

        {/* PERSONAL RECORDS FOOTER */}
        <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-neutral-300 font-bold uppercase font-display tracking-wider">
              <Trophy size={14} className="text-amber-400" />
              PERSONAL RECORDS
            </div>
            <span className="text-[11px] text-neutral-500 font-mono">
              {stats?.totalGames ?? 0} RUNS PLAYED
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-center">
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-2.5">
              <div className="text-[10px] text-neutral-400 font-sans font-semibold uppercase">
                Survival Best
              </div>
              <div className="text-base font-bold text-[#00ff41] mt-0.5">
                {(stats?.survivalHighScore ?? 0).toLocaleString()} <span className="text-[10px] text-neutral-400">pts</span>
              </div>
              <div className="text-[11px] text-amber-400 mt-0.5 flex items-center justify-center gap-1 font-semibold">
                <Flame size={12} /> {stats?.survivalBestStreak ?? 0} streak
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-2.5">
              <div className="text-[10px] text-neutral-400 font-sans font-semibold uppercase">
                Time Trial Best
              </div>
              <div className="text-base font-bold text-cyan-400 mt-0.5">
                {(stats?.timetrialHighScore ?? 0).toLocaleString()} <span className="text-[10px] text-neutral-400">pts</span>
              </div>
              <div className="text-[11px] text-amber-400 mt-0.5 flex items-center justify-center gap-1 font-semibold">
                <Flame size={12} /> {stats?.timetrialBestStreak ?? 0} streak
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
