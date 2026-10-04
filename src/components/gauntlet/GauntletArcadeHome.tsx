import React, { useState, useEffect, useRef } from 'react'
import {
  Flame,
  Timer,
  ArrowLeft,
  Check,
  Zap,
  Play,
  Trophy,
  Layers,
  X,
} from 'lucide-react'
import { App as CapacitorApp } from '@capacitor/app'
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
import { ALL_TOS_TOPICS } from '../../lib/tosClassification'
import { GauntletTopicModal } from './GauntletTopicModal'

interface GauntletArcadeHomeProps {
  onStartRun: (config: GauntletArcadeConfig) => void
  onExit: () => void
  cardCount: number
}

const SUBJECTS: Subject[] = ['MATH', 'GEAS', 'ELECS', 'EST']

const SUBJECT_COLOR: Record<Subject, string> = {
  MATH: '#f59e0b',
  GEAS: '#3b82f6',
  ELECS: '#ef4444',
  EST: '#22c55e',
}

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
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false)

  const hasActiveTopics = (config.tosTopicIds || []).length > 0
  const selectedCount = config.tosTopicIds?.length || 0

  const isTopicModalOpenRef = useRef(isTopicModalOpen)
  isTopicModalOpenRef.current = isTopicModalOpen

  // Intercept Android hardware / gesture back button to exit setup (or close topic modal if open)
  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      if (isTopicModalOpenRef.current) {
        setIsTopicModalOpen(false)
      } else {
        onExit()
      }
    })
    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {})
    }
  }, [onExit])

  useEffect(() => {
    gauntletStorageService.getStats().then(setStats)
  }, [])

  // Dynamically update card counts whenever selected topics change
  useEffect(() => {
    dbService
      .getGauntletPoolSizes(config.tosTopicIds)
      .then(setPoolSizes)
      .catch(() => {})
  }, [config.tosTopicIds])

  const handleApplyTopics = (topicIds: string[]) => {
    if (topicIds.length === 0) {
      setConfig((prev) => ({
        ...prev,
        tosTopicIds: [],
        tosTopicId: null,
      }))
      return
    }

    const topicSubjects = new Set<Subject>()
    for (const tid of topicIds) {
      const found = ALL_TOS_TOPICS.find((t) => t.id === tid)
      if (found) topicSubjects.add(found.subject)
    }
    const requiredSubjects = Array.from(topicSubjects)

    setConfig((prev) => {
      const mergedSubs = Array.from(new Set([...prev.subjects, ...requiredSubjects]))
      return {
        ...prev,
        tosTopicIds: topicIds,
        tosTopicId: topicIds[0] ?? null,
        subjects: mergedSubs.length > 0 ? mergedSubs : prev.subjects,
      }
    })
  }

  const handleRemoveTopic = (topicId: string) => {
    const updated = (config.tosTopicIds || []).filter((id) => id !== topicId)
    handleApplyTopics(updated)
  }

  const handleClearAllTopics = () => {
    handleApplyTopics([])
  }

  const toggleSubject = (subj: Subject) => {
    setConfig((prev) => {
      const isSelected = prev.subjects.includes(subj)
      if (isSelected) {
        // Deselect subject and also filter out any topics belonging to this subject
        const nextSubjects = prev.subjects.filter((s) => s !== subj)
        const nextTopicIds = (prev.tosTopicIds || []).filter((tid) => {
          const found = ALL_TOS_TOPICS.find((t) => t.id === tid)
          return found ? found.subject !== subj : true
        })
        return {
          ...prev,
          subjects: nextSubjects,
          tosTopicIds: nextTopicIds,
          tosTopicId: nextTopicIds[0] ?? null,
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
          <span className={config.mode === 'survival' ? 'text-red-400 font-bold' : 'text-cyan-400 font-bold'}>
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
                ? 'bg-neutral-800 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.25)] border border-red-500/50'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Flame size={14} className={config.mode === 'survival' ? 'text-red-400' : 'text-neutral-500'} />
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

        {/* TOPIC FOCUS (Matches desktop layout, optimized for mobile) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-wider text-neutral-300 font-bold font-display">
              TOPIC FOCUS
            </span>
            {hasActiveTopics && (
              <button
                type="button"
                onClick={handleClearAllTopics}
                className="text-[10px] font-mono text-[#00FF41] hover:underline flex items-center gap-1 active:scale-95 transition-all"
              >
                <X size={11} /> Clear Filter (All Topics)
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  hasActiveTopics
                    ? 'bg-[#00FF41] animate-pulse shadow-[0_0_8px_#00FF41]'
                    : 'bg-neutral-600'
                }`}
              />
              <div className="flex flex-col min-w-0">
                <span className="font-display font-bold text-xs text-neutral-100 truncate">
                  {hasActiveTopics
                    ? `${selectedCount} ${selectedCount === 1 ? 'Topic Selected' : 'Topics Selected'}`
                    : 'All Topics (Comprehensive Pool)'}
                </span>
                <span className="text-[10px] font-mono text-neutral-400 truncate">
                  {hasActiveTopics
                    ? 'Questions sampled exclusively from chosen topics'
                    : 'Random pool across all syllabus chapters'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsTopicModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700 hover:border-[#00FF41]/60 hover:text-white text-neutral-300 font-rajdhani font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 active:scale-95"
            >
              <Layers size={13} className="text-[#00FF41]" />
              {hasActiveTopics ? 'Edit Topics' : 'Filter Topics'}
            </button>
          </div>

          {/* Selected Topic Badges Preview */}
          {hasActiveTopics && (
            <div className="flex flex-wrap gap-1.5 pt-0.5 max-h-24 overflow-y-auto no-scrollbar">
              {(config.tosTopicIds || []).map((tid) => {
                const topic = ALL_TOS_TOPICS.find((t) => t.id === tid)
                if (!topic) return null
                const color = SUBJECT_COLOR[topic.subject]
                return (
                  <span
                    key={tid}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono bg-neutral-900 border border-[#00FF41]/30 text-neutral-200"
                  >
                    <span
                      className="font-bold text-[9px] px-1 py-0.2 rounded"
                      style={{
                        backgroundColor: `${color}20`,
                        color: color,
                      }}
                    >
                      {topic.subject}
                    </span>
                    <span className="text-[#00FF41] font-bold">{topic.code}</span>
                    <span className="truncate max-w-[130px] font-rajdhani font-semibold">{topic.title}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveTopic(tid)
                      }}
                      className="text-neutral-500 hover:text-white p-0.5 active:scale-95"
                    >
                      <X size={10} />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
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
                          ? 'bg-[#ef4444] text-white shadow-[0_0_12px_rgba(239,68,68,0.35)] border border-[#ef4444]'
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
              <span className={config.mode === 'survival' ? 'text-red-400 font-bold' : 'text-cyan-400 font-bold'}>
                Score Multiplier: {getDifficultyMultiplier()}x
              </span>
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
                : config.mode === 'survival'
                ? 'bg-[#ef4444] text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-[0.98] cursor-pointer hover:bg-red-600'
                : 'bg-cyan-500 text-neutral-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-[0.98] cursor-pointer hover:bg-cyan-400'
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

      <GauntletTopicModal
        isOpen={isTopicModalOpen}
        onClose={() => setIsTopicModalOpen(false)}
        selectedTopicIds={config.tosTopicIds || []}
        onApply={handleApplyTopics}
        activeSubjects={config.subjects}
      />
    </div>
  )
}

