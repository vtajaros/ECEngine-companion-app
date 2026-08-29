import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Bookmark, ChevronDown, ChevronUp } from 'lucide-react'
import { renderMath } from '../lib/latex'
import type { Card, FlashcardData, FormulaData } from '../types'
import { resolveImageSrc } from '../services/image.service'
import { AutoFitText } from './AutoFitText'

/**
 * Returns a Tailwind base font-size class based on text length.
 * AutoFitText scales the text/KaTeX down dynamically if the rendered content exceeds card width.
 */
function getCardDynamicFontSize(text: string): string {
  const len = text?.length ?? 0
  if (len <= 20)  return 'text-4xl landscape:text-3xl'
  if (len <= 40)  return 'text-3xl landscape:text-2xl'
  if (len <= 80)  return 'text-2xl landscape:text-xl'
  if (len <= 160) return 'text-xl landscape:text-lg'
  if (len <= 300) return 'text-lg landscape:text-base'
  return 'text-base landscape:text-sm'
}

function formatFormulaBack(f: FormulaData): string {
  let varsStrings: string[] = []
  if (f.variables && typeof f.variables === 'object') {
    varsStrings = Object.entries(f.variables).map(([key, val]) => {
      const v = String(val)
      const wrappedVal = /\\[a-zA-Z]/.test(v) ? `$${v}$` : v
      return `$${key}$: ${wrappedVal}`
    })
  }
  const descVars = [f.description, varsStrings.join('\n')].filter(Boolean).join('\n\n')

  return f.backIsPlainText
    ? [f.latex || '', descVars].filter(Boolean).join('\n\n')
    : [f.latex ? `$$${f.latex}$$` : '', descVars].filter(Boolean).join('\n\n')
}

export function getFrontText(card: Card, swapTermDef: boolean): string {
  if (card.type === 'formula') {
    const f = card.data as FormulaData
    const frontStr = f.name ?? ''
    const backStr = formatFormulaBack(f)
    return swapTermDef ? backStr : frontStr
  }
  const fc = card.data as FlashcardData
  return swapTermDef ? fc.back : fc.front
}

export function getBackText(card: Card, swapTermDef: boolean): string {
  if (card.type === 'formula') {
    const f = card.data as FormulaData
    const frontStr = f.name ?? ''
    const backStr = formatFormulaBack(f)
    return swapTermDef ? frontStr : backStr
  }
  const fc = card.data as FlashcardData
  return swapTermDef ? fc.front : fc.back
}

export function getCorrectAnswer(card: Card, swapTermDef: boolean): string {
  return getBackText(card, swapTermDef)
}

interface ExplanationBlockProps {
  explanationText?: string
  explanationImageSrc?: string | null
  onZoomImage: (imagePath: string) => void
  forceOpen?: boolean
}

function ExplanationBlock({
  explanationText,
  explanationImageSrc,
  onZoomImage,
  forceOpen = false,
}: ExplanationBlockProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = forceOpen || internalOpen

  if (!explanationText && !explanationImageSrc) return null

  return (
    <div className="w-full border-t border-neutral-800/80 text-left px-5 py-3 bg-neutral-950/60 rounded-b-2xl">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setInternalOpen(!internalOpen)
        }}
        className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-400 hover:text-neutral-200 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff41] inline-block shadow-[0_0_6px_rgba(0,255,65,0.6)]" />
          Explanation
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
      </button>

      {open && (
        <div className="mt-2.5 pt-2 border-t border-neutral-800/60 flex flex-col gap-2.5">
          {explanationText && (
            <div
              className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMath(explanationText) }}
            />
          )}
          {explanationImageSrc && (
            <div
              className="flex justify-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/60 p-2 cursor-zoom-in active:scale-[0.98] transition-transform"
              onClick={(e) => {
                e.stopPropagation()
                onZoomImage(explanationImageSrc)
              }}
              title="Tap to zoom"
            >
              <img
                src={explanationImageSrc}
                alt="Explanation diagram"
                className="max-h-56 w-full object-contain rounded-lg"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export interface StudyCardProps {
  card: Card
  currentIndex: number
  isFlipped: boolean
  swapTermDef: boolean
  isBookmarked: boolean
  onFlip: () => void
  onBookmarkToggle: (cardId: string) => void
  onZoomImage: (imagePath: string) => void
}

export const StudyCard = React.memo(function StudyCard({
  card,
  currentIndex,
  isFlipped,
  swapTermDef,
  isBookmarked,
  onFlip,
  onBookmarkToggle,
  onZoomImage,
}: StudyCardProps) {
  const isFormulaCard = card.type === 'formula'
  const fcData = card.data as FlashcardData
  const formulaData = card.data as FormulaData

  const [frontImageSrc, setFrontImageSrc] = useState<string | null>(null)
  const [backImageSrc, setBackImageSrc] = useState<string | null>(null)
  const [explanationImageSrc, setExplanationImageSrc] = useState<string | null>(null)

  // Face measurement refs & dynamic height state
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const [frontHeight, setFrontHeight] = useState<number>(0)
  const [backHeight, setBackHeight] = useState<number>(0)

  // Pinch-to-zoom state for card text
  const [scale, setScale] = useState<number>(1)
  const [isPinching, setIsPinching] = useState<boolean>(false)
  const initialDistRef = useRef<number | null>(null)
  const initialScaleRef = useRef<number>(1)
  const pinchEndTimeRef = useRef<number>(0)
  const lastTapRef = useRef<number>(0)

  // Reset zoom scale on card flip or card index change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset zoom scale when card changes or flips
    setScale(1)
    setIsPinching(false)
    initialDistRef.current = null
  }, [card.id, currentIndex, isFlipped])

  // Measure dynamic rendered height of both card faces
  useEffect(() => {
    const updateHeights = () => {
      if (frontRef.current) {
        setFrontHeight(frontRef.current.offsetHeight)
      }
      if (backRef.current) {
        setBackHeight(backRef.current.offsetHeight)
      }
    }

    updateHeights()

    const ro = new ResizeObserver(() => {
      updateHeights()
    })

    if (frontRef.current) ro.observe(frontRef.current)
    if (backRef.current) ro.observe(backRef.current)

    return () => {
      ro.disconnect()
    }
  }, [card.id, isFlipped, frontImageSrc, backImageSrc, explanationImageSrc])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      initialDistRef.current = dist
      initialScaleRef.current = scale
      setIsPinching(true)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistRef.current !== null) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const factor = currentDist / initialDistRef.current
      const newScale = Math.min(Math.max(initialScaleRef.current * factor, 0.75), 3.0)
      setScale(newScale)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      if (initialDistRef.current !== null) {
        pinchEndTimeRef.current = Date.now()
        initialDistRef.current = null
        setIsPinching(false)
      }
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Ignore click if a pinch gesture just concluded within 300ms
    if (Date.now() - pinchEndTimeRef.current < 300) {
      return
    }

    const now = Date.now()
    if (now - lastTapRef.current < 300 && scale !== 1) {
      // Double tap reset zoom
      e.stopPropagation()
      setScale(1)
      lastTapRef.current = 0
      return
    }
    lastTapRef.current = now
    onFlip()
  }

  // Resolve images asynchronously
  useEffect(() => {
    let isCancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset images before async resolution
    setFrontImageSrc(null)
    setBackImageSrc(null)
    setExplanationImageSrc(null)

    const frontImg = isFormulaCard
      ? formulaData.imagePathFront
      : (fcData.imageFront || fcData.imagePath)

    if (frontImg) {
      resolveImageSrc(frontImg).then((src) => {
        if (!isCancelled) setFrontImageSrc(src)
      })
    }

    const backImg = isFormulaCard
      ? formulaData.imagePath
      : fcData.imageBack

    if (backImg) {
      resolveImageSrc(backImg).then((src) => {
        if (!isCancelled) setBackImageSrc(src)
      })
    }

    const explanationImg = isFormulaCard
      ? formulaData.explanationImagePath
      : fcData.explanationImagePath

    if (explanationImg) {
      resolveImageSrc(explanationImg).then((src) => {
        if (!isCancelled) setExplanationImageSrc(src)
      })
    }

    return () => {
      isCancelled = true
    }
  }, [card.id, isFormulaCard, fcData.imageFront, fcData.imagePath, fcData.imageBack, fcData.explanationImagePath, formulaData.imagePathFront, formulaData.imagePath, formulaData.explanationImagePath])

  const frontText = getFrontText(card, swapTermDef)
  const backText = getBackText(card, swapTermDef)

  const frontLabel = isFormulaCard
    ? (swapTermDef ? 'Formula' : 'Name')
    : (swapTermDef ? 'Definition' : 'Term')

  const backLabel = isFormulaCard
    ? (swapTermDef ? 'Name' : 'Formula')
    : (swapTermDef ? 'Term' : 'Definition')

  const explanationText = isFormulaCard ? formulaData.explanation : fcData.explanation

  const activeHeight = isFlipped ? backHeight : frontHeight
  const dynamicHeight = activeHeight > 0 ? activeHeight : undefined

  return (
    <motion.div
      key={`${card.id}-${currentIndex}`}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="w-full select-none"
    >
      {/* 3D Flip Card Container */}
      <div
        className="w-full cursor-pointer min-h-[380px] landscape:min-h-[320px]"
        style={{
          perspective: '1200px',
          height: dynamicHeight ? `${dynamicHeight}px` : undefined,
          transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={handleCardClick}
      >
        <div
          className="min-h-[380px] landscape:min-h-[320px]"
          style={{
            position: 'relative',
            width: '100%',
            height: dynamicHeight ? `${dynamicHeight}px` : '100%',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            willChange: 'transform',
          }}
        >
          {/* FRONT FACE */}
          <div
            ref={frontRef}
            className="rounded-2xl border border-neutral-800 bg-neutral-900/90 shadow-xl flex flex-col justify-between min-h-[380px] landscape:min-h-[320px]"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              minHeight: '100%',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            {/* Top Row: Label, Zoom Reset Pill & Bookmark */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-400 bg-neutral-950/60 px-2 py-0.5 rounded border border-neutral-800">
                  {frontLabel}
                </span>
                {scale !== 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setScale(1)
                    }}
                    className="text-[10px] font-mono font-semibold text-[#00ff41] bg-[#00ff41]/10 px-2 py-0.5 rounded border border-[#00ff41]/30 hover:bg-[#00ff41]/20 active:scale-95 transition-all"
                    title="Reset text zoom"
                  >
                    {Math.round(scale * 100)}% (reset)
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onBookmarkToggle(card.id)
                }}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-[#00ff41] active:scale-90 transition-all"
                title={isBookmarked ? 'Remove bookmark' : 'Bookmark this card'}
              >
                <Bookmark
                  size={18}
                  className={isBookmarked ? 'fill-[#00ff41] text-[#00ff41]' : ''}
                />
              </button>
            </div>

            {/* Front Content Body (Pinch-to-zoom enabled) */}
            <div
              className="flex-1 flex flex-col items-center justify-center px-6 py-6 landscape:px-10 landscape:py-8 text-center overflow-hidden w-full"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            >
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: isPinching ? 'none' : 'transform 0.15s ease-out',
                  width: '100%',
                }}
                className="w-full flex justify-center items-center"
              >
                <AutoFitText
                  html={renderMath(frontText)}
                  className={`${getCardDynamicFontSize(frontText)} font-semibold text-neutral-100 leading-relaxed max-w-full break-words`}
                />
              </div>

              {frontImageSrc && (
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    onZoomImage(frontImageSrc)
                  }}
                  className="mt-4 flex justify-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/60 p-2 cursor-zoom-in active:scale-[0.98] transition-transform max-w-full"
                  title="Tap to zoom"
                >
                  <img
                    src={frontImageSrc}
                    alt="Card diagram"
                    className="max-h-60 landscape:max-h-72 w-full object-contain rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* Bottom Hint */}
            <div className="px-5 pb-4 pt-1 text-center">
              <p className="text-[11px] font-mono text-neutral-500">
                Tap card to flip • Pinch text to zoom
              </p>
            </div>
          </div>

          {/* BACK FACE */}
          <div
            ref={backRef}
            className="rounded-2xl border border-neutral-800 bg-neutral-900/90 shadow-xl flex flex-col justify-between min-h-[380px] landscape:min-h-[320px]"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              minHeight: '100%',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            {/* Top Row: Label, Zoom Reset Pill & Bookmark */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-400 bg-neutral-950/60 px-2 py-0.5 rounded border border-neutral-800">
                  {backLabel}
                </span>
                {scale !== 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setScale(1)
                    }}
                    className="text-[10px] font-mono font-semibold text-[#00ff41] bg-[#00ff41]/10 px-2 py-0.5 rounded border border-[#00ff41]/30 hover:bg-[#00ff41]/20 active:scale-95 transition-all"
                    title="Reset text zoom"
                  >
                    {Math.round(scale * 100)}% (reset)
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onBookmarkToggle(card.id)
                }}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-[#00ff41] active:scale-90 transition-all"
                title={isBookmarked ? 'Remove bookmark' : 'Bookmark this card'}
              >
                <Bookmark
                  size={18}
                  className={isBookmarked ? 'fill-[#00ff41] text-[#00ff41]' : ''}
                />
              </button>
            </div>

            {/* Back Content Body (Pinch-to-zoom enabled) */}
            <div
              className="flex-1 flex flex-col items-center justify-center px-6 py-6 landscape:px-10 landscape:py-8 text-center overflow-hidden w-full"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            >
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: isPinching ? 'none' : 'transform 0.15s ease-out',
                  width: '100%',
                }}
                className="w-full flex justify-center items-center"
              >
                <AutoFitText
                  html={renderMath(backText)}
                  className={`${getCardDynamicFontSize(backText)} font-semibold text-neutral-100 leading-relaxed max-w-full break-words`}
                />
              </div>

              {backImageSrc && (
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    onZoomImage(backImageSrc)
                  }}
                  className="mt-4 flex justify-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/60 p-2 cursor-zoom-in active:scale-[0.98] transition-transform max-w-full"
                  title="Tap to zoom"
                >
                  <img
                    src={backImageSrc}
                    alt="Card back diagram"
                    className="max-h-60 landscape:max-h-72 w-full object-contain rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* Card's Static Explanation Block */}
            {(explanationText || explanationImageSrc) && (
              <ExplanationBlock
                explanationText={explanationText}
                explanationImageSrc={explanationImageSrc}
                onZoomImage={onZoomImage}
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
})

export default StudyCard
