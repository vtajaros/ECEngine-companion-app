import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Heart,
  Flame,
  X,
  AlertCircle,
  Volume2,
  VolumeX,
  Bookmark,
  SkipForward,
} from 'lucide-react'
import { App as CapacitorApp } from '@capacitor/app'
import { Card, MCQData } from '../types'
import {
  GauntletArcadeConfig,
  extractFeatures,
  estimateParMs,
  difficultyWeight,
  scoreAnswer,
  isLifeBonusStreak,
  isScoreLifeBonus,
  updateSkipState,
  LINGER_CORRECT_MS,
  LINGER_WRONG_MS,
} from '../lib/gauntlet'
import { shuffleChoices, isSafeToShuffleChoices } from '../lib/scrambler'
import { shuffleArray } from '../lib/utils'
import { renderMath, renderPlainText } from '../lib/latex'
import { resolveImageSrc } from '../services/image.service'
import { bookmarkService } from '../services/bookmark.service'
import { useSound, getSoundsMuted, setSoundsMuted } from '../hooks/useSound'
import { useGauntletMusic, getSurvivalMusicRegion } from '../hooks/useGauntletMusic'
import { gauntletStorageService, GauntletStats } from '../services/gauntlet-storage.service'
import {
  GauntletSummaryModal,
  GauntletRunResult,
  GauntletMistake,
  GauntletAnswerRecord,
} from '../components/gauntlet/GauntletSummaryModal'
import { LeaveConfirmModal } from '../components/LeaveConfirmModal'
import { ImageLightbox } from '../components/ImageLightbox'
import { GauntletCountdown } from '../components/gauntlet/GauntletCountdown'

interface GauntletSessionProps {
  cards: Card[]
  config: GauntletArcadeConfig
  onExit: () => void
  onDrillMistakes?: (cards: Card[]) => void
  onLearnAll?: (cards: Card[]) => void
}

interface ActiveQuestion {
  card: Card
  mcq: MCQData
  choices: string[]
  choicesPlainText?: boolean[]
  answerIndex: number
  parMs: number
  weight: number
  imageSrc?: string | null
}

const CHOICE_LETTERS = ['A', 'B', 'C', 'D']

interface QuestionViewProps {
  cardIndex: number
  activeQuestion: ActiveQuestion
  questionHtml: string
  choicesHtml: string[]
  activeImageSrc: string | null
  selectedChoice: number | null
  isAnsweringLocked: boolean
  isBookmarked: boolean
  shakeWrong: boolean
  skipsAvailable: number
  onChoiceClick: (idx: number) => void
  onToggleBookmark: () => void
  onOpenLightbox: (src: string) => void
  onSkip: () => void
}

const QuestionView = React.memo<QuestionViewProps>(
  ({
    cardIndex,
    activeQuestion,
    questionHtml,
    choicesHtml,
    activeImageSrc,
    selectedChoice,
    isAnsweringLocked,
    isBookmarked,
    shakeWrong,
    skipsAvailable,
    onChoiceClick,
    onToggleBookmark,
    onOpenLightbox,
    onSkip,
  }) => {
    return (
      <main className="flex-1 px-4 sm:px-6 flex flex-col py-6 pb-16 overflow-y-auto">
        <div className="mx-auto max-w-3xl w-full my-auto">
          <div className="flex flex-col gap-5">
            {/* Question Card */}
            <div
              className={`relative rounded-2xl border bg-neutral-900/80 p-5 sm:p-7 shadow-sm transition-colors duration-150 overflow-hidden [transform:translate3d(0,0,0)] backface-hidden ${
                shakeWrong
                  ? 'gauntlet-card-shake border-red-500/80 shadow-[0_0_24px_rgba(239,68,68,0.25)]'
                  : 'border-neutral-800'
              }`}
            >
              {shakeWrong && (
                <div
                  aria-hidden="true"
                  className="gauntlet-edge-flash absolute inset-0 pointer-events-none rounded-2xl border-2 border-red-500 shadow-[inset_0_0_24px_rgba(239,68,68,0.5)] z-20"
                />
              )}

              {/* Bookmark Toggle */}
              <button
                type="button"
                onClick={onToggleBookmark}
                title={isBookmarked ? 'Remove bookmark' : 'Bookmark this question'}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-500 hover:text-[#00ff41] active:scale-90 transition-all z-10"
              >
                <Bookmark
                  size={18}
                  className={isBookmarked ? 'fill-[#00ff41] text-[#00ff41]' : ''}
                />
              </button>

              <div className="flex items-center justify-between gap-2 mb-3 pr-8">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-semibold text-neutral-400 bg-neutral-950/60 px-2 py-0.5 rounded border border-neutral-800">
                    Question #{cardIndex + 1}
                  </span>
                  {activeQuestion.card.subject && (
                    <span className="text-[11px] font-mono font-semibold text-neutral-400 bg-neutral-950/60 px-2 py-0.5 rounded border border-neutral-800 uppercase">
                      {activeQuestion.card.subject}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {activeQuestion.card.tosTopicId && (
                    <span className="text-[11px] font-mono font-semibold text-[#00ff41] bg-[#00ff41]/10 px-2 py-0.5 rounded border border-[#00ff41]/20">
                      {activeQuestion.card.tosTopicId}
                    </span>
                  )}
                  {activeQuestion.mcq.yearAsked && (
                    <span className="text-[10px] font-mono text-neutral-500">
                      ECE Board {activeQuestion.mcq.yearAsked}
                    </span>
                  )}
                </div>
              </div>

              <h2
                className="text-base sm:text-lg font-medium text-neutral-100 leading-relaxed break-words"
                dangerouslySetInnerHTML={{ __html: questionHtml }}
              />

              {/* Inline Diagram */}
              {activeImageSrc && (
                <div
                  onClick={() => onOpenLightbox(activeImageSrc)}
                  className="mt-4 flex justify-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/60 p-2 cursor-zoom-in active:scale-[0.98] transition-transform"
                  title="Tap to zoom"
                >
                  <img
                    src={activeImageSrc}
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
              {activeQuestion.choices.map((_, idx) => {
                const letter = CHOICE_LETTERS[idx] || String.fromCharCode(65 + idx)
                const isCorrect = idx === activeQuestion.answerIndex
                const isSelected = selectedChoice === idx

                let btnStyle =
                  'border-neutral-800 bg-neutral-900/60 text-neutral-200 hover:border-neutral-700 hover:bg-neutral-900'
                let badgeStyle = 'bg-neutral-950 text-neutral-400 border-neutral-800'

                if (isAnsweringLocked) {
                  if (isCorrect) {
                    btnStyle =
                      'border-[#00ff41] bg-[#00ff41]/10 text-[#00ff41] shadow-[0_0_12px_rgba(0,255,65,0.15)] font-semibold'
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
                    disabled={isAnsweringLocked}
                    onClick={() => onChoiceClick(idx)}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 sm:p-4 text-left transition-all active:scale-[0.99] cursor-pointer ${btnStyle}`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold leading-none ${badgeStyle}`}
                    >
                      {letter}
                    </span>
                    <span
                      className="text-sm sm:text-base leading-snug break-words flex-1 pt-0.5"
                      dangerouslySetInnerHTML={{
                        __html: choicesHtml[idx] || '',
                      }}
                    />
                  </button>
                )
              })}
            </div>

            {/* Bottom Actions: Skip Button */}
            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                disabled={isAnsweringLocked || skipsAvailable <= 0}
                onClick={onSkip}
                className="px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-neutral-400 hover:text-neutral-100 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-sm"
              >
                <SkipForward size={14} />
                SKIP ({skipsAvailable})
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }
)

export const GauntletSession: React.FC<GauntletSessionProps> = ({
  cards,
  config,
  onExit,
  onDrillMistakes,
  onLearnAll,
}) => {
  const { play } = useSound()
  const gauntletMusic = useGauntletMusic()

  // Game run state — reshuffled for each session and on "Run it Back"
  const [deckPool, setDeckPool] = useState<Card[]>(() => shuffleArray([...cards]))
  useEffect(() => {
    setDeckPool(shuffleArray([...cards]))
  }, [cards])
  const [cardIndex, setCardIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [lives, setLives] = useState(config.startingLives)
  const [mistakes, setMistakes] = useState<GauntletMistake[]>([])
  const [allAnswers, setAllAnswers] = useState<GauntletAnswerRecord[]>([])
  const [totalAnswered, setTotalAnswered] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)

  // Skip mechanics matching desktop (1 starting skip credit, +1 earned every 20 streak)
  const [skipsAvailable, setSkipsAvailable] = useState<number>(1)
  const [skipEarnStreak, setSkipEarnStreak] = useState<number>(0)

  // Audio toggle
  const [isSfxMuted, setIsSfxMuted] = useState(() => getSoundsMuted())

  // Bookmarks
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    bookmarkService.getAll().then(setBookmarkedIds).catch(() => {})
  }, [])

  // Pre-load stats for instantaneous high-score comparisons on finish
  const [gauntletStats, setGauntletStats] = useState<GauntletStats | null>(null)
  useEffect(() => {
    gauntletStorageService.getStats().then(setGauntletStats).catch(() => {})
  }, [])

  // Visual effects state matching desktop arcade feel
  const [shakeWrong, setShakeWrong] = useState(false)
  const [pulseHeart, setPulseHeart] = useState(false)

  // Countdown phase state matching desktop: allows audio buffer to pre-load and play 3-2-1-GO
  const [isCountingDown, setIsCountingDown] = useState(true)
  const isCountingDownRef = useRef(isCountingDown)
  useEffect(() => {
    isCountingDownRef.current = isCountingDown
  }, [isCountingDown])

  // Question interaction state
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [isAnsweringLocked, setIsAnsweringLocked] = useState(false)
  const [questionStartTime, setQuestionStartTime] = useState<number>(() => Date.now())
  const [sessionStartTime, setSessionStartTime] = useState<number>(() => Date.now())
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current)
    }
  }, [])

  // Timers
  const [survivalTimeLeft, setSurvivalTimeLeft] = useState(config.perQuestionSec)
  const [timeTrialTimeLeft, setTimeTrialTimeLeft] = useState(config.durationSec)

  // Floating notifications (+1 LIFE, +50 PTS)
  const [notification, setNotification] = useState<{ text: string; color: string } | null>(null)

  // Dialogs
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const showExitConfirmRef = useRef(showExitConfirm)
  useEffect(() => {
    showExitConfirmRef.current = showExitConfirm
  }, [showExitConfirm])

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const lightboxSrcRef = useRef<string | null>(null)
  useEffect(() => {
    lightboxSrcRef.current = lightboxSrc
  }, [lightboxSrc])

  const [runResult, setRunResult] = useState<GauntletRunResult | null>(null)
  const runResultRef = useRef<GauntletRunResult | null>(null)
  useEffect(() => {
    runResultRef.current = runResult
  }, [runResult])

  const handleCountdownCancel = useCallback(() => {
    gauntletMusic.stop(0.3)
    onExit()
  }, [gauntletMusic, onExit])

  const handleCountdownBegin = useCallback(() => {
    setIsCountingDown(false)
    setSessionStartTime(Date.now())
    setQuestionStartTime(Date.now())
    gauntletMusic.setState(config.mode === 'survival' ? 'enemiesNearby' : 'battle1')
  }, [config.mode, gauntletMusic])

  // Intercept hardware/gesture back button on Android
  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      if (lightboxSrcRef.current) {
        setLightboxSrc(null)
        return
      }
      if (isCountingDownRef.current) {
        handleCountdownCancel()
        return
      }
      if (runResultRef.current) {
        onExit()
        return
      }
      if (showExitConfirmRef.current) {
        setShowExitConfirm(false)
        return
      }
      setShowExitConfirm(true)
    })
    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {})
    }
  }, [onExit, handleCountdownCancel])

  // Start background music on mount with stealth ambient for countdown, and clean up on exit
  useEffect(() => {
    gauntletMusic.start('stealth')
    return () => {
      gauntletMusic.stop(0.4)
    }
  }, [gauntletMusic])

  // Active question resolution
  const currentCard = deckPool[cardIndex % (deckPool.length || 1)]
  const currentMcq = currentCard?.data as MCQData
  const isCurrentCardBookmarked = currentCard ? bookmarkedIds.has(currentCard.id) : false

  const handleToggleBookmark = useCallback(async () => {
    if (!currentCard) return
    const updated = await bookmarkService.toggle(currentCard.id)
    setBookmarkedIds(updated)
  }, [currentCard])

  const activeQuestion: ActiveQuestion | null = useMemo(() => {
    if (!currentCard || !currentMcq || !Array.isArray(currentMcq.choices)) return null

    const rawChoices = currentMcq.choices
    const rawAnswer = currentMcq.answer ?? 0

    let finalChoices = [...rawChoices]
    let finalAnswer = rawAnswer
    let finalChoicesPlainText = currentMcq.choicesPlainText

    if (isSafeToShuffleChoices(rawChoices)) {
      const scrambled = shuffleChoices(rawChoices, rawAnswer, currentMcq.choicesPlainText)
      finalChoices = scrambled.choices
      finalAnswer = scrambled.answer
      finalChoicesPlainText = scrambled.choicesPlainText
    }

    const feats = extractFeatures(currentMcq)
    const parMs = estimateParMs(feats)
    const weight = difficultyWeight(parMs)

    return {
      card: currentCard,
      mcq: currentMcq,
      choices: finalChoices,
      choicesPlainText: finalChoicesPlainText,
      answerIndex: finalAnswer,
      parMs,
      weight,
    }
  }, [currentCard, currentMcq])

  const questionHtml = useMemo(
    () => (activeQuestion?.mcq.question ? renderMath(activeQuestion.mcq.question) : ''),
    [activeQuestion]
  )

  const choicesHtml = useMemo(() => {
    if (!activeQuestion) return []
    return activeQuestion.choices.map((choice, idx) =>
      (activeQuestion.choicesPlainText?.[idx] ? renderPlainText : renderMath)(choice)
    )
  }, [activeQuestion])

  // Resolve question image
  const [activeImageSrc, setActiveImageSrc] = useState<string | null>(null)
  useEffect(() => {
    let isCancelled = false
    if (activeQuestion?.mcq.imagePath) {
      resolveImageSrc(activeQuestion.mcq.imagePath).then((src) => {
        if (!isCancelled) setActiveImageSrc(src)
      })
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset active image when question changes
      setActiveImageSrc(null)
    }
    return () => {
      isCancelled = true
    }
  }, [activeQuestion])

  // End of run handler
  const isGameOverRef = useRef(false)
  const finishRun = useCallback(
    (
      finalMistakes: GauntletMistake[],
      finalAnswers: GauntletAnswerRecord[],
      finalScore: number,
      finalBestStreak: number
    ) => {
      if (isGameOverRef.current) return
      isGameOverRef.current = true

      // Shift music smoothly to combatOver / victory region
      gauntletMusic.setState('combatOver')
      gauntletMusic.setLowHealth(false)
      play('gameOver')

      const isNewHighScore = gauntletStats
        ? (config.mode === 'survival'
          ? finalScore > gauntletStats.survivalHighScore
          : finalScore > gauntletStats.timetrialHighScore)
        : false
      const isNewBestStreak = gauntletStats
        ? (config.mode === 'survival'
          ? finalBestStreak > gauntletStats.survivalBestStreak
          : finalBestStreak > gauntletStats.timetrialBestStreak)
        : false

      // Fire async storage update in background without blocking UI
      gauntletStorageService
        .recordRun(config.mode, finalScore, finalBestStreak)
        .then(({ updatedStats }) => {
          setGauntletStats(updatedStats)
        })
        .catch((err) => {
          console.warn('[GauntletSession] Failed to save stats:', err)
        })

      setRunResult({
        mode: config.mode,
        score: finalScore,
        bestStreak: finalBestStreak,
        totalAnswered,
        correctCount,
        wrongCount,
        durationMs: Date.now() - sessionStartTime,
        isNewHighScore,
        isNewBestStreak,
        mistakes: finalMistakes,
        allAnswers: finalAnswers,
      })
    },
    [
      config.mode,
      gauntletMusic,
      play,
      sessionStartTime,
      totalAnswered,
      correctCount,
      wrongCount,
      gauntletStats,
    ]
  )

  // Timeout event in survival
  const handleTimeout = useCallback(() => {
    if (isAnsweringLocked || !activeQuestion || isGameOverRef.current) return
    setIsAnsweringLocked(true)

    play('wrong')
    setShakeWrong(true)
    setTimeout(() => setShakeWrong(false), 300)

    const nextLives = config.startingLives > 0 ? lives - 1 : lives
    if (config.startingLives > 0) {
      setPulseHeart(true)
      setTimeout(() => setPulseHeart(false), 400)
    }

    const scored = scoreAnswer({
      outcome: 'timeout',
      timeMs: config.perQuestionSec * 1000,
      parMs: activeQuestion.parMs,
      weight: activeQuestion.weight,
      streakBefore: streak,
    })
    const newScore = Math.max(0, score + scored.points)
    setScore(newScore)

    const nextSkipState = updateSkipState({ skipsAvailable, skipEarnStreak }, 'timeout')
    setSkipsAvailable(nextSkipState.skipsAvailable)
    setSkipEarnStreak(nextSkipState.skipEarnStreak)

    setLives(nextLives)
    setStreak(0)
    setWrongCount((w) => w + 1)
    setTotalAnswered((t) => t + 1)

    const mistake: GauntletMistake = {
      card: activeQuestion.card,
      chosenIndex: null,
      answerIndex: activeQuestion.answerIndex,
      timeSpentMs: config.perQuestionSec * 1000,
    }
    const updatedMistakes = [...mistakes, mistake]
    setMistakes(updatedMistakes)

    const answerRec: GauntletAnswerRecord = {
      card: activeQuestion.card,
      isCorrect: false,
      outcome: 'timeout',
      chosenIndex: null,
      answerIndex: activeQuestion.answerIndex,
      timeSpentMs: config.perQuestionSec * 1000,
      points: scored.points,
      parMs: activeQuestion.parMs,
    }
    const updatedAnswers = [...allAnswers, answerRec]
    setAllAnswers(updatedAnswers)

    // Dynamic music region adaptation
    if (config.startingLives > 0) {
      gauntletMusic.setState(getSurvivalMusicRegion(nextLives, config.startingLives))
      if (nextLives === 1) {
        gauntletMusic.setLowHealth(true)
      }
    }

    if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current)
    if (config.startingLives > 0 && nextLives <= 0) {
      lingerTimerRef.current = setTimeout(() => finishRun(updatedMistakes, updatedAnswers, newScore, bestStreak), LINGER_WRONG_MS)
    } else {
      lingerTimerRef.current = setTimeout(() => {
        setCardIndex((c) => c + 1)
        setSelectedChoice(null)
        setIsAnsweringLocked(false)
        setQuestionStartTime(Date.now())
      }, LINGER_WRONG_MS)
    }
  }, [
    isAnsweringLocked,
    activeQuestion,
    play,
    config.startingLives,
    config.perQuestionSec,
    lives,
    mistakes,
    allAnswers,
    gauntletMusic,
    finishRun,
    score,
    streak,
    bestStreak,
    skipsAvailable,
    skipEarnStreak,
  ])

  // Time Trial Session Countdown
  useEffect(() => {
    if (isCountingDown || config.mode !== 'timetrial' || runResult || isGameOverRef.current || isAnsweringLocked) return

    const interval = setInterval(() => {
      setTimeTrialTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          finishRun(mistakes, allAnswers, score, bestStreak)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isCountingDown, config.mode, runResult, finishRun, mistakes, allAnswers, score, bestStreak, isAnsweringLocked])

  // Survival Per-Question Countdown (skips if config.perQuestionSec === 0)
  useEffect(() => {
    if (
      isCountingDown ||
      config.mode !== 'survival' ||
      config.perQuestionSec === 0 ||
      runResult ||
      isGameOverRef.current ||
      isAnsweringLocked
    )
      return

    setSurvivalTimeLeft(config.perQuestionSec)
    const startTime = Date.now()
    const limitMs = config.perQuestionSec * 1000

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remainingSec = Math.max(0, Math.ceil((limitMs - elapsed) / 1000))

      setSurvivalTimeLeft(remainingSec)

      if (elapsed >= limitMs) {
        clearInterval(interval)
        handleTimeout()
      }
    }, 250)

    return () => clearInterval(interval)
  }, [isCountingDown, cardIndex, config.mode, config.perQuestionSec, runResult, isAnsweringLocked, handleTimeout])

  // Answer selection handler
  const handleChoiceClick = useCallback(
    (choiceIdx: number) => {
      if (isCountingDown || isAnsweringLocked || !activeQuestion || isGameOverRef.current) return
      setIsAnsweringLocked(true)
      setSelectedChoice(choiceIdx)

      const elapsedMs = Math.max(200, Date.now() - questionStartTime)
      const isCorrect = choiceIdx === activeQuestion.answerIndex
      setTotalAnswered((t) => t + 1)

      if (isCorrect) {
        play('correct')
        const scored = scoreAnswer({
          outcome: 'correct',
          timeMs: elapsedMs,
          parMs: activeQuestion.parMs,
          weight: activeQuestion.weight,
          streakBefore: streak,
        })

        const newScore = Math.max(0, score + scored.points)
        const nextStreak = streak + 1
        const nextCorrect = correctCount + 1
        const newBestStreak = Math.max(bestStreak, nextStreak)

        setScore(newScore)
        setStreak(nextStreak)
        setBestStreak(newBestStreak)
        setCorrectCount(nextCorrect)

        const answerRec: GauntletAnswerRecord = {
          card: activeQuestion.card,
          isCorrect: true,
          outcome: 'correct',
          chosenIndex: choiceIdx,
          answerIndex: activeQuestion.answerIndex,
          timeSpentMs: elapsedMs,
          points: scored.points,
          parMs: activeQuestion.parMs,
          streakBonus: scored.streakBonus,
        }
        const updatedAnswers = [...allAnswers, answerRec]
        setAllAnswers(updatedAnswers)

        // Skip state update
        const nextSkipState = updateSkipState({ skipsAvailable, skipEarnStreak }, 'correct')
        if (nextSkipState.skipsAvailable > skipsAvailable) {
          setNotification({ text: '+1 SKIP EARNED!', color: 'text-amber-400' })
          setTimeout(() => setNotification(null), 1200)
        }
        setSkipsAvailable(nextSkipState.skipsAvailable)
        setSkipEarnStreak(nextSkipState.skipEarnStreak)

        // Survival life bonus rules:
        // 1. +1 life on every 10 consecutive correct answers (streak milestone)
        // 2. +1 life on every 20 total correct answers (score milestone)
        if (config.mode === 'survival') {
          const streakBonusAwarded = isLifeBonusStreak(nextStreak)
          const scoreBonusAwarded = isScoreLifeBonus(nextCorrect)
          let bonusLives = 0
          if (streakBonusAwarded) bonusLives += 1
          if (scoreBonusAwarded) bonusLives += 1

          if (bonusLives > 0) {
            play('lifeBonus')
            const nextTotalLives = config.startingLives === 0 ? 0 : lives + bonusLives
            setLives(nextTotalLives)
            if (config.startingLives > 0 && nextTotalLives > 1) {
              gauntletMusic.setLowHealth(false)
            }
            if (bonusLives >= 2) {
              setNotification({ text: '+2 LIVES BONUS! (STREAK + SCORE)', color: 'text-[#00ff41]' })
            } else if (streakBonusAwarded) {
              setNotification({ text: '+1 LIFE BONUS! (10 STREAK)', color: 'text-[#00ff41]' })
            } else {
              setNotification({ text: '+1 LIFE BONUS! (20 CORRECT)', color: 'text-[#00ff41]' })
            }
            setTimeout(() => setNotification(null), 1500)
          } else if (scored.streakBonus > 0) {
            play('streakMilestone')
            setNotification({ text: `+${scored.streakBonus} STREAK COMBO!`, color: 'text-amber-400' })
            setTimeout(() => setNotification(null), 1200)
          }
        } else if (scored.streakBonus > 0) {
          play('streakMilestone')
          setNotification({ text: `+${scored.streakBonus} STREAK COMBO!`, color: 'text-amber-400' })
          setTimeout(() => setNotification(null), 1200)
        }

        if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current)
        lingerTimerRef.current = setTimeout(() => {
          setCardIndex((c) => c + 1)
          setSelectedChoice(null)
          setIsAnsweringLocked(false)
          setQuestionStartTime(Date.now())
        }, LINGER_CORRECT_MS)
      } else {
        play('wrong')
        setShakeWrong(true)
        setTimeout(() => setShakeWrong(false), 300)

        const scored = scoreAnswer({
          outcome: 'wrong',
          timeMs: elapsedMs,
          parMs: activeQuestion.parMs,
          weight: activeQuestion.weight,
          streakBefore: streak,
        })

        const newScore = Math.max(0, score + scored.points)
        setScore(newScore)
        setStreak(0)
        setWrongCount((w) => w + 1)

        const answerRec: GauntletAnswerRecord = {
          card: activeQuestion.card,
          isCorrect: false,
          outcome: 'wrong',
          chosenIndex: choiceIdx,
          answerIndex: activeQuestion.answerIndex,
          timeSpentMs: elapsedMs,
          points: scored.points,
          parMs: activeQuestion.parMs,
        }
        const updatedAnswers = [...allAnswers, answerRec]
        setAllAnswers(updatedAnswers)

        const nextSkipState = updateSkipState({ skipsAvailable, skipEarnStreak }, 'wrong')
        setSkipsAvailable(nextSkipState.skipsAvailable)
        setSkipEarnStreak(nextSkipState.skipEarnStreak)

        const mistake: GauntletMistake = {
          card: activeQuestion.card,
          chosenIndex: choiceIdx,
          answerIndex: activeQuestion.answerIndex,
          timeSpentMs: elapsedMs,
        }
        const updatedMistakes = [...mistakes, mistake]
        setMistakes(updatedMistakes)

        if (config.mode === 'survival' && config.startingLives > 0) {
          setPulseHeart(true)
          setTimeout(() => setPulseHeart(false), 400)
          const nextLives = lives - 1
          setLives(nextLives)

          gauntletMusic.setState(getSurvivalMusicRegion(nextLives, config.startingLives))
          if (nextLives === 1) {
            gauntletMusic.setLowHealth(true)
          }

          if (nextLives <= 0) {
            if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current)
            lingerTimerRef.current = setTimeout(() => finishRun(updatedMistakes, updatedAnswers, newScore, bestStreak), LINGER_WRONG_MS)
            return
          }
        }

        if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current)
        lingerTimerRef.current = setTimeout(() => {
          setCardIndex((c) => c + 1)
          setSelectedChoice(null)
          setIsAnsweringLocked(false)
          setQuestionStartTime(Date.now())
        }, LINGER_WRONG_MS)
      }
    },
    [
      isAnsweringLocked,
      isCountingDown,
      activeQuestion,
      questionStartTime,
      allAnswers,
      play,
      streak,
      score,
      bestStreak,
      correctCount,
      config.mode,
      config.startingLives,
      mistakes,
      lives,
      gauntletMusic,
      finishRun,
      skipsAvailable,
      skipEarnStreak,
    ]
  )

  // Skip button handler matching desktop mechanics
  const handleSkip = useCallback(() => {
    if (isCountingDown || isAnsweringLocked || !activeQuestion || isGameOverRef.current || skipsAvailable <= 0) return
    setIsAnsweringLocked(true)

    const elapsedMs = Math.max(200, Date.now() - questionStartTime)
    setTotalAnswered((t) => t + 1)

    const nextSkipState = updateSkipState({ skipsAvailable, skipEarnStreak }, 'use_skip')
    setSkipsAvailable(nextSkipState.skipsAvailable)
    setSkipEarnStreak(nextSkipState.skipEarnStreak)

    const answerRec: GauntletAnswerRecord = {
      card: activeQuestion.card,
      isCorrect: false,
      outcome: 'skipped',
      chosenIndex: null,
      answerIndex: activeQuestion.answerIndex,
      timeSpentMs: elapsedMs,
      points: 0,
      parMs: activeQuestion.parMs,
    }
    const updatedAnswers = [...allAnswers, answerRec]
    setAllAnswers(updatedAnswers)

    setNotification({ text: 'SKIPPED', color: 'text-neutral-400' })
    setTimeout(() => setNotification(null), 1000)

    if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current)
    lingerTimerRef.current = setTimeout(() => {
      setCardIndex((c) => c + 1)
      setSelectedChoice(null)
      setIsAnsweringLocked(false)
      setQuestionStartTime(Date.now())
    }, 1200)
  }, [
    isCountingDown,
    isAnsweringLocked,
    activeQuestion,
    skipsAvailable,
    skipEarnStreak,
    questionStartTime,
    allAnswers,
  ])

  // Format time trial remaining
  const timeTrialMinutes = Math.floor(timeTrialTimeLeft / 60)
  const timeTrialSeconds = timeTrialTimeLeft % 60

  return (
    <div className="relative flex h-full w-full flex-col bg-neutral-950 text-neutral-50 select-none overflow-hidden">
      {/* Top Header */}
      <header className="shrink-0 sticky top-0 z-20 border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 w-full">
          {/* Left: Exit button & Mode / Score Info */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setShowExitConfirm(true)}
              className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200 active:scale-95 transition-all shrink-0"
              title="Exit run"
            >
              <X size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-tight text-neutral-100 uppercase truncate">
                  {config.mode === 'survival' ? 'Survival' : 'Time Trial'}
                </h1>
                <span className="text-[11px] font-mono font-bold tracking-wider text-[#00ff41] bg-[#00ff41]/10 px-2 py-0.5 rounded border border-[#00ff41]/20">
                  {score.toLocaleString()} <span className="text-[9px] text-neutral-400 font-normal">PTS</span>
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 flex items-center gap-2">
                <span>Question #{cardIndex + 1}</span>
                {streak > 1 && (
                  <span className="text-amber-400 font-medium font-mono flex items-center gap-0.5">
                    • <Flame size={11} className="inline fill-amber-400 text-amber-400" /> {streak} Combo
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right: Audio Toggles & Lives/Clock */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !isSfxMuted
                setIsSfxMuted(next)
                setSoundsMuted(next)
              }}
              className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
                isSfxMuted
                  ? 'border-neutral-800 bg-neutral-900 text-neutral-500'
                  : 'border-[#00ff41]/40 bg-[#00ff41]/10 text-[#00ff41]'
              }`}
              title={isSfxMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isSfxMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

            {/* Lives or Clock */}
            {config.mode === 'survival' ? (
              <div
                className={`flex items-center gap-1 bg-neutral-900/90 px-2.5 py-1 rounded-lg border border-neutral-800 transition-all ${
                  pulseHeart ? 'gauntlet-heart-pulse border-red-500/60' : ''
                }`}
              >
                {config.startingLives === 0 ? (
                  <span className="text-xs font-mono font-bold text-red-400 flex items-center gap-1">
                    <Heart size={14} className="text-red-500 fill-red-500" /> ∞
                  </span>
                ) : (
                  <>
                    {Array.from({ length: Math.min(5, lives) }).map((_, i) => (
                      <Heart
                        key={i}
                        size={14}
                        className={`text-red-500 fill-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)] ${
                          pulseHeart ? 'animate-pulse' : ''
                        }`}
                      />
                    ))}
                    {lives > 5 && (
                      <span className="text-xs font-mono font-bold text-red-400">+{lives - 5}</span>
                    )}
                    {lives <= 0 && (
                      <span className="text-xs font-mono font-bold text-neutral-500">0</span>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div
                className={`font-mono text-xs font-bold text-cyan-400 bg-cyan-400/10 border px-2.5 py-1 rounded-lg transition-all ${
                  timeTrialTimeLeft <= 15
                    ? 'border-red-500/80 text-red-400 gauntlet-timer-shake shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                    : 'border-cyan-400/30'
                }`}
              >
                {timeTrialMinutes}:{timeTrialSeconds.toString().padStart(2, '0')}
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar (countdown for question in Survival, session countdown in Time Trial) */}
        {config.mode === 'survival' && config.perQuestionSec > 0 && (
          <div
            className={`mx-auto mt-2.5 max-w-3xl h-1 w-full bg-neutral-900 rounded-full overflow-hidden transition-all ${
              survivalTimeLeft <= 5 ? 'gauntlet-timer-shake' : ''
            }`}
          >
            <div
              className={`h-full transition-all duration-200 ${
                survivalTimeLeft <= 3
                  ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                  : survivalTimeLeft <= 6
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                  : 'bg-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,0.4)]'
              }`}
              style={{
                width: `${(survivalTimeLeft / config.perQuestionSec) * 100}%`,
              }}
            />
          </div>
        )}

        {config.mode === 'timetrial' && config.durationSec > 0 && (
          <div className="mx-auto mt-2.5 max-w-3xl h-1 w-full bg-neutral-900 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                timeTrialTimeLeft <= 15
                  ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                  : timeTrialTimeLeft <= 30
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                  : 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]'
              }`}
              style={{
                width: `${(timeTrialTimeLeft / config.durationSec) * 100}%`,
              }}
            />
          </div>
        )}
      </header>

      {/* Floating Combo / Life Bonus Badge */}
      {notification && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-neutral-900 border border-neutral-700 text-xs font-mono font-bold uppercase tracking-wider shadow-lg animate-bounce ${notification.color}`}
        >
          {notification.text}
        </div>
      )}

      {/* Question Content View */}
      {activeQuestion ? (
        <QuestionView
          cardIndex={cardIndex}
          activeQuestion={activeQuestion}
          questionHtml={questionHtml}
          choicesHtml={choicesHtml}
          activeImageSrc={activeImageSrc}
          selectedChoice={selectedChoice}
          isAnsweringLocked={isAnsweringLocked}
          isBookmarked={isCurrentCardBookmarked}
          shakeWrong={shakeWrong}
          skipsAvailable={skipsAvailable}
          onChoiceClick={handleChoiceClick}
          onToggleBookmark={handleToggleBookmark}
          onOpenLightbox={setLightboxSrc}
          onSkip={handleSkip}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-neutral-400">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 text-center my-8 max-w-sm">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertCircle size={24} />
            </div>
            <p className="text-sm font-medium text-neutral-200">
              No MCQ questions available in current deck selection.
            </p>
            <button
              type="button"
              onClick={onExit}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 active:scale-95 transition-all"
            >
              Back to Gauntlet
            </button>
          </div>
        </div>
      )}

      {/* 3-2-1-GO Countdown Splash Overlay */}
      {isCountingDown && (
        <GauntletCountdown
          onBegin={handleCountdownBegin}
          onCancel={handleCountdownCancel}
        />
      )}

      {/* Confirmation modal before discarding run */}
      <LeaveConfirmModal
        isOpen={showExitConfirm}
        onConfirm={onExit}
        onCancel={() => setShowExitConfirm(false)}
        message="Aborting this Gauntlet run will discard your in-progress score and combo streak. Are you sure?"
      />

      {/* Lightbox for diagrams */}
      <ImageLightbox
        src={lightboxSrc}
        alt="Question Diagram"
        onClose={() => setLightboxSrc(null)}
      />

      {/* Post-Run Summary Modal */}
      {runResult && (
        <GauntletSummaryModal
          result={runResult}
          onPlayAgain={() => {
            // Reshuffle the deck for a fresh run (new card order)
            setDeckPool(shuffleArray([...cards]))
            setRunResult(null)
            isGameOverRef.current = false
            setScore(0)
            setStreak(0)
            setLives(config.startingLives)
            setMistakes([])
            setAllAnswers([])
            setTotalAnswered(0)
            setCorrectCount(0)
            setWrongCount(0)
            setSkipsAvailable(1)
            setSkipEarnStreak(0)
            setCardIndex(0)
            setSelectedChoice(null)
            setIsAnsweringLocked(false)
            setSurvivalTimeLeft(config.perQuestionSec)
            setTimeTrialTimeLeft(config.durationSec)
            setQuestionStartTime(Date.now())
            setIsCountingDown(true)
            gauntletMusic.start('stealth')
          }}
          onExit={() => {
            gauntletMusic.stop(0.4)
            onExit()
          }}
          onDrillMistakes={(mistakeCards) => {
            gauntletMusic.stop(0.4)
            if (onDrillMistakes) {
              onDrillMistakes(mistakeCards)
            }
          }}
          onLearnAll={(allCards) => {
            gauntletMusic.stop(0.4)
            if (onLearnAll) {
              onLearnAll(allCards)
            }
          }}
        />
      )}
    </div>
  )
}
