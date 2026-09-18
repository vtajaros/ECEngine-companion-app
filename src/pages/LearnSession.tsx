import { useState, useEffect, useRef, useMemo } from 'react'
import { ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, RotateCcw, Sparkles, Copy, Bookmark } from 'lucide-react'
import { dbService } from '../services/db.service'
import { bookmarkService } from '../services/bookmark.service'
import { Card, MCQData } from '../types'
import { renderMath, renderPlainText } from '../lib/latex'
import { ExplanationPanel } from '../components/ExplanationPanel'
import { resolveImageSrc } from '../services/image.service'
import { ImageLightbox } from '../components/ImageLightbox'
import { buildLearnQueue } from '../lib/learnPipeline'
import type { LearnPipelineSettings } from '../lib/learnPipeline'
import { reshuffleCardChoices } from '../lib/scrambler'
import { useTTS } from '../hooks/useTTS'
import { useSound } from '../hooks/useSound'
import { App as CapacitorApp } from '@capacitor/app'
import { LeaveConfirmModal } from '../components/LeaveConfirmModal'
import { copyToClipboard } from '../services/clipboard.service'

interface LearnSessionProps {
  topicId: string
  topicName?: string
  onExit: () => void
  onOpenSettings?: () => void
  learnSettings?: LearnPipelineSettings
  ttsEnabled?: boolean
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

export function LearnSession({ topicId, topicName, onExit, onOpenSettings, learnSettings, ttsEnabled }: LearnSessionProps) {
  const { speak, stop } = useTTS()
  const { play } = useSound()
  const [cards, setCards] = useState<Card[]>([])
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [partitions, setPartitions] = useState<Card[][]>([])
  const [currentPartitionIndex, setCurrentPartitionIndex] = useState(0)

  // Queue for the current pass within the active round (recycles wrong cards)
  const [activeQueue, setActiveQueue] = useState<Card[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [partitionWrongIds, setPartitionWrongIds] = useState<Set<string>>(new Set())

  // Session-scoped attempt tracking (first attempt dictates wasCorrectFirstTry and usedIDK)
  const [cardStats, setCardStats] = useState<Record<string, { wasCorrectFirstTry: boolean; usedIDK: boolean; attemptCount: number }>>({})

  // ID of summary review card with AI explanation currently expanded (null = none)
  const [openExplanationRowId, setOpenExplanationRowId] = useState<string | null>(null)

  // Active question feedback AI explanation toggle
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [showContextToast, setShowContextToast] = useState(false)

  // Solution reveal gating (500ms delay when solution content is available)
  const [showSolution, setShowSolution] = useState(false)
  const solutionRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Lazy image URI state for current active card
  const [questionImageSrc, setQuestionImageSrc] = useState<string | null>(null)
  const [solutionImageSrc, setSolutionImageSrc] = useState<string | null>(null)

  // Fullscreen image lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const lightboxSrcRef = useRef<string | null>(null)
  useEffect(() => {
    lightboxSrcRef.current = lightboxSrc
  }, [lightboxSrc])

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Answer state for current active card
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [viewState, setViewState] = useState<'question' | 'feedback' | 'round-complete' | 'set-complete'>('question')

  // Exit confirmation modal state
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const showExitConfirmRef = useRef(showExitConfirm)
  useEffect(() => {
    showExitConfirmRef.current = showExitConfirm
  }, [showExitConfirm])

  const isActiveStudyState = viewState === 'question' || viewState === 'feedback' || viewState === 'round-complete'
  const isActiveStudyStateRef = useRef(isActiveStudyState)

  useEffect(() => {
    isActiveStudyStateRef.current = isActiveStudyState
  }, [isActiveStudyState])

  // Intercept hardware/gesture back button on Android
  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      // 1. If image lightbox is open, close image preview only
      if (lightboxSrcRef.current) {
        setLightboxSrc(null)
        return
      }
      // 2. If exit confirm modal is open, dismiss the modal
      if (showExitConfirmRef.current) {
        setShowExitConfirm(false)
        return
      }
      // 3. Otherwise, check study state
      if (isActiveStudyStateRef.current) {
        setShowExitConfirm(true)
      } else {
        onExit()
      }
    })
    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {})
    }
  }, [onExit])

  // Fetch topic cards on mount (cards + bookmarks fire in parallel)
  useEffect(() => {
    let isCancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset loading/error state for async card fetch
    setIsLoading(true)
    setError(null)

    // Fire both fetches concurrently — neither blocks the other
    Promise.all([
      dbService.getAllCardsByTopic(topicId),
      bookmarkService.getAll(),
    ])
      .then(async ([allCards, savedBookmarks]) => {
        if (isCancelled) return
        const mcqCards = allCards.filter((c) => c.type === 'mcq')
        // Run the pipeline (filter/shuffle/sample) if settings were provided
        const queue = learnSettings ? await buildLearnQueue(mcqCards, learnSettings) : mcqCards
        setCards(queue)
        setBookmarkedIds(savedBookmarks)
        const parts = partitionCards(queue, 5, 3)
        setPartitions(parts)
        setCurrentPartitionIndex(0)
        setActiveQueue(parts[0] ? [...parts[0]] : [])
        setCurrentCardIndex(0)
        setPartitionWrongIds(new Set())
        setCardStats({})
        setOpenExplanationRowId(null)
        setExplanationOpen(false)
        setShowSolution(false)
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
      stop()
    }
  }, [topicId, learnSettings, stop])

  const currentPartition = partitions[currentPartitionIndex] || []
  const currentCard = activeQueue[currentCardIndex]
  const mcqData = (currentCard?.data as MCQData) || null
  const overallQuestionNumber = currentCard
    ? cards.findIndex((c) => c.id === currentCard.id) + 1
    : 0
  const isRetryPass = activeQueue.length < currentPartition.length
  const isCurrentCardBookmarked = currentCard ? bookmarkedIds.has(currentCard.id) : false

  const questionHtml = useMemo(
    () => (mcqData?.question ? renderMath(mcqData.question) : ''),
    [mcqData]
  )

  const choicesHtml = useMemo(() => {
    if (!mcqData?.choices) return []
    return mcqData.choices.map((choice, idx) =>
      (mcqData.choicesPlainText?.[idx] ? renderPlainText : renderMath)(choice)
    )
  }, [mcqData])

  const explanationHtml = useMemo(
    () => (mcqData?.explanation ? renderMath(mcqData.explanation) : ''),
    [mcqData]
  )

  const handleToggleBookmark = async () => {
    if (!currentCard) return
    const updated = await bookmarkService.toggle(currentCard.id)
    setBookmarkedIds(updated)
  }

  // TTS: speak the question when a new card is shown in question state
  useEffect(() => {
    if (ttsEnabled && currentCard && viewState === 'question' && mcqData?.question) {
      speak(mcqData.question)
    }
    return () => {
      stop()
    }
  }, [currentCard, viewState, ttsEnabled, mcqData?.question, speak, stop])

  // Solution delay: 0.5s delay before revealing solution in feedback mode
  useEffect(() => {
    const hasSolution = Boolean(mcqData?.explanation || mcqData?.solutionImagePath)
    if (viewState === 'feedback' && hasSolution) {
      const timer = setTimeout(() => setShowSolution(true), 500)
      return () => clearTimeout(timer)
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset delayed solution visibility outside feedback mode
      setShowSolution(false)
    }
  }, [viewState, currentCard?.id, mcqData?.explanation, mcqData?.solutionImagePath])

  // Autoscroll to solution block when revealed
  useEffect(() => {
    if (showSolution && solutionRef.current) {
      solutionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [showSolution])

  // Reset scroll container to top when transitioning questions or rounds
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [currentCardIndex, currentPartitionIndex])

  // Resolve question & solution images lazily for the active card
  useEffect(() => {
    let isCancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Clear previous image URLs before async resolution
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

  const handleGetContext = async () => {
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
    const success = await copyToClipboard(template)
    if (success) {
      setShowContextToast(true)
      setTimeout(() => setShowContextToast(false), 2500)
    }
  }

  const submitAnswer = (choiceIdx: number | 'idk') => {
    if (isAnswered || viewState !== 'question' || !currentCard || !mcqData) return

    // Stop TTS when user selects an answer — mirrors desktop's stop-on-answer behavior
    stop()

    const isIdk = choiceIdx === 'idk'
    const isCorrect = !isIdk && choiceIdx === mcqData.answer
    const cardId = currentCard.id

    setSelectedChoiceIndex(isIdk ? null : choiceIdx)
    setIsAnswered(true)
    setViewState('feedback')
    play(isCorrect ? 'correct' : 'wrong')

    // Track first-try flawless stat and IDK status once per card
    setCardStats((prev) => {
      const prevStat = prev[cardId] ?? { wasCorrectFirstTry: false, usedIDK: false, attemptCount: 0 }
      const isFirstAttempt = prevStat.attemptCount === 0
      return {
        ...prev,
        [cardId]: {
          attemptCount: prevStat.attemptCount + 1,
          wasCorrectFirstTry: isFirstAttempt ? isCorrect : prevStat.wasCorrectFirstTry,
          usedIDK: isFirstAttempt ? isIdk : prevStat.usedIDK,
        },
      }
    })

    // Track wrong answers for recycling in the current pass (IDK is treated as wrong)
    setPartitionWrongIds((prev) => {
      const next = new Set(prev)
      if (isCorrect) {
        next.delete(cardId)
      } else {
        next.add(cardId)
      }
      return next
    })
  }

  const handleNext = () => {
    // Guard: if item has a solution, do not allow Next until solution is displayed
    const hasSolution = Boolean(mcqData?.explanation || mcqData?.solutionImagePath)
    if (viewState === 'feedback' && hasSolution && !showSolution) {
      return
    }

    if (currentCardIndex < activeQueue.length - 1) {
      // Advance to next question in activeQueue
      setCurrentCardIndex((prev) => prev + 1)
      setSelectedChoiceIndex(null)
      setIsAnswered(false)
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
          play('finish')
        } else {
          setViewState('round-complete')
          play('roundComplete')
        }
      } else {
        // Recycle missed cards for another pass (reshuffle choices if shuffleChoices is on)
        const nextQueue = activeQueue
          .filter((c) => partitionWrongIds.has(c.id))
          .map((c) => (learnSettings?.shuffleChoices ? reshuffleCardChoices(c) : c))
        setActiveQueue(nextQueue)
        setCurrentCardIndex(0)
        setPartitionWrongIds(new Set())
        setSelectedChoiceIndex(null)
        setIsAnswered(false)
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
    setViewState('question')
  }

  // Summary counts
  const partitionFlawlessCount = currentPartition.filter((c) => cardStats[c.id]?.wasCorrectFirstTry).length
  const totalFlawlessCount = cards.filter((c) => cardStats[c.id]?.wasCorrectFirstTry).length
  const isSummaryState = viewState === 'round-complete' || viewState === 'set-complete'

  return (
    <div
      ref={scrollContainerRef}
      className={`flex h-full flex-col bg-neutral-950 text-neutral-50 ${isSummaryState ? 'overflow-hidden' : 'overflow-y-auto'}`}
    >
      {/* Top Header */}
      <header className="shrink-0 sticky top-0 z-20 border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (isActiveStudyState) {
                  setShowExitConfirm(true)
                } else {
                  onExit()
                }
              }}
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
      <main
        className={`flex-1 px-4 sm:px-6 flex flex-col ${
          isSummaryState
            ? 'min-h-0 justify-start pt-2 pb-3'
            : 'py-6 pb-16'
        }`}
      >
        <div className={`mx-auto max-w-3xl w-full ${isSummaryState ? 'flex-1 flex flex-col min-h-0' : 'my-auto'}`}>
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
              <div className="relative rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 sm:p-7 shadow-sm">
                {/* Bookmark Toggle — visible in both question and feedback states */}
                <button
                  type="button"
                  onClick={handleToggleBookmark}
                  title={isCurrentCardBookmarked ? 'Remove bookmark' : 'Bookmark this question'}
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-500 hover:text-[#00ff41] active:scale-90 transition-all"
                >
                  <Bookmark
                    size={18}
                    className={isCurrentCardBookmarked ? 'fill-[#00ff41] text-[#00ff41]' : ''}
                  />
                </button>
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
                <h2
                  className="text-base sm:text-lg font-medium text-neutral-100 leading-relaxed break-words"
                  dangerouslySetInnerHTML={{ __html: questionHtml }}
                />

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
                      loading="lazy"
                      decoding="async"
                      className="max-h-64 w-full object-contain rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* Choices List */}
              <div className="flex flex-col gap-2.5">
                {mcqData.choices.map((_, idx) => {
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
                      onClick={() => submitAnswer(idx)}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 sm:p-4 text-left transition-all active:scale-[0.99] ${btnStyle}`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold leading-none ${badgeStyle}`}>
                        {letter}
                      </span>
                      <span
                        className="text-sm sm:text-base leading-snug break-words flex-1 pt-0.5"
                        dangerouslySetInnerHTML={{ __html: choicesHtml[idx] }}
                      />
                    </button>
                  )
                })}
              </div>

              {/* I Don't Know Button */}
              {viewState === 'question' && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => submitAnswer('idk')}
                    className="px-8 py-2.5 rounded-xl border border-neutral-700 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:border-neutral-600 hover:text-neutral-200 active:scale-95 transition-all text-xs font-bold uppercase tracking-wider"
                  >
                    I Don't Know
                  </button>
                </div>
              )}

              {/* Solution Field (Feedback state, gated by showSolution) */}
              {viewState === 'feedback' && showSolution && ((mcqData.explanation && mcqData.explanation.trim() !== '') || solutionImageSrc) && (
                <div
                  ref={solutionRef}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/90 p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-3"
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#00ff41] flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    <span>Solution</span>
                  </div>
                  {mcqData.explanation && mcqData.explanation.trim() !== '' && (
                    <div
                      className="text-xs sm:text-sm text-neutral-300 leading-relaxed break-words"
                      dangerouslySetInnerHTML={{ __html: explanationHtml }}
                    />
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
                        loading="lazy"
                        decoding="async"
                        className="max-h-64 w-full object-contain rounded-lg"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Next Button + Context/Explain Buttons */}
              {viewState === 'feedback' && (
                <div className="pt-2 flex flex-col gap-3">
                  {(() => {
                    const hasSolution = Boolean(mcqData?.explanation || mcqData?.solutionImagePath)
                    const isNextDisabled = viewState === 'feedback' && hasSolution && !showSolution
                    return (
                      <button
                        type="button"
                        disabled={isNextDisabled}
                        onClick={handleNext}
                        className={`w-full rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all shadow-md active:scale-[0.98] ${
                          isNextDisabled
                            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50 shadow-none'
                            : 'bg-[#00ff41] text-neutral-950 hover:bg-[#00ff41]/90 shadow-[0_0_15px_rgba(0,255,65,0.25)]'
                        }`}
                      >
                        Next Question
                      </button>
                    )
                  })()}

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
            <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-neutral-800 bg-neutral-900/80 overflow-hidden shadow-sm my-1">
              {/* Header Banner - Compact height */}
              <div className="shrink-0 py-3.5 px-4 text-center border-b border-neutral-800 bg-neutral-950/40">
                <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20 shadow-[0_0_12px_rgba(0,255,65,0.15)]">
                  <CheckCircle2 size={18} />
                </div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-neutral-100 uppercase">
                  Round Complete
                </h2>
                <div className="mt-1 inline-block bg-neutral-950 border border-neutral-800 px-2.5 py-0.5 rounded-md">
                  <span className="text-[11px] sm:text-xs font-mono font-semibold text-[#00ff41]">
                    {partitionFlawlessCount} / {currentPartition.length} flawless answers
                  </span>
                </div>
              </div>

              {/* Question Review List for the Round */}
              <div className="flex-1 min-h-0 p-3 sm:p-4 flex flex-col gap-2 overflow-y-auto">
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
                          {!isFlawless && stat?.usedIDK && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              IDK
                            </span>
                          )}
                          {!isFlawless && !stat?.usedIDK && (
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
                      <div
                        className="text-xs sm:text-sm text-neutral-200 font-medium mb-2 leading-relaxed break-words"
                        dangerouslySetInnerHTML={{ __html: renderMath(mcq.question) }}
                      />
                      <div className="flex items-start gap-1.5 text-xs text-[#00ff41] font-mono">
                        <span className="font-bold">✓</span>
                        <span
                          className="break-words font-sans"
                          dangerouslySetInnerHTML={{
                            __html: mcq.choicesPlainText?.[mcq.answer]
                              ? renderPlainText(correctAnswerText)
                              : renderMath(correctAnswerText),
                          }}
                        />
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
              <div className="shrink-0 p-3 sm:p-4 border-t border-neutral-800 bg-neutral-950/40 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleStartNextRound}
                  className="flex-1 rounded-xl bg-[#00ff41] py-2.5 sm:py-3 text-xs font-bold uppercase tracking-wider text-neutral-950 hover:bg-[#00ff41]/90 active:scale-95 shadow-[0_0_15px_rgba(0,255,65,0.25)] transition-all"
                >
                  Continue Round {currentPartitionIndex + 2}
                </button>
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(true)}
                  className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-2.5 sm:py-3 text-xs font-semibold uppercase tracking-wider text-neutral-300 hover:bg-neutral-800 active:scale-95 transition-all"
                >
                  Exit
                </button>
              </div>
            </div>
          )}

          {/* Set Complete State */}
          {viewState === 'set-complete' && (
            <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-neutral-800 bg-neutral-900/80 overflow-hidden shadow-sm my-1">
              {/* Header Banner - Compact height */}
              <div className="shrink-0 py-3.5 px-4 text-center border-b border-neutral-800 bg-neutral-950/40">
                <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20 shadow-[0_0_16px_rgba(0,255,65,0.2)]">
                  <CheckCircle2 size={20} />
                </div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-100 uppercase">
                  Set Complete! 🎉
                </h2>
                <div className="mt-1 inline-block bg-neutral-950 border border-neutral-800 px-3 py-0.5 rounded-md">
                  <span className="text-xs sm:text-sm font-mono font-bold text-[#00ff41]">
                    {totalFlawlessCount} / {cards.length} flawless answers
                  </span>
                </div>
              </div>

              {/* Question Review List for the Entire Set */}
              <div className="flex-1 min-h-0 p-3 sm:p-4 flex flex-col gap-2 overflow-y-auto">
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
                          {!isFlawless && stat?.usedIDK && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              IDK
                            </span>
                          )}
                          {!isFlawless && !stat?.usedIDK && (
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
                      <div
                        className="text-xs sm:text-sm text-neutral-200 font-medium mb-2 leading-relaxed break-words"
                        dangerouslySetInnerHTML={{ __html: renderMath(mcq.question) }}
                      />
                      <div className="flex items-start gap-1.5 text-xs text-[#00ff41] font-mono">
                        <span className="font-bold">✓</span>
                        <span
                          className="break-words font-sans"
                          dangerouslySetInnerHTML={{
                            __html: mcq.choicesPlainText?.[mcq.answer]
                              ? renderPlainText(correctAnswerText)
                              : renderMath(correctAnswerText),
                          }}
                        />
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
              <div className="shrink-0 p-3 sm:p-4 border-t border-neutral-800 bg-neutral-950/40 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleRestartSet}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#00ff41] py-2.5 sm:py-3 text-xs font-bold uppercase tracking-wider text-neutral-950 hover:bg-[#00ff41]/90 active:scale-95 shadow-[0_0_15px_rgba(0,255,65,0.25)] transition-all"
                >
                  <RotateCcw size={14} />
                  <span>Study Again</span>
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-2.5 sm:py-3 text-xs font-semibold uppercase tracking-wider text-neutral-300 hover:bg-neutral-800 active:scale-95 transition-all"
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

      {/* Leave Confirmation Modal */}
      <LeaveConfirmModal
        isOpen={showExitConfirm}
        onConfirm={() => {
          stop() // cancel any in-flight TTS speech, matches desktop
          setShowExitConfirm(false)
          onExit()
        }}
        onCancel={() => setShowExitConfirm(false)}
      />
    </div>
  )
}
export default LearnSession
