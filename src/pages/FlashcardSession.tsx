import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Copy,
  ChevronLeft,
  ChevronRight,
  Settings as SettingsIcon,
  CheckCircle2,
} from 'lucide-react'
import { dbService } from '../services/db.service'
import { flashcardBookmarkService } from '../services/flashcardBookmark.service'
import { Card } from '../types'
import { StudyCard, getFrontText, getBackText } from '../components/StudyCard'
import { FlashcardContextPanel } from '../components/FlashcardContextPanel'
import { FlashcardSettingsModal, FlashcardSettings, DEFAULT_FLASHCARD_SETTINGS } from '../components/FlashcardSettingsModal'
import { ImageLightbox } from '../components/ImageLightbox'
import { LeaveConfirmModal } from '../components/LeaveConfirmModal'
import { useTTS } from '../hooks/useTTS'
import { App as CapacitorApp } from '@capacitor/app'
import { copyToClipboard } from '../services/clipboard.service'

interface FlashcardSessionProps {
  topicId: string
  topicName?: string
  onExit: () => void
  onOpenSettings?: () => void
  initialSettings?: FlashcardSettings
  cardType?: 'flashcard' | 'formula'
}

/**
 * Deterministic Fisher-Yates shuffle helper.
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function FlashcardSession({
  topicId,
  topicName,
  onExit,
  onOpenSettings,
  initialSettings,
  cardType = 'flashcard',
}: FlashcardSessionProps) {
  const { speak, stop } = useTTS()
  const [rawCards, setRawCards] = useState<Card[]>([])
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [sessionBookmarks, setSessionBookmarks] = useState<Set<string>>(new Set())
  const [settings, setSettings] = useState<FlashcardSettings>(
    initialSettings ? { ...initialSettings } : { ...DEFAULT_FLASHCARD_SETTINGS }
  )
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const lightboxSrcRef = useRef<string | null>(null)
  useEffect(() => {
    lightboxSrcRef.current = lightboxSrc
  }, [lightboxSrc])

  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showContextToast, setShowContextToast] = useState(false)

  const showExitConfirmRef = useRef(showExitConfirm)
  useEffect(() => {
    showExitConfirmRef.current = showExitConfirm
  }, [showExitConfirm])

  const showSettingsModalRef = useRef(showSettingsModal)
  useEffect(() => {
    showSettingsModalRef.current = showSettingsModal
  }, [showSettingsModal])

  const isActiveStudyState = !isCompleted && !isLoading && rawCards.length > 0
  const isActiveStudyStateRef = useRef(isActiveStudyState)

  useEffect(() => {
    isActiveStudyStateRef.current = isActiveStudyState
  }, [isActiveStudyState])

  // Android hardware back button handler
  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      // 1. If image lightbox is open, close image preview only
      if (lightboxSrcRef.current) {
        setLightboxSrc(null)
        return
      }
      // 2. If settings modal is open, dismiss the modal
      if (showSettingsModalRef.current) {
        setShowSettingsModal(false)
        return
      }
      // 3. If exit confirm modal is open, dismiss the modal
      if (showExitConfirmRef.current) {
        setShowExitConfirm(false)
        return
      }
      // 4. Otherwise, if actively studying, confirm before leaving
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

  // Fetch cards and bookmarks concurrently on mount
  useEffect(() => {
    let isCancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset loading/error state for async card fetch
    setIsLoading(true)
    setError(null)

    Promise.all([
      dbService.getAllCardsByTopic(topicId),
      flashcardBookmarkService.getAll(),
    ])
      .then(([allCards, savedBookmarks]) => {
        if (isCancelled) return
        const targetCards = allCards.filter((c) => c.type === cardType)
        setRawCards(targetCards)
        setBookmarkedIds(savedBookmarks)
        setSessionBookmarks(savedBookmarks)
        setCurrentIndex(0)
        setIsFlipped(false)
        setExplanationOpen(false)
        setIsCompleted(false)
      })
      .catch((err) => {
        if (isCancelled) return
        console.error(`[FlashcardSession] Failed to fetch ${cardType} cards:`, err)
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false)
      })

    return () => {
      isCancelled = true
      stop()
    }
  }, [topicId, cardType, stop])

  // Process cards queue according to active settings (Shuffle & Bookmarked Only)
  const activeCards = useMemo(() => {
    let list = rawCards
    if (settings.bookmarkedOnly) {
      list = list.filter((c) => sessionBookmarks.has(c.id))
    }
    if (settings.shuffleCards) {
      list = shuffleArray(list)
    }
    return list
  }, [rawCards, settings.bookmarkedOnly, settings.shuffleCards, sessionBookmarks])

  const currentCard = activeCards[currentIndex]
  const isCurrentCardBookmarked = currentCard ? bookmarkedIds.has(currentCard.id) : false

  const handleToggleBookmark = async (cardId: string) => {
    const updated = await flashcardBookmarkService.toggle(cardId)
    setBookmarkedIds(updated)
  }

  const handleNext = () => {
    stop()
    if (currentIndex < activeCards.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setIsFlipped(false)
      setExplanationOpen(false)
    } else {
      // Reached the end of the deck
      setIsCompleted(true)
      setIsFlipped(false)
      setExplanationOpen(false)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      stop()
      setCurrentIndex((prev) => prev - 1)
      setIsFlipped(false)
      setExplanationOpen(false)
      setIsCompleted(false)
    }
  }

  const handleFlip = () => {
    stop() // Stop TTS immediately upon flipping
    setIsFlipped((prev) => !prev)
  }

  const handleRestart = () => {
    stop()
    setCurrentIndex(0)
    setIsFlipped(false)
    setExplanationOpen(false)
    setIsCompleted(false)
  }

  // TTS: speak card text whenever currentCard or flip state changes — skip for formulas
  useEffect(() => {
    if (cardType !== 'formula' && settings.ttsEnabled && currentCard && !isCompleted) {
      const textToSpeak = isFlipped
        ? getBackText(currentCard, settings.swapTermDef)
        : getFrontText(currentCard, settings.swapTermDef)
      speak(textToSpeak)
    }
    return () => {
      stop()
    }
  }, [currentCard, isFlipped, isCompleted, settings.ttsEnabled, settings.swapTermDef, cardType, speak, stop])

  const handleGetContext = async () => {
    if (!currentCard) return
    const term = getFrontText(currentCard, settings.swapTermDef)
    const definition = getBackText(currentCard, settings.swapTermDef)

    const template = `Please explain the following Electronics Engineering flashcard concept in depth:

TERM:
${term}

DEFINITION:
${definition}

Provide a thorough explanation covering ALL of the following:

1. CONCEPT BREAKDOWN
   - What exactly is this term/concept and what does it do?
   - What are its key characteristics or properties?
   - Where and how is it used in real-world Electronics Engineering?

2. UNDERLYING PRINCIPLES
   - What fundamental laws, theorems, or principles govern this concept?
   - Include any relevant formulas, equations, or derivations.
   - Explain the units, variables, and their physical meaning.

3. BOARD EXAM CONTEXT
   - What types of questions appear on the Philippine ECE Board Exam about this?
   - What are common traps, misconceptions, or tricky variations to watch out for?
   - How does this concept connect to other topics in the exam syllabus?

4. WORKED EXAMPLE
   - Give a concrete numerical example or scenario if applicable.
   - Walk through the solution step by step.

5. MEMORY AIDS
   - Provide a mnemonic, analogy, or mental model to remember this.
   - Give a one-sentence summary that captures the essence of the concept.`

    const success = await copyToClipboard(template)
    if (success) {
      setShowContextToast(true)
      setTimeout(() => setShowContextToast(false), 2500)
    }
  }

  return (
    <div className="flex h-full flex-col bg-neutral-950 text-neutral-50 overflow-y-auto">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl landscape:max-w-4xl items-center justify-between gap-3">
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
                {topicName || (cardType === 'formula' ? 'Formulas' : 'Flashcards')}
              </h1>
              <p className="text-[11px] text-neutral-400">
                {!isLoading && activeCards.length > 0 && !isCompleted && (
                  <span>
                    Card {currentIndex + 1} of {activeCards.length}
                    {settings.bookmarkedOnly && (
                      <span className="text-[#00ff41] font-medium"> • Bookmarked</span>
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>

          {!isLoading && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-[#00ff41] active:scale-95 transition-all"
                title="Session settings"
              >
                <SettingsIcon size={16} />
              </button>
              {activeCards.length > 0 && !isCompleted && (
                <span className="text-xs font-mono font-semibold text-[#00ff41] bg-[#00ff41]/10 px-2 py-0.5 rounded border border-[#00ff41]/20">
                  {currentIndex + 1}/{activeCards.length}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {!isLoading && activeCards.length > 0 && (
          <div className="mx-auto mt-2.5 max-w-3xl landscape:max-w-4xl h-1 w-full bg-neutral-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00ff41] transition-all duration-300 shadow-[0_0_8px_rgba(0,255,65,0.4)]"
              style={{
                width: `${
                  isCompleted
                    ? 100
                    : ((currentIndex + 1) / Math.max(1, activeCards.length)) * 100
                }%`,
              }}
            />
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 sm:px-6 landscape:py-4 flex flex-col justify-start py-6 pb-16">
        <div className="mx-auto my-auto max-w-2xl landscape:max-w-4xl w-full">
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-[#00ff41] mb-3" />
              <p className="text-sm font-medium text-neutral-400">
                Loading {cardType === 'formula' ? 'formulas' : 'flashcards'}...
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
                Failed to Load {cardType === 'formula' ? 'Formulas' : 'Flashcards'}
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

          {/* Empty Flashcards State */}
          {!isLoading && !error && activeCards.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 text-center my-8">
              <p className="text-sm text-neutral-400">
                {settings.bookmarkedOnly
                  ? `No bookmarked ${cardType === 'formula' ? 'formulas' : 'flashcards'} found in this topic.`
                  : `No ${cardType === 'formula' ? 'formulas' : 'flashcards'} found in this topic.`}
              </p>
              {settings.bookmarkedOnly ? (
                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, bookmarkedOnly: false }))}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#00ff41]/10 border border-[#00ff41]/30 px-4 py-2 text-xs font-semibold text-[#00ff41] active:scale-95 transition-all"
                >
                  Show All {cardType === 'formula' ? 'Formulas' : 'Flashcards'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onExit}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 active:scale-95 transition-all"
                >
                  Back to Topics
                </button>
              )}
            </div>
          )}

          {/* Study Card & Action Controls */}
          {!isLoading && !error && activeCards.length > 0 && !isCompleted && currentCard && (
            <div className="flex flex-col gap-4">
              {/* Card Face */}
              <StudyCard
                key={currentCard.id}
                card={currentCard}
                currentIndex={currentIndex}
                isFlipped={isFlipped}
                swapTermDef={settings.swapTermDef}
                isBookmarked={isCurrentCardBookmarked}
                onFlip={handleFlip}
                onBookmarkToggle={handleToggleBookmark}
                onZoomImage={(src) => setLightboxSrc(src)}
              />

              {/* AI Context Panel (when expanded) */}
              {explanationOpen && isFlipped && (
                <FlashcardContextPanel
                  term={getFrontText(currentCard, settings.swapTermDef)}
                  definition={getBackText(currentCard, settings.swapTermDef)}
                  onOpenSettings={onOpenSettings}
                  onClose={() => setExplanationOpen(false)}
                />
              )}

              {/* Action Buttons Row */}
              <div className="pt-2 flex flex-col gap-2.5">
                {isFlipped ? (
                  /* Back Face Actions: Prev, Get Context, Explain, Next */
                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        disabled={currentIndex === 0}
                        onClick={handlePrev}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-3 text-xs font-bold uppercase tracking-wider text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all whitespace-nowrap min-h-[52px]"
                        title="Previous card"
                      >
                        <ChevronLeft size={16} />
                        <span>Prev</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleGetContext}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-900 px-3.5 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-300 hover:text-neutral-100 hover:border-neutral-600 active:scale-95 transition-all whitespace-nowrap min-h-[52px]"
                      >
                        <Copy size={13} />
                        <span>Get Context</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExplanationOpen((prev) => !prev)}
                        className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-3 text-xs font-semibold uppercase tracking-wider active:scale-95 transition-all whitespace-nowrap min-h-[52px] ${
                          explanationOpen
                            ? 'border-[#00ff41] bg-[#00ff41]/20 text-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.2)]'
                            : 'border-[#00ff41]/30 bg-neutral-900 text-[#00ff41] hover:bg-[#00ff41]/10 hover:border-[#00ff41]'
                        }`}
                      >
                        <Sparkles size={13} />
                        <span>Explain</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleNext}
                      className="w-full sm:flex-1 rounded-xl bg-[#00ff41] py-3 text-xs font-bold uppercase tracking-wider text-neutral-950 hover:bg-[#00ff41]/90 active:scale-95 shadow-[0_0_15px_rgba(0,255,65,0.25)] transition-all inline-flex items-center justify-center gap-1 whitespace-nowrap min-h-[52px]"
                    >
                      <span>{currentIndex === activeCards.length - 1 ? 'Finish Set' : 'Next Card'}</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                ) : (
                  /* Front Face Actions: Prev, Flip, Next */
                  <div className="flex items-center gap-2.5 w-full">
                    <button
                      type="button"
                      disabled={currentIndex === 0}
                      onClick={handlePrev}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-xs font-bold uppercase tracking-wider text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all whitespace-nowrap min-h-[52px]"
                    >
                      <ChevronLeft size={16} />
                      <span className="hidden sm:inline">Prev</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleFlip}
                      className="flex-1 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-[#00ff41] hover:text-[#00ff41] py-3 text-xs font-bold uppercase tracking-wider text-neutral-200 active:scale-95 transition-all shadow-sm whitespace-nowrap min-h-[52px]"
                    >
                      Reveal {currentCard?.type === 'formula' ? (settings.swapTermDef ? 'Name' : 'Formula') : (settings.swapTermDef ? 'Term' : 'Definition')}
                    </button>

                    <button
                      type="button"
                      onClick={handleNext}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-xs font-bold uppercase tracking-wider text-neutral-300 hover:bg-neutral-800 hover:text-white active:scale-95 transition-all whitespace-nowrap min-h-[52px]"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Set Complete View */}
          {!isLoading && isCompleted && (
            <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900/80 overflow-hidden shadow-sm my-1 sm:my-2">
              <div className="py-3.5 px-4 text-center border-b border-neutral-800 bg-neutral-950/40">
                <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20 shadow-[0_0_16px_rgba(0,255,65,0.2)]">
                  <CheckCircle2 size={20} />
                </div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-100 uppercase">
                  Set Complete! 🎉
                </h2>
                <div className="mt-1 inline-block bg-neutral-950 border border-neutral-800 px-3 py-0.5 rounded-md">
                  <span className="text-xs sm:text-sm font-mono font-bold text-[#00ff41]">
                    {activeCards.length} {cardType === 'formula' ? 'formulas' : 'flashcards'} reviewed
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-3 sm:p-4 border-t border-neutral-800 bg-neutral-950/40 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleRestart}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#00ff41] py-2.5 sm:py-3 text-xs font-bold uppercase tracking-wider text-neutral-950 hover:bg-[#00ff41]/90 active:scale-95 shadow-[0_0_15px_rgba(0,255,65,0.25)] transition-all min-h-[46px] whitespace-nowrap"
                >
                  <RotateCcw size={14} />
                  <span>Study Again</span>
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-2.5 sm:py-3 text-xs font-semibold uppercase tracking-wider text-neutral-300 hover:bg-neutral-800 active:scale-95 transition-all min-h-[46px] whitespace-nowrap"
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
        alt="Flashcard Diagram"
        onClose={() => setLightboxSrc(null)}
      />

      {/* Leave Confirmation Modal */}
      <LeaveConfirmModal
        isOpen={showExitConfirm}
        onConfirm={() => {
          stop()
          setShowExitConfirm(false)
          onExit()
        }}
        onCancel={() => setShowExitConfirm(false)}
      />

      {/* Flashcard / Formula Settings Modal */}
      <FlashcardSettingsModal
        isOpen={showSettingsModal}
        cardCount={rawCards.length}
        settings={settings}
        onSettingsChange={(newSettings) => {
          setSettings(newSettings)
          setSessionBookmarks(bookmarkedIds)
        }}
        onStart={() => setShowSettingsModal(false)}
        onClose={() => setShowSettingsModal(false)}
        cardType={cardType}
      />
    </div>
  )
}

export default FlashcardSession
