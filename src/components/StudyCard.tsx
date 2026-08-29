import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bookmark, ChevronDown, ChevronUp } from 'lucide-react'
import { renderMath } from '../lib/latex'
import type { Card, FlashcardData } from '../types'
import { resolveImageSrc } from '../services/image.service'
/**
 * Returns a Tailwind font-size class based on text length, with landscape scaling.
 * In landscape mode, font size is scaled up to make optimal use of wider screen width.
 */
function getCardDynamicFontSize(text: string): string {
  const len = text?.length ?? 0
  if (len <= 20)  return 'text-5xl landscape:text-6xl'
  if (len <= 40)  return 'text-4xl landscape:text-5xl'
  if (len <= 80)  return 'text-3xl landscape:text-4xl'
  if (len <= 160) return 'text-2xl landscape:text-3xl'
  if (len <= 300) return 'text-xl landscape:text-2xl'
  return 'text-lg landscape:text-xl'
}

export function getFrontText(card: Card, swapTermDef: boolean): string {
  const fc = card.data as FlashcardData
  return swapTermDef ? fc.back : fc.front
}

export function getBackText(card: Card, swapTermDef: boolean): string {
  const fc = card.data as FlashcardData
  return swapTermDef ? fc.front : fc.back
}

export function getCorrectAnswer(card: Card, swapTermDef: boolean): string {
  const fc = card.data as FlashcardData
  return swapTermDef ? fc.front : fc.back
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
  const fc = card.data as FlashcardData
  const [frontImageSrc, setFrontImageSrc] = useState<string | null>(null)
  const [backImageSrc, setBackImageSrc] = useState<string | null>(null)
  const [explanationImageSrc, setExplanationImageSrc] = useState<string | null>(null)

  // Resolve images asynchronously
  useEffect(() => {
    let isCancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset images before async resolution
    setFrontImageSrc(null)
    setBackImageSrc(null)
    setExplanationImageSrc(null)

    const frontImg = fc.imageFront || fc.imagePath
    if (frontImg) {
      resolveImageSrc(frontImg).then((src) => {
        if (!isCancelled) setFrontImageSrc(src)
      })
    }

    if (fc.imageBack) {
      resolveImageSrc(fc.imageBack).then((src) => {
        if (!isCancelled) setBackImageSrc(src)
      })
    }

    if (fc.explanationImagePath) {
      resolveImageSrc(fc.explanationImagePath).then((src) => {
        if (!isCancelled) setExplanationImageSrc(src)
      })
    }

    return () => {
      isCancelled = true
    }
  }, [card.id, fc.imageFront, fc.imagePath, fc.imageBack, fc.explanationImagePath])

  const frontText = getFrontText(card, swapTermDef)
  const backText = getBackText(card, swapTermDef)

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
        style={{ perspective: '1200px' }}
        onClick={onFlip}
      >
        <div
          className="min-h-[380px] landscape:min-h-[320px]"
          style={{
            position: 'relative',
            width: '100%',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            willChange: 'transform',
          }}
        >
          {/* FRONT FACE */}
          <div
            className="rounded-2xl border border-neutral-800 bg-neutral-900/90 shadow-xl flex flex-col justify-between"
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
            {/* Top Row: Label & Bookmark */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-400 bg-neutral-950/60 px-2 py-0.5 rounded border border-neutral-800">
                {swapTermDef ? 'Definition' : 'Term'}
              </span>
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

            {/* Front Content Body */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 landscape:px-10 landscape:py-8 text-center">
              <div
                className={`${getCardDynamicFontSize(frontText)} font-semibold text-neutral-100 leading-relaxed max-w-full break-words`}
                dangerouslySetInnerHTML={{ __html: renderMath(frontText) }}
              />

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
                Tap card to flip
              </p>
            </div>
          </div>

          {/* BACK FACE */}
          <div
            className="rounded-2xl border border-neutral-800 bg-neutral-900/90 shadow-xl flex flex-col justify-between"
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
            {/* Top Row: Label & Bookmark */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-400 bg-neutral-950/60 px-2 py-0.5 rounded border border-neutral-800">
                {swapTermDef ? 'Term' : 'Definition'}
              </span>
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

            {/* Back Content Body */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 landscape:px-10 landscape:py-8 text-center">
              <div
                className={`${getCardDynamicFontSize(backText)} font-semibold text-neutral-100 leading-relaxed max-w-full break-words`}
                dangerouslySetInnerHTML={{ __html: renderMath(backText) }}
              />

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
            {(fc.explanation || explanationImageSrc) && (
              <ExplanationBlock
                explanationText={fc.explanation}
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
