import React, { useState, useMemo } from 'react'
import {
  Trophy,
  Flame,
  RotateCcw,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Target,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
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
  chosenIndex: number | null
  answerIndex: number
  timeSpentMs: number
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

export const GauntletSummaryModal: React.FC<GauntletSummaryModalProps> = ({
  result,
  onPlayAgain,
  onExit,
  onDrillMistakes,
}) => {
  const [expandedMistakes, setExpandedMistakes] = useState<Record<string, boolean>>({})
  const [activeSubjectTab, setActiveSubjectTab] = useState<Subject | null>(null)

  const toggleMistake = (cardId: string) => {
    setExpandedMistakes((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }))
  }

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
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/95 backdrop-blur-md text-neutral-100 font-rajdhani select-none overflow-y-auto">
      {/* Top Banner */}
      <div className="flex flex-col items-center justify-center pt-8 pb-4 px-4 text-center border-b border-neutral-800/80">
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
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 font-display font-bold text-xs tracking-wider uppercase transition-all active:scale-[0.98] shadow-sm hover:bg-amber-500/20"
            >
              <GraduationCap size={16} />
              DRILL {result.mistakes.length} MISTAKES IN LOOKSFAM
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onPlayAgain}
              className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-[#00ff41] text-black font-display font-bold text-xs tracking-wider uppercase transition-all active:scale-[0.98] shadow-[0_0_15px_rgba(0,255,65,0.25)] hover:bg-[#00e039] cursor-pointer"
            >
              <RotateCcw size={14} />
              PLAY AGAIN
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

        {/* Mistakes Review List */}
        {result.mistakes.length > 0 && (
          <div className="space-y-2.5 pt-2 pb-6">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-400 uppercase tracking-wider px-1">
              <span>MISTAKES BREAKDOWN ({result.mistakes.length})</span>
            </div>

            <div className="space-y-2">
              {result.mistakes.map(({ card, chosenIndex, answerIndex }, idx) => {
                const mcq = card.data as MCQData
                const isExpanded = Boolean(expandedMistakes[card.id])
                const choices = mcq?.choices || []
                const tos = getTosTopicById(card.tosTopicId)
                const subject = (card.subject || tos?.subject || 'MATH') as Subject
                const theme = SUBJECT_THEME_COLORS[subject]

                return (
                  <div
                    key={card.id || idx}
                    className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 overflow-hidden transition-all text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => toggleMistake(card.id)}
                      className="w-full p-3 flex items-start justify-between gap-2 text-left hover:bg-neutral-800/40"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono flex-wrap">
                          <span className="font-bold text-red-400">#{idx + 1}</span>
                          <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${theme.border} ${theme.bg} ${theme.text}`}>
                            {subject}
                          </span>
                          {tos ? (
                            <span className="px-1.5 py-0.5 rounded bg-neutral-800/80 text-neutral-300 border border-neutral-700/80">
                              {tos.code} {tos.title}
                            </span>
                          ) : card.deckName ? (
                            <span className="px-1.5 py-0.5 rounded bg-neutral-800/80 text-neutral-300 border border-neutral-700/80 truncate max-w-[150px]">
                              {card.deckName}
                            </span>
                          ) : null}
                        </div>
                        <div
                          className="font-medium text-neutral-200 line-clamp-2"
                          dangerouslySetInnerHTML={{ __html: renderMath(mcq?.question || '') }}
                        />
                      </div>
                      <div className="text-neutral-400 mt-1">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>

                    {/* Collapsible Details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-neutral-800/80 space-y-2 bg-neutral-950/60">
                        {/* Choices */}
                        <div className="space-y-1 pt-1">
                          {choices.map((choice, cIdx) => {
                            const isCorrect = cIdx === answerIndex
                            const isChosen = cIdx === chosenIndex

                            let borderStyle = 'border-neutral-800 bg-neutral-900/50 text-neutral-400'
                            if (isCorrect) {
                              borderStyle = 'border-[#00ff41]/50 bg-[#00ff41]/10 text-[#00ff41] font-semibold'
                            } else if (isChosen) {
                              borderStyle = 'border-red-500/50 bg-red-500/10 text-red-400 font-semibold'
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
                                {isCorrect && <CheckCircle2 size={13} className="text-[#00ff41] shrink-0" />}
                                {isChosen && !isCorrect && <XCircle size={13} className="text-red-400 shrink-0" />}
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
          </div>
        )}
      </div>
    </div>
  )
}
