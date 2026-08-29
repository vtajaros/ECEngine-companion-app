import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
import { Card, MCQData } from '../types'
import {
  Bookmark,
  Clock,
  ArrowRight,
  RefreshCw,
  ClipboardCheck,
  X,
  AlertTriangle,
  Copy,
  Sparkles,
  Check,
  CheckCircle2,
} from 'lucide-react'
import { shuffle, shuffleChoices, isSafeToShuffleChoices } from '../lib/scrambler'
import { renderMath, renderPlainText } from '../lib/latex'
import { ExplanationPanel } from '../components/ExplanationPanel'
import { ImageLightbox } from '../components/ImageLightbox'
import { LeaveConfirmModal } from '../components/LeaveConfirmModal'
import { bookmarkService } from '../services/bookmark.service'
import { resolveImageSrc } from '../services/image.service'
import { weightedSample, plainSample } from '../lib/sampling'
import { App as CapacitorApp } from '@capacitor/app'
import { TestNavRail } from '../components/TestNavRail'
import { useSound } from '../hooks/useSound'

export interface TestSettings {
  instantChecking: boolean
  shuffleQuestions: boolean
  shuffleChoices: boolean
  bookmarkedOnly: boolean
  itemCount?: 'All' | number
  randomSample?: boolean
}

export interface TestModeProps {
  cards: Card[]
  title?: string
  settings: TestSettings
  onComplete?: (stats: { score: number; total: number; bookmarked: number; correctIds: string[] }) => void
  onExit: () => void
}

type ViewState = 'test' | 'summary' | 'review'

// ─── Memoized Question Card ───────────────────────────────────────────────────
interface TestQuestionCardProps {
  card: Card
  index: number
  viewState: ViewState
  answers: Record<string, number>
  bookmarkedIds: Set<string>
  settings: { instantChecking: boolean }
  openExplanationId: number | null
  questionImageSrc: string | null
  solutionImageSrc: string | null
  onSelectChoice: (cardId: string, choiceIndex: number) => void
  onToggleBookmark: (cardId: string) => void
  onToggleExplanation: (index: number) => void
  onGetContext: (mcq: MCQData) => void
  onOpenLightbox: (src: string) => void
}

const TestQuestionCard = memo(function TestQuestionCard({
  card,
  index,
  viewState,
  answers,
  bookmarkedIds,
  settings,
  openExplanationId,
  questionImageSrc,
  solutionImageSrc,
  onSelectChoice,
  onToggleBookmark,
  onToggleExplanation,
  onGetContext,
  onOpenLightbox,
}: TestQuestionCardProps) {
  const mcq = (card.data as MCQData) || null

  if (!mcq || typeof mcq === 'string' || !Array.isArray(mcq.choices) || mcq.choices.length !== 4) {
    return (
      <div className="rounded-2xl p-6 border border-red-500/30 bg-red-500/5 text-red-400">
        <p className="font-bold uppercase tracking-wider text-xs mb-1">Card Load Error</p>
        <p className="text-xs text-neutral-400">Question data could not be parsed.</p>
      </div>
    )
  }

  const userAnswer = answers[card.id]
  const isAnswered = userAnswer !== undefined
  const isCorrect = isAnswered && userAnswer === mcq.answer
  const isBookmarked = bookmarkedIds.has(card.id)

  const showFeedback = viewState === 'review' || (settings.instantChecking && isAnswered)

  return (
    <div
      id={`test-question-${index}`}
      className={`rounded-2xl border transition-all duration-200 scroll-mt-24 overflow-hidden shadow-lg ${
        showFeedback
          ? isCorrect
            ? 'border-[#00ff41]/40 bg-[#00ff41]/[0.03]'
            : isAnswered
              ? 'border-red-500/40 bg-red-500/[0.03]'
              : 'border-neutral-800 bg-neutral-900/90'
          : isAnswered
            ? 'border-neutral-700 bg-neutral-900/90'
            : 'border-neutral-800 bg-neutral-900/60'
      }`}
    >
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-neutral-800/80 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-mono text-xs font-bold text-[#00ff41] bg-[#00ff41]/10 px-2 py-0.5 rounded-md border border-[#00ff41]/20">
              Q{index + 1}
            </span>
            {showFeedback && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                  isCorrect
                    ? 'bg-[#00ff41]/20 text-[#00ff41] border border-[#00ff41]/30'
                    : isAnswered
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {isCorrect ? 'Correct' : isAnswered ? 'Incorrect' : 'Unanswered'}
              </span>
            )}
          </div>

          <h3
            className="text-base sm:text-lg font-medium text-neutral-100 leading-relaxed break-words"
            dangerouslySetInnerHTML={{ __html: renderMath(mcq.question) }}
          />

          {questionImageSrc && (
            <div className="mt-4 flex justify-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/60 p-2">
              <img
                src={questionImageSrc}
                alt="Question diagram"
                className="max-h-64 max-w-full object-contain cursor-zoom-in rounded-lg"
                onClick={() => onOpenLightbox(questionImageSrc)}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onToggleBookmark(card.id)}
          className={`p-2 rounded-xl border transition-all shrink-0 ${
            isBookmarked
              ? 'border-[#00ff41]/40 bg-[#00ff41]/10 text-[#00ff41]'
              : 'border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60'
          }`}
          title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
        >
          <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Choices Grid */}
      <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((cIdx) => {
          const choice = mcq.choices[cIdx]
          if (choice === undefined) return null

          const isSelected = userAnswer === cIdx
          const choiceLabel = String.fromCharCode(65 + cIdx)

          let stateStyles = 'border-neutral-800 bg-neutral-950/60 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800/40'
          let prefixStyles = 'text-neutral-500'
          let iconElement: React.ReactNode = null

          if (showFeedback) {
            const isChoiceCorrect = cIdx === mcq.answer
            if (isChoiceCorrect) {
              stateStyles = 'border-[#00ff41] bg-[#00ff41]/10 text-[#00ff41] shadow-[0_0_12px_rgba(0,255,65,0.15)]'
              prefixStyles = 'text-[#00ff41] font-bold'
              iconElement = <Check className="w-4 h-4 text-[#00ff41] font-bold" />
            } else if (isSelected && !isChoiceCorrect) {
              stateStyles = 'border-red-500 bg-red-500/10 text-red-300'
              prefixStyles = 'text-red-400 font-bold'
              iconElement = <X className="w-4 h-4 text-red-400 font-bold" />
            } else {
              stateStyles = 'border-neutral-900 bg-neutral-950/30 text-neutral-600 opacity-50'
              prefixStyles = 'text-neutral-700'
            }
          } else if (isSelected) {
            stateStyles = 'border-[#00ff41] bg-[#00ff41]/10 text-[#00ff41] font-medium'
            prefixStyles = 'text-[#00ff41] font-bold'
          }

          const isLocked = viewState === 'review' || (settings.instantChecking && isAnswered)

          return (
            <button
              key={cIdx}
              type="button"
              onClick={() => onSelectChoice(card.id, cIdx)}
              disabled={isLocked}
              className={`flex items-center text-left p-3.5 rounded-xl border transition-all duration-150 min-h-[52px] ${stateStyles} ${
                isLocked ? 'cursor-default' : 'cursor-pointer active:scale-[0.99]'
              }`}
            >
              <div className={`font-mono text-xs font-bold mr-3 shrink-0 ${prefixStyles}`}>
                {choiceLabel}.
              </div>
              <span
                className="flex-1 text-sm leading-normal break-words"
                dangerouslySetInnerHTML={{
                  __html: (mcq.choicesPlainText?.[cIdx] ? renderPlainText : renderMath)(choice),
                }}
              />
              {iconElement && <div className="ml-2 shrink-0">{iconElement}</div>}
            </button>
          )
        })}
      </div>

      {/* Solution Block */}
      {showFeedback && (mcq.explanation || solutionImageSrc) && (
        <div className="px-5 sm:px-6 pb-5 pt-1">
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
              Solution
            </span>
            {mcq.explanation && (
              <p
                className="text-xs sm:text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMath(mcq.explanation) }}
              />
            )}
            {solutionImageSrc && (
              <div className="mt-3 flex justify-center overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 p-2">
                <img
                  src={solutionImageSrc}
                  alt="Solution diagram"
                  className="max-h-60 max-w-full object-contain cursor-zoom-in rounded"
                  onClick={() => onOpenLightbox(solutionImageSrc)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review Actions */}
      {viewState === 'review' && (
        <div className="px-5 sm:px-6 pb-5 pt-1 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onGetContext(mcq)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800/60 text-neutral-300 hover:text-white hover:bg-neutral-800 text-xs font-semibold uppercase tracking-wider transition-colors"
          >
            <Copy size={13} />
            Get Context
          </button>

          <button
            type="button"
            onClick={() => onToggleExplanation(index)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold uppercase tracking-wider transition-colors ${
              openExplanationId === index
                ? 'border-[#00ff41] bg-[#00ff41]/10 text-[#00ff41]'
                : 'border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41]/10'
            }`}
          >
            <Sparkles size={13} />
            {openExplanationId === index ? 'Hide AI Explanation' : 'Explain'}
          </button>
        </div>
      )}

      {/* AI Explanation Panel */}
      {viewState === 'review' && openExplanationId === index && (
        <div className="border-t border-neutral-800">
          <ExplanationPanel
            question={mcq.question}
            choices={mcq.choices}
            answerIndex={mcq.answer}
            onClose={() => onToggleExplanation(index)}
          />
        </div>
      )}
    </div>
  )
})

// ─── Main TestMode Component ───────────────────────────────────────────────────
export function TestMode({ cards, title, settings, onComplete, onExit }: TestModeProps) {
  const { play } = useSound()
  const [testCards, setTestCards] = useState<Card[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [viewState, setViewState] = useState<ViewState>('test')
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showContextToast, setShowContextToast] = useState(false)

  const [timeElapsed, setTimeElapsed] = useState(0)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [openExplanationId, setOpenExplanationId] = useState<number | null>(null)

  // Lazy image maps for all test cards (cardId -> resolved URL)
  const [questionImages, setQuestionImages] = useState<Record<string, string>>({})
  const [solutionImages, setSolutionImages] = useState<Record<string, string>>({})

  // Navigation scroll tracking
  const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const mobileActiveChipRef = useRef<HTMLButtonElement | null>(null)

  // Auto-scroll active chip into view on mobile
  useEffect(() => {
    mobileActiveChipRef.current?.scrollIntoView({
      behavior: 'auto',
      block: 'nearest',
      inline: 'center',
    })
  }, [currentVisibleIndex])

  // Hardware back button interception
  const isActiveRef = useRef(viewState === 'test')
  useEffect(() => {
    isActiveRef.current = viewState === 'test'
  }, [viewState])

  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      if (isActiveRef.current) {
        setShowExitConfirm(true)
      } else {
        onExit()
      }
    })
    return () => {
      listenerPromise.then((handle) => handle.remove())
    }
  }, [onExit])

  // Load bookmarks on mount
  useEffect(() => {
    bookmarkService.getAll().then(setBookmarkedIds)
  }, [])

  // Initialize test cards from input props and settings
  useEffect(() => {
    // 1. Filter to MCQ cards only (no flashcard generation)
    let filtered = cards.filter((c) => c.type === 'mcq')

    // 2. Filter by bookmarks if requested
    if (settings.bookmarkedOnly) {
      filtered = filtered.filter((c) => bookmarkedIds.has(c.id))
    }

    // 3. Shuffle questions if requested
    if (settings.shuffleQuestions) {
      filtered = shuffle(filtered)
    }

    // 4. Shuffle choices if requested
    if (settings.shuffleChoices) {
      filtered = filtered.map((card) => {
        const mcq = card.data as MCQData
        if (mcq?.choices && isSafeToShuffleChoices(mcq.choices)) {
          const sc = shuffleChoices(mcq.choices, mcq.answer, mcq.choicesPlainText)
          return {
            ...card,
            data: {
              ...mcq,
              choices: sc.choices,
              answer: sc.answer,
              ...(sc.choicesPlainText ? { choicesPlainText: sc.choicesPlainText } : {}),
            },
          }
        }
        return card
      })
    }

    // 5. Apply item count / sampling if configured
    if (typeof settings.itemCount === 'number' && filtered.length > settings.itemCount) {
      if (settings.randomSample) {
        filtered = weightedSample(filtered, settings.itemCount)
      } else {
        filtered = plainSample(filtered, settings.itemCount)
      }
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initialize test deck on mount/settings change
    setTestCards(filtered)
  }, [cards, settings, bookmarkedIds])

  // Lazy resolve images for test cards
  useEffect(() => {
    let isCancelled = false

    testCards.forEach((card) => {
      const mcq = card.data as MCQData
      if (mcq?.imagePath) {
        resolveImageSrc(mcq.imagePath).then((src) => {
          if (!isCancelled && src) {
            setQuestionImages((prev) => ({ ...prev, [card.id]: src }))
          }
        })
      }
      if (mcq?.solutionImagePath) {
        resolveImageSrc(mcq.solutionImagePath).then((src) => {
          if (!isCancelled && src) {
            setSolutionImages((prev) => ({ ...prev, [card.id]: src }))
          }
        })
      }
    })

    return () => {
      isCancelled = true
    }
  }, [testCards])

  // Count-up timer during active test
  useEffect(() => {
    if (viewState !== 'test') return
    const interval = setInterval(() => setTimeElapsed((prev) => prev + 1), 1000)
    return () => clearInterval(interval)
  }, [viewState])

  // Choice selection
  const handleSelectChoice = useCallback(
    (cardId: string, choiceIndex: number) => {
      if (viewState !== 'test') return
      if (settings.instantChecking && answers[cardId] !== undefined) return
      setAnswers((prev) => ({ ...prev, [cardId]: choiceIndex }))
      if (settings.instantChecking) {
        const card = testCards.find((c) => c.id === cardId)
        if (card) {
          const mcq = card.data as MCQData
          play(choiceIndex === mcq.answer ? 'correct' : 'wrong')
        }
      }
    },
    [viewState, settings.instantChecking, answers, testCards, play]
  )

  // Bookmark toggle
  const handleToggleBookmark = useCallback(async (cardId: string) => {
    const updated = await bookmarkService.toggle(cardId)
    setBookmarkedIds(updated)
  }, [])

  // Navigation scroll handler
  const scrollToQuestion = useCallback((index: number) => {
    setCurrentVisibleIndex(index)
    const el = document.getElementById(`test-question-${index}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // Scroll-spy observer to track current visible question
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return
    const containerTop = scrollContainerRef.current.getBoundingClientRect().top

    for (let i = 0; i < testCards.length; i++) {
      const el = document.getElementById(`test-question-${i}`)
      if (el) {
        const rect = el.getBoundingClientRect()
        // If card top is near or past the viewport top threshold
        if (rect.top - containerTop <= 160 && rect.bottom - containerTop > 40) {
          setCurrentVisibleIndex(i)
          break
        }
      }
    }
  }, [testCards.length])

  // Submit test: in-memory scoring, no DB writes
  const handleSubmit = useCallback(() => {
    setShowSubmitConfirm(false)
    let correct = 0
    testCards.forEach((card) => {
      const mcq = card.data as MCQData
      if (answers[card.id] === mcq.answer) {
        correct++
      }
    })

    const correctIds = testCards
      .filter((card) => {
        const mcq = card.data as MCQData
        return answers[card.id] === mcq.answer
      })
      .map((card) => card.id)

    setScore({ correct, total: testCards.length })
    setViewState('summary')
    play('finish')

    onComplete?.({
      score: correct,
      total: testCards.length,
      bookmarked: bookmarkedIds.size,
      correctIds,
    })
  }, [testCards, answers, bookmarkedIds.size, onComplete, play])

  // Get context for LLM
  const handleGetContext = useCallback((mcq: MCQData) => {
    const template = `---
Please explain the correct answer to this multiple choice question:

QUESTION:
${mcq.question}

CHOICES:
A. ${mcq.choices[0]}
B. ${mcq.choices[1]}
C. ${mcq.choices[2]}
D. ${mcq.choices[3]}

CORRECT ANSWER: ${String.fromCharCode(65 + mcq.answer)}. ${mcq.choices[mcq.answer]}

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
  }, [])

  const handleToggleExplanation = useCallback((index: number) => {
    setOpenExplanationId((prev) => (prev === index ? null : index))
  }, [])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const answeredCount = Object.keys(answers).length
  const passThreshold = 0.7 // 70% threshold for companion app
  const isPassed = score.total > 0 && score.correct / score.total >= passThreshold

  // Answered indices Set for navigation rail
  const answeredIndices = useMemo(() => {
    const s = new Set<number>()
    testCards.forEach((card, idx) => {
      if (answers[card.id] !== undefined) s.add(idx)
    })
    return s
  }, [answers, testCards])

  // ── Top Bar ─────────────────────────────────────────────────────────────────
  const renderTopBar = () => (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-neutral-800 bg-neutral-950/90 px-4 py-3 backdrop-blur-md shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => {
            if (viewState === 'test') setShowExitConfirm(true)
            else onExit()
          }}
          className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors shrink-0"
          title="Exit Test"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-neutral-100 uppercase tracking-wide truncate">
            {title ? `TEST: ${title}` : 'Test Mode'}
          </span>
          <span className="text-[10px] text-neutral-500 font-mono">
            {testCards.length} Questions
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-neutral-200 bg-neutral-900 px-3 py-1.5 rounded-xl border border-neutral-800">
          <Clock className="w-3.5 h-3.5 text-[#00ff41]" />
          {formatTime(timeElapsed)}
        </div>

        {viewState === 'test' ? (
          <button
            type="button"
            onClick={() => setShowSubmitConfirm(true)}
            className="rounded-xl bg-[#00ff41] px-4 py-2 text-xs font-bold uppercase tracking-wider text-black hover:bg-[#00ff41]/90 transition-all shadow-[0_0_12px_rgba(0,255,65,0.25)] active:scale-95"
          >
            Submit
          </button>
        ) : (
          <button
            type="button"
            onClick={onExit}
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-200 hover:bg-neutral-800 hover:text-white transition-all active:scale-95"
          >
            Finish Review
          </button>
        )}
      </div>
    </header>
  )

  // ── Summary Screen ──────────────────────────────────────────────────────────
  if (viewState === 'summary') {
    const percentage = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0

    return (
      <div className="h-full bg-neutral-950 flex flex-col relative overflow-hidden">
        {renderTopBar()}

        <LeaveConfirmModal
          isOpen={showExitConfirm}
          onConfirm={onExit}
          onCancel={() => setShowExitConfirm(false)}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-center">
          <div className="w-full max-w-lg rounded-3xl border border-neutral-800 bg-neutral-900/90 p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden backdrop-blur-xl">
            {/* Top Status Gradient Glow */}
            <div
              className={`absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-32 blur-3xl opacity-20 pointer-events-none rounded-full ${
                isPassed ? 'bg-[#00ff41]' : 'bg-red-500'
              }`}
            />

            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border ${
                  isPassed
                    ? 'border-[#00ff41]/30 bg-[#00ff41]/10 text-[#00ff41] shadow-[0_0_20px_rgba(0,255,65,0.2)]'
                    : 'border-red-500/30 bg-red-500/10 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                }`}
              >
                <ClipboardCheck className="w-8 h-8" />
              </div>

              <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-neutral-100 mb-1">
                Test Completed
              </h2>
              {title && (
                <p className="text-xs font-semibold uppercase tracking-wider text-[#00ff41] mb-2">
                  {title}
                </p>
              )}
              <span
                className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border mb-6 ${
                  isPassed
                    ? 'bg-[#00ff41]/10 border-[#00ff41]/30 text-[#00ff41]'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
              >
                {isPassed ? 'Passed (≥ 70%)' : 'Failed (< 70%)'}
              </span>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 w-full py-4 border-y border-neutral-800 bg-neutral-950/60 rounded-2xl mb-6">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Score</span>
                  <span
                    className={`font-mono text-2xl sm:text-3xl font-bold ${
                      isPassed ? 'text-[#00ff41]' : 'text-red-400'
                    }`}
                  >
                    {percentage}%
                  </span>
                </div>
                <div className="flex flex-col items-center border-x border-neutral-800/80">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Correct</span>
                  <span className="font-mono text-lg sm:text-xl font-bold text-neutral-200 mt-1">
                    {score.correct} <span className="text-neutral-500 text-xs">/ {score.total}</span>
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Time</span>
                  <span className="font-mono text-lg sm:text-xl font-bold text-neutral-200 mt-1">
                    {formatTime(timeElapsed)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                {score.correct < score.total && (
                  <button
                    type="button"
                    onClick={() => {
                      const wrongCards = testCards.filter((c) => {
                        const mcq = c.data as MCQData
                        return answers[c.id] !== mcq.answer
                      })
                      setTestCards(wrongCards)
                      setAnswers({})
                      setTimeElapsed(0)
                      setViewState('test')
                    }}
                    className="flex-1 py-3 px-4 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry Wrong ({score.total - score.correct})
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setViewState('review')}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#00ff41] hover:bg-[#00ff41]/90 text-black font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,255,65,0.25)] active:scale-95"
                >
                  <ArrowRight className="w-4 h-4" />
                  Review Answers
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Main Test & Review View ─────────────────────────────────────────────────
  return (
    <div className="h-full bg-neutral-950 flex flex-col relative overflow-hidden">
      {renderTopBar()}

      {/* Mobile Horizontal Item Navigator (visible on < sm screens) */}
      {testCards.length > 0 && (
        <div className="sm:hidden sticky top-0 z-30 flex items-center gap-2 border-b border-neutral-800 bg-neutral-950/95 px-3 py-2 backdrop-blur-md overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1 shrink-0 pr-2 border-r border-neutral-800 font-mono text-[11px]">
            <span className="text-[#00ff41] font-bold tabular-nums">{answeredCount}</span>
            <span className="text-neutral-600">/</span>
            <span className="text-neutral-400 tabular-nums">{testCards.length}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {testCards.map((_, i) => {
              const answered = answeredIndices.has(i)
              const isActive = i === currentVisibleIndex
              return (
                <button
                  key={i}
                  ref={isActive ? mobileActiveChipRef : null}
                  type="button"
                  onClick={() => scrollToQuestion(i)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all shrink-0 ${
                    isActive
                      ? 'bg-[#00ff41] text-black shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                      : answered
                        ? 'bg-[#00ff41]/10 border border-[#00ff41]/30 text-[#00ff41]'
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <span>Q{i + 1}</span>
                  {answered && !isActive && <Check className="w-3 h-3 text-[#00ff41] shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <LeaveConfirmModal
        isOpen={showExitConfirm}
        onConfirm={onExit}
        onCancel={() => setShowExitConfirm(false)}
      />

      <div className="flex-1 flex flex-row overflow-hidden p-3 sm:p-5 gap-4">
        {/* Left Navigation Rail (visible on sm+ screens) */}
        <div className="hidden sm:flex shrink-0">
          <TestNavRail
            totalItems={testCards.length}
            currentIndex={currentVisibleIndex}
            answeredIndices={answeredIndices}
            onNavigate={scrollToQuestion}
          />
        </div>

        {/* Right Scrollable Question List */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 min-w-0 overflow-y-auto space-y-4 pb-28 px-1 sm:px-3"
        >
          {testCards.map((card, idx) => (
            <TestQuestionCard
              key={card.id}
              card={card}
              index={idx}
              viewState={viewState}
              answers={answers}
              bookmarkedIds={bookmarkedIds}
              settings={settings}
              openExplanationId={openExplanationId}
              questionImageSrc={questionImages[card.id] || null}
              solutionImageSrc={solutionImages[card.id] || null}
              onSelectChoice={handleSelectChoice}
              onToggleBookmark={handleToggleBookmark}
              onToggleExplanation={handleToggleExplanation}
              onGetContext={handleGetContext}
              onOpenLightbox={setLightboxSrc}
            />
          ))}

          {testCards.length === 0 && (
            <div className="text-center text-neutral-500 mt-20 text-xs font-semibold uppercase tracking-widest">
              No questions available for this test.
            </div>
          )}
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShowSubmitConfirm(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="relative w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#00ff41]/10 border border-[#00ff41]/20 text-[#00ff41]">
                <AlertTriangle size={24} />
              </div>

              <h3 className="text-lg font-bold text-neutral-100 uppercase tracking-wide mb-2">
                Submit Test?
              </h3>

              {testCards.length - answeredCount > 0 ? (
                <p className="text-xs text-neutral-400 leading-relaxed mb-6">
                  You still have{' '}
                  <span className="text-amber-400 font-bold font-mono">
                    {testCards.length - answeredCount}
                  </span>{' '}
                  unanswered question(s). Are you sure you want to submit now?
                </p>
              ) : (
                <p className="text-xs text-neutral-400 leading-relaxed mb-6">
                  You have answered all {testCards.length} questions. Ready to submit and see your score?
                </p>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full rounded-xl bg-[#00ff41] py-3 text-xs font-bold uppercase tracking-wider text-black hover:bg-[#00ff41]/90 transition-all shadow-[0_0_15px_rgba(0,255,65,0.25)] active:scale-95"
                >
                  Confirm Submit
                </button>
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(false)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-300 hover:bg-neutral-800 hover:text-white transition-all"
                >
                  Keep Working
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Context Copied Toast */}
      {showContextToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-[#00ff41]/30 bg-neutral-900/95 px-4 py-2.5 shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-semibold text-[#00ff41] animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={16} />
          <span>Context copied to clipboard</span>
        </div>
      )}

      {/* Image Lightbox */}
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  )
}
