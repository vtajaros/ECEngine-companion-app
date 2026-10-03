import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Heart,
  Flame,
  X,
  AlertCircle,
  Music,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Card, MCQData } from '../types'
import {
  GauntletArcadeConfig,
  extractFeatures,
  estimateParMs,
  difficultyWeight,
  scoreAnswer,
  isLifeBonusStreak,
} from '../lib/gauntlet'
import { shuffleChoices, isSafeToShuffleChoices } from '../lib/scrambler'
import { shuffleArray } from '../lib/utils'
import { renderMath } from '../lib/latex'
import { resolveImageSrc } from '../services/image.service'
import { useSound, getSoundsMuted, setSoundsMuted } from '../hooks/useSound'
import { useGauntletMusic, getSurvivalMusicRegion } from '../hooks/useGauntletMusic'
import { gauntletStorageService } from '../services/gauntlet-storage.service'
import {
  GauntletSummaryModal,
  GauntletRunResult,
  GauntletMistake,
  GauntletAnswerRecord,
} from '../components/gauntlet/GauntletSummaryModal'
import { LeaveConfirmModal } from '../components/LeaveConfirmModal'
import { ImageLightbox } from '../components/ImageLightbox'

interface GauntletSessionProps {
  cards: Card[]
  config: GauntletArcadeConfig
  onExit: () => void
  onDrillMistakes?: (cards: Card[]) => void
}

interface ActiveQuestion {
  card: Card
  mcq: MCQData
  choices: string[]
  answerIndex: number
  parMs: number
  weight: number
  imageSrc?: string | null
}

const CHOICE_LETTERS = ['A', 'B', 'C', 'D']

export const GauntletSession: React.FC<GauntletSessionProps> = ({
  cards,
  config,
  onExit,
  onDrillMistakes,
}) => {
  const { play } = useSound()
  const gauntletMusic = useGauntletMusic()

  // Game run state
  const [deckPool] = useState<Card[]>(() => shuffleArray([...cards]))
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

  // Audio toggles
  const [isMusicMuted, setIsMusicMuted] = useState(false)
  const [isSfxMuted, setIsSfxMuted] = useState(() => getSoundsMuted())

  // Question interaction state
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [isAnsweringLocked, setIsAnsweringLocked] = useState(false)
  const [questionStartTime, setQuestionStartTime] = useState<number>(() => Date.now())
  const [sessionStartTime] = useState<number>(() => Date.now())

  // Timers
  const [survivalTimeLeft, setSurvivalTimeLeft] = useState(config.perQuestionSec)
  const [timeTrialTimeLeft, setTimeTrialTimeLeft] = useState(config.durationSec)

  // Floating notifications (+1 LIFE, +50 PTS)
  const [notification, setNotification] = useState<{ text: string; color: string } | null>(null)

  // Dialogs
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<GauntletRunResult | null>(null)

  // Start background music on mount and clean up on exit
  useEffect(() => {
    gauntletMusic.start(config.mode === 'survival' ? 'enemiesNearby' : 'battle1')
    return () => {
      gauntletMusic.stop(0.4)
    }
  }, [config.mode, gauntletMusic])

  // Active question resolution
  const currentCard = deckPool[cardIndex % deckPool.length]
  const currentMcq = currentCard?.data as MCQData

  const activeQuestion: ActiveQuestion | null = useMemo(() => {
    if (!currentCard || !currentMcq || !Array.isArray(currentMcq.choices)) return null

    const rawChoices = currentMcq.choices
    const rawAnswer = currentMcq.answer ?? 0

    let finalChoices = [...rawChoices]
    let finalAnswer = rawAnswer

    if (isSafeToShuffleChoices(rawChoices)) {
      const scrambled = shuffleChoices(rawChoices, rawAnswer, currentMcq.choicesPlainText)
      finalChoices = scrambled.choices
      finalAnswer = scrambled.answer
    }

    const feats = extractFeatures(currentMcq)
    const parMs = estimateParMs(feats)
    const weight = difficultyWeight(parMs)

    return {
      card: currentCard,
      mcq: currentMcq,
      choices: finalChoices,
      answerIndex: finalAnswer,
      parMs,
      weight,
    }
  }, [currentCard, currentMcq])

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
    async (
      finalMistakes: GauntletMistake[],
      finalAnswers: GauntletAnswerRecord[],
      finalScore: number,
      finalBestStreak: number
    ) => {
      if (isGameOverRef.current) return
      isGameOverRef.current = true

      gauntletMusic.stop(0.2)
      play('gameOver')

      const { isNewHighScore, isNewBestStreak } = await gauntletStorageService.recordRun(
        config.mode,
        finalScore,
        finalBestStreak
      )

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
    [config.mode, gauntletMusic, play, sessionStartTime, totalAnswered, correctCount, wrongCount]
  )

  // Timeout event in survival
  const handleTimeout = useCallback(() => {
    if (isAnsweringLocked || !activeQuestion || isGameOverRef.current) return
    setIsAnsweringLocked(true)

    play('wrong')
    const nextLives = config.startingLives > 0 ? lives - 1 : lives
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
      chosenIndex: null,
      answerIndex: activeQuestion.answerIndex,
      timeSpentMs: config.perQuestionSec * 1000,
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

    if (config.startingLives > 0 && nextLives <= 0) {
      setTimeout(() => finishRun(updatedMistakes, updatedAnswers, score, bestStreak), 500)
    } else {
      setTimeout(() => {
        setCardIndex((c) => c + 1)
        setSelectedChoice(null)
        setIsAnsweringLocked(false)
        setQuestionStartTime(Date.now())
      }, 700)
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
    bestStreak,
  ])

  // Time Trial Session Countdown
  useEffect(() => {
    if (config.mode !== 'timetrial' || runResult || isGameOverRef.current) return

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
  }, [config.mode, runResult, finishRun, mistakes, allAnswers, score, bestStreak])

  // Survival Per-Question Countdown (skips if config.perQuestionSec === 0)
  useEffect(() => {
    if (
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
  }, [cardIndex, config.mode, config.perQuestionSec, runResult, isAnsweringLocked, handleTimeout])

  // Answer selection handler
  const handleChoiceClick = useCallback(
    (choiceIdx: number) => {
      if (isAnsweringLocked || !activeQuestion || isGameOverRef.current) return
      setIsAnsweringLocked(true)
      setSelectedChoice(choiceIdx)

      const elapsedMs = Math.max(200, Date.now() - questionStartTime)
      const isCorrect = choiceIdx === activeQuestion.answerIndex
      setTotalAnswered((t) => t + 1)

      const answerRec: GauntletAnswerRecord = {
        card: activeQuestion.card,
        isCorrect,
        chosenIndex: choiceIdx,
        answerIndex: activeQuestion.answerIndex,
        timeSpentMs: elapsedMs,
      }
      const updatedAnswers = [...allAnswers, answerRec]
      setAllAnswers(updatedAnswers)

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
        const newBestStreak = Math.max(bestStreak, nextStreak)

        setScore(newScore)
        setStreak(nextStreak)
        setBestStreak(newBestStreak)
        setCorrectCount((c) => c + 1)

        // Survival life bonus at 10-streak intervals
        if (config.mode === 'survival' && isLifeBonusStreak(nextStreak)) {
          play('lifeBonus')
          setLives((l) => l + 1)
          if (config.startingLives > 0 && lives + 1 > 1) {
            gauntletMusic.setLowHealth(false)
          }
          setNotification({ text: '+1 LIFE BONUS!', color: 'text-[#00ff41]' })
          setTimeout(() => setNotification(null), 1500)
        } else if (scored.streakBonus > 0) {
          play('streakMilestone')
          setNotification({ text: `+${scored.streakBonus} STREAK COMBO!`, color: 'text-amber-400' })
          setTimeout(() => setNotification(null), 1200)
        }

        setTimeout(() => {
          setCardIndex((c) => c + 1)
          setSelectedChoice(null)
          setIsAnsweringLocked(false)
          setQuestionStartTime(Date.now())
        }, 400)
      } else {
        play('wrong')
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

        const mistake: GauntletMistake = {
          card: activeQuestion.card,
          chosenIndex: choiceIdx,
          answerIndex: activeQuestion.answerIndex,
          timeSpentMs: elapsedMs,
        }
        const updatedMistakes = [...mistakes, mistake]
        setMistakes(updatedMistakes)

        if (config.mode === 'survival' && config.startingLives > 0) {
          const nextLives = lives - 1
          setLives(nextLives)

          gauntletMusic.setState(getSurvivalMusicRegion(nextLives, config.startingLives))
          if (nextLives === 1) {
            gauntletMusic.setLowHealth(true)
          }

          if (nextLives <= 0) {
            setTimeout(() => finishRun(updatedMistakes, updatedAnswers, newScore, bestStreak), 600)
            return
          }
        }

        setTimeout(() => {
          setCardIndex((c) => c + 1)
          setSelectedChoice(null)
          setIsAnsweringLocked(false)
          setQuestionStartTime(Date.now())
        }, 750)
      }
    },
    [
      isAnsweringLocked,
      activeQuestion,
      questionStartTime,
      allAnswers,
      play,
      streak,
      score,
      bestStreak,
      config.mode,
      config.startingLives,
      mistakes,
      lives,
      gauntletMusic,
      finishRun,
    ]
  )

  // Format time trial remaining
  const timeTrialMinutes = Math.floor(timeTrialTimeLeft / 60)
  const timeTrialSeconds = timeTrialTimeLeft % 60

  return (
    <div className="relative flex h-full w-full flex-col bg-neutral-950 text-neutral-100 font-rajdhani select-none overflow-hidden">
      {/* Top HUD */}
      <header className="border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md px-3.5 py-2.5 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="p-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-100 active:scale-95"
            title="Exit run"
          >
            <X size={16} />
          </button>

          <div className="font-display font-bold text-sm tracking-wider text-[#00ff41] drop-shadow-[0_0_8px_rgba(0,255,65,0.4)]">
            {score.toLocaleString()} <span className="text-[10px] text-neutral-400 font-normal">PTS</span>
          </div>
        </div>

        {/* Center Streak Badge */}
        {streak > 1 ? (
          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold animate-pulse">
            <Flame size={12} className="text-amber-400 fill-amber-400" />
            {streak} COMBO
          </div>
        ) : (
          <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
            #{cardIndex + 1}
          </div>
        )}

        {/* Right Gauge & Audio Controls */}
        <div className="flex items-center gap-2">
          {/* Audio Toggles */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const next = !isMusicMuted
                setIsMusicMuted(next)
                if (next) {
                  gauntletMusic.stop(0.2)
                } else {
                  gauntletMusic.start(config.mode === 'survival' ? 'battle1' : 'battle2')
                }
              }}
              className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
                isMusicMuted
                  ? 'border-neutral-800 bg-neutral-900/60 text-neutral-500'
                  : 'border-[#00ff41]/50 bg-[#00ff41]/10 text-[#00ff41]'
              }`}
              title={isMusicMuted ? 'Unmute BGM' : 'Mute BGM'}
            >
              <Music size={13} />
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !isSfxMuted
                setIsSfxMuted(next)
                setSoundsMuted(next)
              }}
              className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
                isSfxMuted
                  ? 'border-neutral-800 bg-neutral-900/60 text-neutral-500'
                  : 'border-cyan-400/50 bg-cyan-400/10 text-cyan-400'
              }`}
              title={isSfxMuted ? 'Unmute SFX' : 'Mute SFX'}
            >
              {isSfxMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
          </div>

          {/* Lives or Clock */}
          {config.mode === 'survival' ? (
            <div className="flex items-center gap-1 bg-neutral-900/80 px-2 py-1 rounded-lg border border-neutral-800">
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
                      className="text-red-500 fill-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]"
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
            <div className="font-mono text-xs font-bold text-cyan-400 bg-cyan-400/10 border border-cyan-400/30 px-2 py-0.5 rounded-md">
              {timeTrialMinutes}:{timeTrialSeconds.toString().padStart(2, '0')}
            </div>
          )}
        </div>
      </header>

      {/* Survival Countdown Bar (if enabled) */}
      {config.mode === 'survival' && config.perQuestionSec > 0 && (
        <div className="h-1.5 w-full bg-neutral-900 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-200 ${
              survivalTimeLeft <= 5
                ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'
                : survivalTimeLeft <= 10
                ? 'bg-amber-400'
                : 'bg-[#00ff41]'
            }`}
            style={{
              width: `${(survivalTimeLeft / config.perQuestionSec) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Floating Combo / Life Bonus Badge */}
      {notification && (
        <div
          className={`absolute top-14 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700 text-xs font-mono font-bold uppercase tracking-wider animate-bounce ${notification.color}`}
        >
          {notification.text}
        </div>
      )}

      {/* Question Content View */}
      {activeQuestion ? (
        <main className="flex-1 flex flex-col justify-between p-4 overflow-y-auto max-w-md mx-auto w-full">
          {/* Question Meta & Statement */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-300 uppercase font-semibold">
                {activeQuestion.card.subject || 'ECE'}
              </span>
              {activeQuestion.card.tosTopicId && (
                <span className="px-2 py-0.5 rounded border border-neutral-800 bg-neutral-900 text-[#00ff41] font-semibold">
                  {activeQuestion.card.tosTopicId}
                </span>
              )}
            </div>

            <div
              className="text-base sm:text-lg font-medium text-neutral-100 leading-relaxed break-words"
              dangerouslySetInnerHTML={{
                __html: renderMath(activeQuestion.mcq.question || ''),
              }}
            />

            {/* Optional diagram */}
            {activeImageSrc && (
              <div
                onClick={() => setLightboxSrc(activeImageSrc)}
                className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-2 flex justify-center cursor-zoom-in active:scale-[0.99] transition-all"
              >
                <img
                  src={activeImageSrc}
                  alt="Diagram"
                  className="max-h-48 max-w-full object-contain rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Answer Choice Buttons (Thumb-zone optimized) */}
          <div className="space-y-2.5 pt-4 pb-2">
            {activeQuestion.choices.map((choice, idx) => {
              const isSelected = selectedChoice === idx
              const isCorrectAnswer = idx === activeQuestion.answerIndex

              let btnStyles =
                'border-neutral-800 bg-neutral-900/70 text-neutral-200 hover:border-neutral-700'

              if (isAnsweringLocked) {
                if (isCorrectAnswer) {
                  btnStyles =
                    'border-[#00ff41] bg-[#00ff41]/20 text-[#00ff41] shadow-[0_0_12px_rgba(0,255,65,0.3)] font-bold'
                } else if (isSelected && !isCorrectAnswer) {
                  btnStyles =
                    'border-red-500 bg-red-500/20 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                } else {
                  btnStyles = 'border-neutral-900 bg-neutral-950/40 text-neutral-600 opacity-40'
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isAnsweringLocked}
                  onClick={() => handleChoiceClick(idx)}
                  className={`w-full min-h-[50px] p-3.5 rounded-xl border flex items-center text-left transition-all active:scale-[0.98] cursor-pointer ${btnStyles}`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-neutral-700/80 bg-neutral-800/80 text-xs font-mono font-bold mr-3 shrink-0">
                    {CHOICE_LETTERS[idx]}
                  </span>
                  <div
                    className="flex-1 text-sm leading-normal break-words"
                    dangerouslySetInnerHTML={{
                      __html: renderMath(choice),
                    }}
                  />
                </button>
              )
            })}
          </div>
        </main>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-neutral-400">
          <AlertCircle size={32} className="text-amber-400 mb-2" />
          <p className="text-sm font-medium">No MCQ questions available in current deck selection.</p>
          <button
            type="button"
            onClick={onExit}
            className="mt-4 px-4 py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-xs uppercase font-bold text-neutral-300"
          >
            Back to Gauntlet
          </button>
        </div>
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
            setCardIndex(0)
            setSelectedChoice(null)
            setIsAnsweringLocked(false)
            setSurvivalTimeLeft(config.perQuestionSec)
            setTimeTrialTimeLeft(config.durationSec)
            setQuestionStartTime(Date.now())
            gauntletMusic.start(config.mode === 'survival' ? 'enemiesNearby' : 'battle1')
          }}
          onExit={onExit}
          onDrillMistakes={onDrillMistakes}
        />
      )}
    </div>
  )
}
