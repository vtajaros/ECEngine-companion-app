import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, RotateCcw, Sparkles, Copy } from 'lucide-react'
import { dbService } from '../services/db.service'
import { Card, MCQData } from '../types'
import { ExplanationPanel } from '../components/ExplanationPanel'
import { resolveImageSrc } from '../services/image.service'
import { ImageLightbox } from '../components/ImageLightbox'

interface LearnSessionProps {
  topicId: string
  topicName?: string
  onExit: () => void
  onOpenSettings?: () => void
}

/**
 * Partitions cards into chunks of partitionSize (default 5).
 * If the final chunk would have fewer than minTrailingSize (default 3) items
 * (i.e. 1 or 2 leftover items) and there is a preceding partition, those remainder
 * items are merged into the second-to-last partition (resulting in 6 or 7 items)
 * instead of creating an extra round with only 1 or 2 items.
 */
export function partitionCards(cards: Card[], partitionSize = 5, minTrailingSize = 3): Card[][] {
  if (!cards || cards.length === 0) return []
  const partitions: Card[][] = []
  for (let i = 0; i < cards.length; i += partitionSize) {
    partitions.push(cards.slice(i, i + partitionSize))
  }
  if (partitions.length > 1 && partitions[partitions.length - 1].length < minTrailingSize) {
    const last = partitions.pop()!
    partitions[partitions.length - 1] = [...partitions[partitions.length - 1], ...last]
  }
  return partitions
}

export function LearnSession({ topicId, topicName, onExit, onOpenSettings }: LearnSessionProps) {
  const [cards, setCards] = useState<Card[]>([])
  const [partitions, setPartitions] = useState<Card[][]>([])
  const [currentPartitionIndex, setCurrentPartitionIndex] = useState(0)

  // Queue for the current pass within the active round (recycles wrong cards)
  const [activeQueue, setActiveQueue] = useState<Card[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [partitionWrongIds, setPartitionWrongIds] = useState<Set<string>>(new Set())

  // Session-scoped attempt tracking (first attempt dictates wasCorrectFirstTry)
  const [cardStats, setCardStats] = useState<Record<string, { wasCorrectFirstTry: boolean; attemptCount: number }>>({})

  // ID of summary review card with AI explanation currently expanded (null = none)
  const [openExplanationRowId, setOpenExplanationRowId] = useState<string | null>(null)

  // Active question feedback AI explanation toggle
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [showContextToast, setShowContextToast] = useState(false)

  // Lazy image URI state for current active card
  const [questionImageSrc, setQuestionImageSrc] = useState<string | null>(null)
  const [solutionImageSrc, setSolutionImageSrc] = useState<string | null>(null)

  // Fullscreen image lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Answer state for current active card
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [isNextEnabled, setIsNextEnabled] = useState(false)
  const [viewState, setViewState] = useState<'question' | 'feedback' | 'round-complete' | 'set-complete'>('question')

  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear pending timer on unmount
  useEffect(() => {
    return () => {
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current)
    }
  }, [])

  // Fetch topic cards on mount
  useEffect(() => {
    let isCancelled = false
    setIsLoading(true)
    setError(null)

    dbService.getAllCardsByTopic(topicId)
      .then((allCards) => {
        if (isCancelled) return
        const mcqCards = allCards.filter((c) => c.type === 'mcq')
        setCards(mcqCards)
        const parts = partitionCards(mcqCards, 5, 3)
        setPartitions(parts)
        setCurrentPartitionIndex(0)
        setActiveQueue(parts[0] ? [...parts[0]] : [])
        setCurrentCardIndex(0)
        setPartitionWrongIds(new Set())
        setCardStats({})
        setOpenExplanationRowId(null)
        setExplanationOpen(false)
        setLightboxSrc(null)
        setViewState('question')
      })
      .catch((err) => {
        if (isCancelled) return
        console.error('[LearnSession] Failed to fetch cards:', err)
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [topicId])

  const currentPartition = partitions[currentPartitionIndex] || []
  const currentCard = activeQueue[currentCardIndex]
  const mcqData = (currentCard?.data as MCQData) || null
  const overallQuestionNumber = currentCard
    ? cards.findIndex((c) => c.id === currentCard.id) + 1
    : 0
  const isRetryPass = activeQueue.length < currentPartition.length

  // Resolve question & solution images lazily for the active card
  useEffect(() => {
    let isCancelled = false
    setQuestionImageSrc(null)
    setSolutionImageSrc(null)

    if (mcqData?.imagePath) {
      resolveImageSrc(mcqData.imagePath).then((src) => {
        if (!isCancelled) setQuestionImageSrc(src)
      })
    }

    if (mcqData?.solutionImagePath) {
      resolveImageSrc(mcqData.solutionImagePath).then((src) => {
        if (!isCancelled) setSolutionImageSrc(src)
      })
    }

    return () => {
      isCancelled = true
    }
  }, [currentCard?.id, mcqData?.imagePath, mcqData?.solutionImagePath])

  // Calculate overall question position for display
  const partitionStartPos = partitions
    .slice(0, currentPartitionIndex)
    .reduce((acc, part) => acc + part.length, 0)

  const handleGetContext = () => {
    if (!mcqData) return
    const choicesBlock = mcqData.choices
      .map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`)
      .join('\n')
    const template = `---
Please explain the correct answer to this multiple choice question:

QUESTION:
${mcqData.question}

CHOICES:
${choicesBlock}

CORRECT ANSWER: ${String.fromCharCode(65 + mcqData.answer)}. ${mcqData.choices[mcqData.answer]}

Please explain:
1. Why the correct answer is right
2. Why each of the other choices is wrong
3. Any relevant formula, law, or concept that applies
4. A memory tip or way to remember this for the board exam
---`
    navigator.clipboard.writeText(template).then(() => {
      setShowContextToast(true)
      setTimeout(() => setShowContextToast(false), 2500)
    })
  }

  const handleSelectChoice = (choiceIndex: number) => {
    if (isAnswered || viewState !== 'question' || !currentCard || !mcqData) return

    const cardId = currentCard.id
    const isCorrect = choiceIndex === mcqData.answer

    setSelectedChoiceIndex(choiceIndex)
    setIsAnswered(true)
    setIsNextEnabled(false)
    setViewState('feedback')

    // Track first-try flawless stat once per card
    setCardStats((prev) => {
      const prevStat = prev[cardId] ?? { wasCorrectFirstTry: false, attemptCount: 0 }
      const isFirstAttempt = prevStat.attemptCount === 0
      return {
        ...prev,
        [cardId]: {
          attemptCount: prevStat.attemptCount + 1,
          wasCorrectFirstTry: isFirstAttempt ? isCorrect : prevStat.wasCorrectFirstTry,
        },
      }
    })

    // Track wrong answers for recycling in the current pass
    setPartitionWrongIds((prev) => {
      const next = new Set(prev)
      if (isCorrect) {
        next.delete(cardId)
      } else {
        next.add(cardId)
      }
      return next
    })

    // 500ms delay to enable Next button (matches desktop anti-accidental-skip behavior)
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current)
    nextTimerRef.current = setTimeout(() => {
      setIsNextEnabled(true)
    }, 500)
  }

  const handleNext = () => {
    if (!isNextEnabled && viewState === 'feedback') return

    if (currentCardIndex < activeQueue.length - 1) {
      // Advance to next question in activeQueue
      setCurrentCardIndex((prev) => prev + 1)
      setSelectedChoiceIndex(null)
      setIsAnswered(false)
      setIsNextEnabled(false)
      setExplanationOpen(false)
      setLightboxSrc(null)
      setViewState('question')
    } else {
      // Reached the end of the current activeQueue pass
      if (partitionWrongIds.size === 0) {
        // Round complete without remaining errors
        setOpenExplanationRowId(null)
        setExplanationOpen(false)
        setLightboxSrc(null)
        if (currentPartitionIndex === partitions.length - 1) {
          setViewState('set-complete')
        } else {
          setViewState('round-complete')
        }
      } else {
        // Recycle missed cards for another pass
        const nextQueue = activeQueue.filter((c) => partitionWrongIds.has(c.id))
        setActiveQueue(nextQueue)
        setCurrentCardIndex(0)
        setPartitionWrongIds(new Set())
        setSelectedChoiceIndex(null)
        setIsAnswered(false)
        setIsNextEnabled(false)
        setExplanationOpen(false)
        setLightboxSrc(null)
        setViewState('question')
      }
    }
  }

  const handleStartNextRound = () => {
    const nextPartitionIndex = currentPartitionIndex + 1
    if (nextPartitionIndex < partitions.length) {
      setCurrentPartitionIndex(nextPartitionIndex)
      setActiveQueue([...partitions[nextPartitionIndex]])
      setCurrentCardIndex(0)
      setPartitionWrongIds(new Set())
      setOpenExplanationRowId(null)
      setExplanationOpen(false)
      setLightboxSrc(null)
      setSelectedChoiceIndex(null)
      setIsAnswered(false)
      setIsNextEnabled(false)
      setViewState('question')
    }
  }

  const handleRestartSet = () => {
    setCurrentPartitionIndex(0)
    setActiveQueue(partitions[0] ? [...partitions[0]] : [])
    setCurrentCardIndex(0)
    setPartitionWrongIds(new Set())
    setCardStats({})
    setOpenExplanationRowId(null)
    setExplanationOpen(false)
    setLightboxSrc(null)
    setSelectedChoiceIndex(null)
    setIsAnswered(false)
    setIsNextEnabled(false)
    setViewState('question')
  }

  // Summary counts
  const partitionFlawlessCount = currentPartition.filter((c) => cardStats[c.id]?.wasCorrectFirstTry).length
  const totalFlawlessCount = cards.filter((c) => cardStats[c.id]?.wasCorrectFirstTry).length

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 text-neutral-50">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onExit}
              className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200 active:scale-95 transition-all shrink-0"
              title="Exit session"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight text-neutral-100 uppercase truncate">
                {topicName || 'LooksFam Study'}
              </h1>
              <p className="text-[11px] text-neutral-400">
                {!isLoading && cards.length > 0 && viewState !== 'set-complete' && viewState !== 'round-complete' && (
                  <span>
                    Round {currentPartitionIndex + 1} of {partitions.length}
                    {isRetryPass ? (
                      <span className="text-amber-400 font-medium"> • Retry {currentCardIndex + 1} of {activeQueue.length}</span>
                    ) : (
                      <span> • Card {currentCardIndex + 1} of {currentPartition.length}</span>
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>

          {!isLoading && cards.length > 0 && (
            <div className="flex items-center gap-2">
              {viewState === 'round-complete' ? (
                <span className="text-xs font-mono font-semibold text-[#00ff41] bg-[#00ff41]/10 px-2 py-0.5 rounded border border-[#00ff41]/20">
                  Round {currentPartitionIndex + 1}/{partitions.length}
                </span>
              ) : viewState === 'set-complete' ? (
                <span className="text-xs font-mono font-semibold text-[#00ff41] bg-[#00ff41]/10 px-2 py-0.5 rounded border border-[#00ff41]/20">
                  {totalFlawlessCount}/{cards.length} Flawless
                </span>
              ) : (
                <span className="text-xs font-mono font-semibold text-[#00ff41] bg-[#00ff41]/10 px-2 py-0.5 rounded border border-[#00ff41]/20">
                  Round {currentPartitionIndex + 1}/{partitions.length}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {!isLoading && cards.length > 0 && (
          <div className="mx-auto mt-2.5 max-w-3xl h-1 w-full bg-neutral-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00ff41] transition-all duration-300 shadow-[0_0_8px_rgba(0,255,65,0.4)]"
              style={{
                width: `${
                  viewState === 'set-complete'
                    ? 100
                    : ((currentPartitionIndex + (viewState === 'round-complete' ? 1 : currentCardIndex / Math.max(1, activeQueue.length))) /
                        partitions.length) *
                      100
                }%`,
              }}
            />
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-6 sm:px-6 flex flex-col justify-center">
        <div className="mx-auto max-w-3xl w-full">
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-[#00ff41] mb-3" />
              <p className="text-sm font-medium text-neutral-400">
                Loading questions...
              </p>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 text-center my-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertCircle size={24} />
              </div>
              <h2 className="text-lg font-semibold text-neutral-200">
                Failed to Load Session
              </h2>
              <p className="mt-1 max-w-sm text-xs text-neutral-400 leading-relaxed">
                {error}
              </p>
              <button
                type="button"
                onClick={onExit}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 active:scale-95 transition-all"
              >
                Back to Topics
              </button>
            </div>
          )}

          {/* Empty Cards State */}
          {!isLoading && !error && cards.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 text-center my-8">
              <p className="text-sm text-neutral-400">
                No MCQ questions found in this topic.
              </p>
              <button
                type="button"
                onClick={onExit}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 active:scale-95 transition-all"
              >
                Back to Topics
              </button>
            </div>
          )}

          {/* Question / Feedback View */}
          {!isLoading && !error && (viewState === 'question' || viewState === 'feedback') && mcqData && (
            <div className="flex flex-col gap-5">
              {/* Question Card */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 sm:p-7 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-semibold text-neutral-400 bg-neutral-950/60 px-2 py-0.5 rounded border border-neutral-800">
                      Question {overallQuestionNumber}
                    </span>
                    {isRetryPass && (
                      <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                        Retry Miss
                      </span>
                    )}
                  </div>
                  {mcqData.yearAsked && (
                    <span className="text-[10px] font-mono text-neutral-500">
                      ECE Board {mcqData.yearAsked}
                    </span>
                  )}
                </div>
                <h2 className="text-base sm:text-lg font-medium text-neutral-100 leading-relaxed whitespace-pre-wrap">
                  {mcqData.question}
                </h2>

                {/* Inline Question Diagram */}
                {questionImageSrc && (
                  <div
                    onClick={() => setLightboxSrc(questionImageSrc)}
                    className="mt-4 flex justify-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/60 p-2 cursor-zoom-in active:scale-[0.98] transition-transform"
                    title="Tap to zoom"
                  >
                    <img
                      src={questionImageSrc}
                      alt="Question diagram"
                      className="max-h-64 w-full object-contain rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* Choices List */}
              <div className="flex flex-col gap-2.5">
                {mcqData.choices.map((choice, idx) => {
                  const letter = String.fromCharCode(65 + idx)
                  const isCorrect = idx === mcqData.answer
                  const isSelected = idx === selectedChoiceIndex

                  let btnStyle = 'border-neutral-800 bg-neutral-900/60 text-neutral-200 hover:border-neutral-700 hover:bg-neutral-900'
                  let badgeStyle = 'bg-neutral-950 text-neutral-400 border-neutral-800'

                  if (isAnswered) {
                    if (isCorrect) {
                      btnStyle = 'border-[#00ff41] bg-[#00ff41]/10 text-[#00ff41] shadow-[0_0_12px_rgba(0,255,65,0.15)] font-semibold'
                      badgeStyle = 'bg-[#00ff41]/20 text-[#00ff41] border-[#00ff41]/40'
                    } else if (isSelected) {
                      btnStyle = 'border-red-500/80 bg-red-500/10 text-red-400 font-semibold'
                      badgeStyle = 'bg-red-500/20 text-red-400 border-red-500/40'
                    } else {
                      btnStyle = 'border-neutral-800/40 bg-neutral-950/40 text-neutral-500 opacity-50'
                      badgeStyle = 'bg-neutral-900/40 text-neutral-600 border-neutral-800/40'
                    }
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isAnswered}
                      onClick={() => handleSelectChoice(idx)}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 sm:p-4 text-left transition-all active:scale-[0.99] ${btnStyle}`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold leading-none ${badgeStyle}`}>
                        {letter}
                      </span>
                      <span className="text-sm sm:text-base leading-snug break-words flex-1 pt-0.5">
                        {choice}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Explanation Field (Feedback state) */}
              {viewState === 'feedback' && ((mcqData.explanation && mcqData.explanation.trim() !== '') || solutionImageSrc) && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/90 p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#00ff41] flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    <span>Explanation</span>
                  </div>
                  {mcqData.explanation && mcqData.explanation.trim() !== '' && (
                    <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
                      {mcqData.explanation}
                    </p>
                  )}
                  {solutionImageSrc && (
                    <div
                      onClick={() => setLightboxSrc(solutionImageSrc)}
                      className="flex justify-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/60 p-2 cursor-zoom-in active:scale-[0.98] transition-transform"
                      title="Tap to zoom"
                    >
                      <img
                        src={solutionImageSrc}
                        alt="Solution diagram"
                        className="max-h-64 w-full object-contain rounded-lg"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Next Button + Context/Explain Buttons */}
              {viewState === 'feedback' && (
                <div className="pt-2 flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={!isNextEnabled}
                    onClick={handleNext}
                    className={`w-full rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all shadow-md active:scale-[0.98] ${
                      isNextEnabled
                        ? 'bg-[#00ff41] text-neutral-950 hover:bg-[#00ff41]/90 shadow-[0_0_15px_rgba(0,255,65,0.25)]'
                        : 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50 shadow-none'
                    }`}
                  >
                    Next Question
                  </button>

                  {explanationOpen && (
                    <ExplanationPanel
                      question={mcqData.question}
                      choices={mcqData.choices}
                      answerIndex={mcqData.answer}
                      onOpenSettings={onOpenSettings}
                      onClose={() => setExplanationOpen(false)}
                    />
                  )}

                  <div className="flex items-center gap-3 justify-center pt-1">
                    <button
                      type="button"
                      onClick={handleGetContext}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-neutral-100 hover:border-neutral-600 active:scale-95 transition-all text-xs font-semibold uppercase tracking-wider"
                    >
                      <Copy size={14} />
                      <span>Get Context</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExplanationOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#00ff41]/30 bg-neutral-900 text-[#00ff41] hover:bg-[#00ff41]/10 hover:border-[#00ff41] active:scale-95 transition-all text-xs font-semibold uppercase tracking-wider"
                    >
                      <Sparkles size={14} />
                      <span>Explain</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Round Complete State */}
          {viewState === 'round-complete' && (
            <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900/80 overflow-hidden shadow-sm my-4">
              {/* Header Banner */}
              <div className="p-6 text-center border-b border-neutral-800 bg-neutral-950/40">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20">
                  <CheckCircle2 size={26} />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-neutral-100 uppercase">
                  Round Complete
                </h2>
                <div className="mt-2.5 inline-block bg-neutral-950 border border-neutral-800 px-3.5 py-1 rounded-lg">
                  <span className="text-xs font-mono font-semibold text-[#00ff41]">
                    {partitionFlawlessCount} / {currentPartition.length} flawless answers
                  </span>
                </div>
              </div>

              {/* Question Review List for the Round */}
              <div className="p-4 sm:p-6 flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto">
                {currentPartition.map((c, idx) => {
                  const mcq = c.data as MCQData
                  const stat = cardStats[c.id]
                  const isFlawless = stat?.wasCorrectFirstTry === true
                  const correctAnswerText = mcq.choices[mcq.answer]
                  const isExpanded = openExplanationRowId === c.id

                  return (
                    <div
                      key={c.id}
                      className="rounded-xl border border-neutral-800/80 bg-neutral-950/70 p-3.5 text-left"
                    >
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <span className="text-[11px] font-mono font-semibold text-neutral-400">
                          Q{partitionStartPos + idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          {!isFlawless && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                              Missed
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setOpenExplanationRowId(isExpanded ? null : c.id)}
                            title={isExpanded ? 'Hide explanation' : 'AI Explain'}
                            className={`p-1.5 rounded-lg transition-all border ${
                              isExpanded
                                ? 'border-[#00ff41] text-[#00ff41] bg-[#00ff41]/10 shadow-[0_0_8px_rgba(0,255,65,0.2)]'
                                : 'border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41]/10 hover:border-[#00ff41]'
                            }`}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-neutral-200 font-medium mb-2 leading-relaxed">
                        {mcq.question}
                      </p>
                      <div className="flex items-start gap-1.5 text-xs text-[#00ff41] font-mono">
                        <span className="font-bold">✓</span>
                        <span className="break-words">{correctAnswerText}</span>
                      </div>

                      {/* AI Explanation Panel */}
                      {isExpanded && (
                        <ExplanationPanel
                          question={mcq.question}
                          choices={mcq.choices}
                          answerIndex={mcq.answer}
                          onOpenSettings={onOpenSettings}
                          onClose={() => setOpenExplanationRowId(null)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t border-neutral-800 bg-neutral-950/40 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleStartNextRound}
                  className="flex-1 rounded-xl bg-[#00ff41] py-3 text-xs font-bold uppercase tracking-wider text-neutral-950 hover:bg-[#00ff41]/90 active:scale-95 shadow-[0_0_15px_rgba(0,255,65,0.25)] transition-all"
                >
                  Continue Round {currentPartitionIndex + 2}
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-300 hover:bg-neutral-800 active:scale-95 transition-all"
                >
                  Exit
                </button>
              </div>
            </div>
          )}

          {/* Set Complete State */}
          {viewState === 'set-complete' && (
            <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900/80 overflow-hidden shadow-sm my-4">
              {/* Header Banner */}
              <div className="p-6 text-center border-b border-neutral-800 bg-neutral-950/40">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20 shadow-[0_0_20px_rgba(0,255,65,0.2)]">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-neutral-100 uppercase">
                  Set Complete! 🎉
                </h2>
                <div className="mt-2.5 inline-block bg-neutral-950 border border-neutral-800 px-4 py-1.5 rounded-lg">
                  <span className="text-sm font-mono font-bold text-[#00ff41]">
                    {totalFlawlessCount} / {cards.length} flawless answers
                  </span>
                </div>
              </div>

              {/* Question Review List for the Entire Set */}
              <div className="p-4 sm:p-6 flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto">
                {cards.map((c, idx) => {
                  const mcq = c.data as MCQData
                  const stat = cardStats[c.id]
                  const isFlawless = stat?.wasCorrectFirstTry === true
                  const correctAnswerText = mcq.choices[mcq.answer]
                  const isExpanded = openExplanationRowId === c.id

                  return (
                    <div
                      key={c.id}
                      className="rounded-xl border border-neutral-800/80 bg-neutral-950/70 p-3.5 text-left"
                    >
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <span className="text-[11px] font-mono font-semibold text-neutral-400">
                          Q{idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          {!isFlawless && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                              Missed
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setOpenExplanationRowId(isExpanded ? null : c.id)}
                            title={isExpanded ? 'Hide explanation' : 'AI Explain'}
                            className={`p-1.5 rounded-lg transition-all border ${
                              isExpanded
                                ? 'border-[#00ff41] text-[#00ff41] bg-[#00ff41]/10 shadow-[0_0_8px_rgba(0,255,65,0.2)]'
                                : 'border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41]/10 hover:border-[#00ff41]'
                            }`}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-neutral-200 font-medium mb-2 leading-relaxed">
                        {mcq.question}
                      </p>
                      <div className="flex items-start gap-1.5 text-xs text-[#00ff41] font-mono">
                        <span className="font-bold">✓</span>
                        <span className="break-words">{correctAnswerText}</span>
                      </div>

                      {/* AI Explanation Panel */}
                      {isExpanded && (
                        <ExplanationPanel
                          question={mcq.question}
                          choices={mcq.choices}
                          answerIndex={mcq.answer}
                          onOpenSettings={onOpenSettings}
                          onClose={() => setOpenExplanationRowId(null)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t border-neutral-800 bg-neutral-950/40 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleRestartSet}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#00ff41] py-3 text-xs font-bold uppercase tracking-wider text-neutral-950 hover:bg-[#00ff41]/90 active:scale-95 shadow-[0_0_15px_rgba(0,255,65,0.25)] transition-all"
                >
                  <RotateCcw size={14} />
                  <span>Study Again</span>
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-300 hover:bg-neutral-800 active:scale-95 transition-all"
                >
                  Back to Topics
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Toast Notification */}
      {showContextToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-xs font-medium text-neutral-200 shadow-lg animate-in fade-in slide-in-from-bottom-2">
          Context copied — paste into ChatGPT, Gemini, or Claude
        </div>
      )}

      {/* Image Lightbox */}
      <ImageLightbox
        src={lightboxSrc}
        alt="Diagram"
        onClose={() => setLightboxSrc(null)}
      />
    </div>
  )
}
export default LearnSession
