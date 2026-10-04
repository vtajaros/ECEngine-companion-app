import React, { useState, useMemo, useEffect } from 'react'
import {
  Trophy,
  Flame,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  BookOpen,
  Target,
  CheckCircle2,
  XCircle,
  SkipForward,
  Timer,
  Folder,
} from 'lucide-react'
import { App as CapacitorApp } from '@capacitor/app'
import { Card, MCQData, Subject } from '../../types'
import { renderMath } from '../../lib/latex'
import { getTosTopicById } from '../../lib/tosClassification'
import { SUBJECT_THEME_COLORS } from '../../lib/subjectColors'

export interface GauntletMistake {
  card: Card
  chosenIndex: number | null
  answerIndex: number
  timeSpentMs: number
}

export interface GauntletAnswerRecord {
  card: Card
  isCorrect: boolean
  outcome?: 'correct' | 'wrong' | 'skipped' | 'timeout'
  chosenIndex: number | null
  answerIndex: number
  timeSpentMs: number
  points?: number
  parMs?: number
  streakBonus?: number
}

export interface GauntletRunResult {
  mode: 'survival' | 'timetrial'
  score: number
  bestStreak: number
  totalAnswered: number
  correctCount: number
  wrongCount: number
  durationMs: number
  isNewHighScore: boolean
  isNewBestStreak: boolean
  mistakes: GauntletMistake[]
  allAnswers?: GauntletAnswerRecord[]
}

interface GauntletSummaryModalProps {
  result: GauntletRunResult
  onPlayAgain: () => void
  onExit: () => void
  onDrillMistakes?: (cards: Card[]) => void
  onLearnAll?: (cards: Card[]) => void
}

interface TopicStat {
  topicKey: string
  title: string
  subject: Subject
  code?: string
  correct: number
  total: number
  percent: number
}

function cleanPlainTextPreview(text: string): string {
  if (!text) return ''
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' [formula] ')
    .replace(/\$([^$]*)\$/g, '$1')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const GauntletSummaryModal: React.FC<GauntletSummaryModalProps> = ({
  result,
  onPlayAgain,
  onExit,
  onDrillMistakes,
  onLearnAll,
}) => {
  const [expandedSeqs, setExpandedSeqs] = useState<Record<number, boolean>>({})
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong' | 'skipped_timeout' | 'correct'>('all')
  const [activeSubjectTab, setActiveSubjectTab] = useState<Subject | null>(null)

  // Intercept hardware/gesture back button on Android to exit summary
  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      onExit()
    })
    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {})
    }
  }, [onExit])

  const toggleItem = (seq: number) => {
    setExpandedSeqs((prev) => ({
      ...prev,
      [seq]: !prev[seq],
    }))
  }

  // Answer records list for review (fallback to mistakes if allAnswers was empty)
  const answersList: GauntletAnswerRecord[] = useMemo(() => {
    if (result.allAnswers && result.allAnswers.length > 0) {
      return result.allAnswers
    }
    return result.mistakes.map((m): GauntletAnswerRecord => ({
      card: m.card,
      isCorrect: false,
      outcome: 'wrong',
      chosenIndex: m.chosenIndex,
      answerIndex: m.answerIndex,
      timeSpentMs: m.timeSpentMs,
      points: -50,
      parMs: 6000,
      streakBonus: 0,
    }))
  }, [result.allAnswers, result.mistakes])

  const totalCount = answersList.length
  const wrongCount = answersList.filter(
    (a) => a.outcome === 'wrong' || (!a.isCorrect && a.outcome !== 'skipped' && a.outcome !== 'timeout')
  ).length
  const skippedTimeoutCount = answersList.filter(
    (a) => a.outcome === 'skipped' || a.outcome === 'timeout'
  ).length
  const correctCount = answersList.filter(
    (a) => a.isCorrect || a.outcome === 'correct'
  ).length

  const filteredAnswers = useMemo(() => {
    return answersList
      .map((item, originalIndex) => ({ item, seq: originalIndex + 1 }))
      .filter(({ item }) => {
        if (reviewFilter === 'all') return true
        if (reviewFilter === 'wrong') {
          return item.outcome === 'wrong' || (!item.isCorrect && item.outcome !== 'skipped' && item.outcome !== 'timeout')
        }
        if (reviewFilter === 'skipped_timeout') {
          return item.outcome === 'skipped' || item.outcome === 'timeout'
        }
        if (reviewFilter === 'correct') {
          return item.isCorrect || item.outcome === 'correct'
        }
        return true
      })
  }, [answersList, reviewFilter])

  const accuracy =
    result.totalAnswered > 0
      ? Math.round((result.correctCount / result.totalAnswered) * 100)
      : 0

  const durationMin = Math.floor(result.durationMs / 60000)
  const durationSec = Math.floor((result.durationMs % 60000) / 1000)

  // Compute Topic Accuracy & Mastery grouped by subject
  const topicStatsBySubject = useMemo(() => {
    const answers = result.allAnswers || []
    const map = new Map<string, TopicStat>()

    for (const ans of answers) {
      const card = ans.card
      const tos = getTosTopicById(card.tosTopicId)
      const subject = (card.subject || tos?.subject || 'MATH') as Subject
      const topicKey = tos?.id || card.deckName || 'General'
      const title = tos?.title || card.deckName || 'General Questions'
      const code = tos?.code

      const existing = map.get(topicKey) || {
        topicKey,
        title,
        subject,
        code,
        correct: 0,
        total: 0,
        percent: 0,
      }

      existing.total += 1
      if (ans.isCorrect) existing.correct += 1
      existing.percent = Math.round((existing.correct / existing.total) * 100)
      map.set(topicKey, existing)
    }

    const grouped: Record<Subject, TopicStat[]> = {
      MATH: [],
      GEAS: [],
      ELECS: [],
      EST: [],
    }

    for (const stat of map.values()) {
      if (grouped[stat.subject]) {
        grouped[stat.subject].push(stat)
      }
    }

    return grouped
  }, [result.allAnswers])

  // Get subjects that have at least one answered item
  const activeSubjects = useMemo(() => {
    return (['MATH', 'GEAS', 'ELECS', 'EST'] as Subject[]).filter(
      (s) => (topicStatsBySubject[s]?.length ?? 0) > 0
    )
  }, [topicStatsBySubject])

  // Default active tab to first subject with items
  const currentSubject = activeSubjectTab || activeSubjects[0] || 'MATH'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-neutral-100 font-rajdhani select-none overflow-y-auto gauntlet-summary-slide-up">
      {/* Top Header Bar with Back Button */}
      <div className="shrink-0 sticky top-0 z-10 border-b border-neutral-800/80 bg-neutral-950 px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onExit}
          className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200 active:scale-95 transition-all"
          title="Back to Gauntlet"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-xs font-display uppercase tracking-widest text-neutral-400 font-bold">
          {result.mode === 'survival' ? 'Survival Summary' : 'Time Trial Summary'}
        </span>
        <div className="w-8" />
      </div>

      {/* Top Banner */}
      <div className="flex flex-col items-center justify-center pt-6 pb-4 px-4 text-center border-b border-neutral-800/80">
        {result.isNewHighScore ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2 animate-bounce">
            <Trophy size={14} /> NEW RECORD!
          </div>
        ) : (
          <div className="text-xs font-display uppercase tracking-widest text-neutral-400 mb-1">
            RUN COMPLETE
          </div>
        )}

        <div className="text-4xl font-display font-black tracking-wider text-[#00ff41] drop-shadow-[0_0_12px_rgba(0,255,65,0.4)]">
          {result.score.toLocaleString()} <span className="text-lg font-normal text-neutral-400">PTS</span>
        </div>

        <div className="text-xs text-neutral-400 mt-1 uppercase tracking-wide">
          {result.mode === 'survival' ? 'Survival Challenge' : 'Time Trial Sprint'}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="px-4 py-4 max-w-md mx-auto w-full space-y-4 flex-1">
        <div className="grid grid-cols-3 gap-2 font-mono text-center">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5">
            <div className="text-[10px] text-neutral-400 uppercase font-sans font-semibold">Best Streak</div>
            <div className="text-lg font-bold text-amber-400 mt-0.5 flex items-center justify-center gap-1">
              <Flame size={14} className="text-amber-400" />
              {result.bestStreak}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5">
            <div className="text-[10px] text-neutral-400 uppercase font-sans font-semibold">Accuracy</div>
            <div className="text-lg font-bold text-cyan-400 mt-0.5">
              {accuracy}%
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5">
            <div className="text-[10px] text-neutral-400 uppercase font-sans font-semibold">Time</div>
            <div className="text-lg font-bold text-neutral-200 mt-0.5">
              {durationMin}:{durationSec.toString().padStart(2, '0')}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          {result.mistakes.length > 0 && onDrillMistakes && (
            <button
              type="button"
              onClick={() => onDrillMistakes(result.mistakes.map((m) => m.card))}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#00ff41] text-black font-display font-bold text-xs tracking-wider uppercase transition-all active:scale-[0.98] shadow-[0_0_15px_rgba(0,255,65,0.25)] hover:bg-[#00e039] cursor-pointer"
            >
              <GraduationCap size={16} />
              LEARN MISSED ({result.mistakes.length})
            </button>
          )}

          {result.allAnswers && result.allAnswers.length > 0 && onLearnAll && (
            <button
              type="button"
              onClick={() => onLearnAll(result.allAnswers!.map((a) => a.card))}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-display font-bold text-xs tracking-wider uppercase transition-all active:scale-[0.98] cursor-pointer ${
                result.mistakes.length === 0
                  ? 'bg-[#00ff41] text-black shadow-[0_0_15px_rgba(0,255,65,0.25)] hover:bg-[#00e039]'
                  : 'border border-neutral-700 bg-neutral-900/80 text-neutral-200 hover:border-[#00ff41]/50 hover:text-[#00ff41]'
              }`}
            >
              <BookOpen size={16} />
              LEARN ALL ({result.allAnswers.length})
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onPlayAgain}
              className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-neutral-700 bg-neutral-900/80 text-neutral-200 font-display font-bold text-xs tracking-wider uppercase transition-all active:scale-[0.98] hover:border-[#00ff41]/50 hover:text-[#00ff41] cursor-pointer"
            >
              <RotateCcw size={14} />
              RUN IT BACK
            </button>

            <button
              type="button"
              onClick={onExit}
              className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-neutral-800 bg-neutral-900/80 text-neutral-300 font-display font-bold text-xs tracking-wider uppercase transition-all active:scale-[0.98] hover:bg-neutral-800 cursor-pointer"
            >
              EXIT
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* TOPIC ACCURACY & MASTERY (Grouped per Subject) */}
        {activeSubjects.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-300 uppercase font-display tracking-wider px-1">
              <div className="flex items-center gap-1.5">
                <Target size={14} className="text-[#00ff41]" />
                TOPIC ACCURACY & MASTERY
              </div>
            </div>

            {/* Per-subject filter tabs */}
            {activeSubjects.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                {activeSubjects.map((sub) => {
                  const isActive = currentSubject === sub
                  const theme = SUBJECT_THEME_COLORS[sub]
                  const itemsCount = topicStatsBySubject[sub]?.length || 0

                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setActiveSubjectTab(sub)}
                      className={`px-3 py-1 rounded-lg text-xs font-display font-bold uppercase transition-all whitespace-nowrap active:scale-95 ${
                        isActive
                          ? `${theme.activeBg} ${theme.activeBorder} ${theme.activeText} border`
                          : 'bg-neutral-900/60 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {sub} ({itemsCount})
                    </button>
                  )
                })}
              </div>
            )}

            {/* Topic Accuracy Cards for Active Subject */}
            <div className="space-y-1.5">
              {(topicStatsBySubject[currentSubject] || []).map((t) => {
                const theme = SUBJECT_THEME_COLORS[t.subject]
                return (
                  <div
                    key={t.topicKey}
                    className="p-2.5 rounded-xl border border-neutral-800/80 bg-neutral-900/50 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                        {t.code && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${theme.border} ${theme.bg} ${theme.text}`}>
                            {t.code}
                          </span>
                        )}
                        <span className="font-medium text-neutral-200 truncate text-[11.5px]">
                          {t.title}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono font-bold text-neutral-300 shrink-0">
                        {t.correct}/{t.total} ({t.percent}%)
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          t.percent >= 80
                            ? 'bg-[#00ff41]'
                            : t.percent >= 50
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                        }`}
                        style={{ width: `${t.percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Answer Review Section (Full Review with Outcome Filters) */}
        {totalCount > 0 && (
          <div className="space-y-2.5 pt-2 pb-8">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-300 uppercase tracking-wider px-1">
                <span>ANSWER REVIEW ({filteredAnswers.length}/{totalCount})</span>
              </div>

              {/* Filter Tabs matching desktop mode */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-mono font-bold">
                <button
                  type="button"
                  onClick={() => setReviewFilter('all')}
                  className={`px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap active:scale-95 ${
                    reviewFilter === 'all'
                      ? 'bg-neutral-800 text-neutral-100 border-neutral-600 shadow-sm'
                      : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                  }`}
                >
                  All ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('wrong')}
                  className={`px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap active:scale-95 ${
                    reviewFilter === 'wrong'
                      ? 'bg-red-500/20 text-red-400 border-red-500/50 shadow-sm'
                      : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-red-400'
                  }`}
                >
                  Wrong ({wrongCount})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('skipped_timeout')}
                  className={`px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap active:scale-95 ${
                    reviewFilter === 'skipped_timeout'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-sm'
                      : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-amber-400'
                  }`}
                >
                  Skip/Time ({skippedTimeoutCount})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('correct')}
                  className={`px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap active:scale-95 ${
                    reviewFilter === 'correct'
                      ? 'bg-[#00ff41]/20 text-[#00ff41] border-[#00ff41]/50 shadow-sm'
                      : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-[#00ff41]'
                  }`}
                >
                  Correct ({correctCount})
                </button>
              </div>
            </div>

            {/* Answer List */}
            {filteredAnswers.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 font-mono text-xs uppercase tracking-wider rounded-xl border border-neutral-800/80 bg-neutral-900/30">
                No answers match the selected filter
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAnswers.map(({ item, seq }) => {
                  const mcq = item.card.data as MCQData
                  const isExpanded = Boolean(expandedSeqs[seq])
                  const choices = mcq?.choices || []
                  const tos = getTosTopicById(item.card.tosTopicId)
                  const subject = (item.card.subject || tos?.subject || 'MATH') as Subject
                  const theme = SUBJECT_THEME_COLORS[subject]
                  const outcome = item.outcome || (item.isCorrect ? 'correct' : 'wrong')
                  const correctLetter = String.fromCharCode(65 + item.answerIndex)
                  const pickedLetter =
                    item.chosenIndex !== null ? String.fromCharCode(65 + item.chosenIndex) : '—'
                  const parMs = item.parMs || 6000
                  const isTooFast = outcome === 'wrong' && item.timeSpentMs < parMs * 0.25
                  const isSlow = item.timeSpentMs > parMs * 1.5

                  return (
                    <div
                      key={seq}
                      className={`rounded-xl border transition-all text-xs overflow-hidden ${
                        isExpanded
                          ? 'bg-neutral-900/90 border-neutral-700 shadow-md'
                          : 'bg-neutral-900/40 hover:bg-neutral-900/70 border-neutral-800/80'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(seq)}
                        className="w-full p-3 flex flex-col gap-2 text-left active:bg-neutral-800/40"
                      >
                        {/* Top Line: Sequence, Subject, Deck/TOS, Outcome Icon, Comparison, Points, Chevron */}
                        <div className="flex items-center justify-between gap-2 w-full font-mono text-[10px]">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="font-bold text-neutral-400 w-5">#{seq}</span>

                            <span
                              className={`px-1.5 py-0.5 rounded border font-bold ${theme.border} ${theme.bg} ${theme.text}`}
                            >
                              {subject}
                            </span>

                            {tos ? (
                              <span className="px-1.5 py-0.5 rounded bg-neutral-800/80 text-neutral-300 border border-neutral-700/80">
                                {tos.code}
                              </span>
                            ) : item.card.deckName ? (
                              <span className="px-1.5 py-0.5 rounded bg-neutral-800/80 text-neutral-300 border border-neutral-700/80 truncate max-w-[130px] inline-flex items-center gap-1">
                                <Folder size={10} className="text-neutral-500 shrink-0" />
                                <span className="truncate">{item.card.deckName}</span>
                              </span>
                            ) : null}

                            <span className="shrink-0 flex items-center">
                              {outcome === 'correct' && (
                                <CheckCircle2 size={14} className="text-[#00ff41]" />
                              )}
                              {outcome === 'wrong' && (
                                <XCircle size={14} className="text-red-400" />
                              )}
                              {outcome === 'skipped' && (
                                <SkipForward size={14} className="text-amber-400" />
                              )}
                              {outcome === 'timeout' && (
                                <Timer size={14} className="text-red-400" />
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Letters Comparison */}
                            <div className="flex items-center gap-1 font-bold">
                              {outcome === 'correct' ? (
                                <span className="text-[#00ff41]">{correctLetter}</span>
                              ) : (
                                <>
                                  <span
                                    className={
                                      item.chosenIndex !== null ? 'text-red-400' : 'text-neutral-500'
                                    }
                                  >
                                    {pickedLetter}
                                  </span>
                                  <span className="text-neutral-600 text-[9px]">→</span>
                                  <span className="text-[#00ff41]">{correctLetter}</span>
                                </>
                              )}
                            </div>

                            {/* Time spent */}
                            <span className="text-neutral-500 text-[10px]">
                              {(item.timeSpentMs / 1000).toFixed(1)}s
                            </span>

                            {/* Points */}
                            {item.points !== undefined && (
                              <span
                                className={`font-bold w-12 text-right ${
                                  item.points > 0
                                    ? 'text-[#00ff41]'
                                    : item.points < 0
                                    ? 'text-red-400'
                                    : 'text-neutral-500'
                                }`}
                              >
                                {item.points > 0 ? `+${item.points}` : item.points}
                              </span>
                            )}

                            <div className="text-neutral-500">
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                          </div>
                        </div>

                        {/* Bottom Line: Question Stem Preview and Tags */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-neutral-200 line-clamp-1 text-xs flex-1">
                            {cleanPlainTextPreview(mcq?.question || '')}
                          </div>

                          <div className="flex items-center gap-1 shrink-0 font-mono text-[9px]">
                            {isTooFast && (
                              <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 font-bold">
                                TOO FAST
                              </span>
                            )}
                            {isSlow && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
                                SLOW
                              </span>
                            )}
                            {item.streakBonus && item.streakBonus > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
                                +{item.streakBonus} STREAK
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>

                      {/* Collapsible Details */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-2 border-t border-neutral-800/80 space-y-2.5 bg-neutral-950/70">
                          {/* Full Question Text */}
                          <div
                            className="font-medium text-neutral-100 leading-relaxed text-xs"
                            dangerouslySetInnerHTML={{ __html: renderMath(mcq?.question || '') }}
                          />

                          {/* Choices */}
                          <div className="space-y-1 pt-1">
                            {choices.map((choice, cIdx) => {
                              const isCorrectChoice = cIdx === item.answerIndex
                              const isChosenChoice = cIdx === item.chosenIndex

                              let borderStyle = 'border-neutral-800 bg-neutral-900/50 text-neutral-400'
                              if (isCorrectChoice) {
                                borderStyle =
                                  'border-[#00ff41]/50 bg-[#00ff41]/10 text-[#00ff41] font-semibold'
                              } else if (isChosenChoice) {
                                borderStyle =
                                  'border-red-500/50 bg-red-500/10 text-red-400 font-semibold'
                              }

                              return (
                                <div
                                  key={cIdx}
                                  className={`p-2 rounded-lg border flex items-center justify-between text-[11px] ${borderStyle}`}
                                >
                                  <div className="flex items-center gap-2 flex-1 pr-2">
                                    <span className="font-mono font-bold text-[10px] w-4">
                                      {String.fromCharCode(65 + cIdx)}.
                                    </span>
                                    <span dangerouslySetInnerHTML={{ __html: renderMath(choice) }} />
                                  </div>
                                  {isCorrectChoice && (
                                    <CheckCircle2 size={13} className="text-[#00ff41] shrink-0" />
                                  )}
                                  {isChosenChoice && !isCorrectChoice && (
                                    <XCircle size={13} className="text-red-400 shrink-0" />
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {/* Explanation */}
                          {mcq?.explanation && (
                            <div className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/80 text-[11px] text-neutral-300 space-y-1">
                              <span className="font-bold text-neutral-400 uppercase tracking-wide text-[10px]">
                                Solution Explanation
                              </span>
                              <div
                                className="leading-relaxed text-neutral-300"
                                dangerouslySetInnerHTML={{ __html: renderMath(mcq.explanation) }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
