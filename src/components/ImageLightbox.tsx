import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export interface ImageLightboxProps {
  src: string | null
  alt?: string
  onClose: () => void
}

export function ImageLightbox({ src, alt = 'Diagram', onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isGesturing, setIsGesturing] = useState(false)
  const [showHint, setShowHint] = useState(true)

  // Gesture tracking refs
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const initialPinchDistanceRef = useRef<number>(0)
  const initialScaleRef = useRef<number>(1)
  const lastPanPosRef = useRef<{ x: number; y: number } | null>(null)
  const pointerDownTimeRef = useRef<number>(0)
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null)
  const lastTapTimeRef = useRef<number>(0)
  const lastTapPosRef = useRef<{ x: number; y: number } | null>(null)
  const hasMovedSignificantlyRef = useRef<boolean>(false)

  // Reset zoom and pan whenever src changes or lightbox opens
  useEffect(() => {
    if (src) {
      setScale(1)
      setTranslate({ x: 0, y: 0 })
      setShowHint(true)
      const timer = setTimeout(() => setShowHint(false), 2500)
      return () => clearTimeout(timer)
    }
  }, [src])

  if (!src) return null

  const handleClose = () => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
    onClose()
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setIsGesturing(true)

    if (activePointersRef.current.size === 1) {
      pointerDownTimeRef.current = Date.now()
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY }
      lastPanPosRef.current = { x: e.clientX, y: e.clientY }
      hasMovedSignificantlyRef.current = false
    } else if (activePointersRef.current.size === 2) {
      const [p1, p2] = Array.from(activePointersRef.current.values())
      initialPinchDistanceRef.current = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      initialScaleRef.current = scale
      lastPanPosRef.current = null
      hasMovedSignificantlyRef.current = true
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return
    e.preventDefault()
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointersRef.current.size === 2 && initialPinchDistanceRef.current > 0) {
      const [p1, p2] = Array.from(activePointersRef.current.values())
      const currentDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      const rawScale = initialScaleRef.current * (currentDistance / initialPinchDistanceRef.current)
      const clampedScale = Math.min(Math.max(rawScale, 1), 4)

      setScale(clampedScale)

      // Clamp translation to match new scale bounds
      const maxX = (clampedScale - 1) * (window.innerWidth / 2)
      const maxY = (clampedScale - 1) * (window.innerHeight / 2)
      setTranslate((prev) => ({
        x: Math.min(Math.max(prev.x, -maxX), maxX),
        y: Math.min(Math.max(prev.y, -maxY), maxY),
      }))
    } else if (activePointersRef.current.size === 1) {
      if (pointerDownPosRef.current) {
        const moveDist = Math.hypot(
          e.clientX - pointerDownPosRef.current.x,
          e.clientY - pointerDownPosRef.current.y
        )
        if (moveDist > 10) {
          hasMovedSignificantlyRef.current = true
        }
      }

      if (scale > 1 && lastPanPosRef.current) {
        const dx = e.clientX - lastPanPosRef.current.x
        const dy = e.clientY - lastPanPosRef.current.y
        lastPanPosRef.current = { x: e.clientX, y: e.clientY }

        const maxX = (scale - 1) * (window.innerWidth / 2)
        const maxY = (scale - 1) * (window.innerHeight / 2)

        setTranslate((prev) => ({
          x: Math.min(Math.max(prev.x + dx, -maxX), maxX),
          y: Math.min(Math.max(prev.y + dy, -maxY), maxY),
        }))
      }
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId)

    if (activePointersRef.current.size === 0) {
      setIsGesturing(false)

      const duration = Date.now() - pointerDownTimeRef.current
      const distMoved = pointerDownPosRef.current
        ? Math.hypot(e.clientX - pointerDownPosRef.current.x, e.clientY - pointerDownPosRef.current.y)
        : 999
      const isTap = duration < 300 && distMoved < 15 && !hasMovedSignificantlyRef.current

      if (isTap) {
        const now = Date.now()
        const timeSinceLastTap = now - lastTapTimeRef.current
        const distFromLastTap = lastTapPosRef.current
          ? Math.hypot(e.clientX - lastTapPosRef.current.x, e.clientY - lastTapPosRef.current.y)
          : 999

        if (timeSinceLastTap < 300 && distFromLastTap < 35) {
          // Double-tap: Toggle zoom
          if (scale > 1) {
            setScale(1)
            setTranslate({ x: 0, y: 0 })
          } else {
            setScale(2.2)
            setTranslate({ x: 0, y: 0 })
          }
          lastTapTimeRef.current = 0
          lastTapPosRef.current = null
        } else {
          // Record potential first tap
          lastTapTimeRef.current = now
          lastTapPosRef.current = { x: e.clientX, y: e.clientY }

          // If at natural scale (1x), single tap closes the lightbox
          if (scale <= 1) {
            setTimeout(() => {
              if (Date.now() - lastTapTimeRef.current >= 280 && lastTapTimeRef.current !== 0) {
                handleClose()
              }
            }, 290)
          }
        }
      }
    } else if (activePointersRef.current.size === 1) {
      // Transitioned from pinch to single pointer: resume smooth pan tracking
      const [remaining] = Array.from(activePointersRef.current.values())
      lastPanPosRef.current = { ...remaining }
    }
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking directly on the outer backdrop container
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 select-none touch-none overflow-hidden animate-in fade-in duration-200"
    >
      {/* Top Bar with Close Button */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <button
          type="button"
          onClick={handleClose}
          className="p-2.5 rounded-full bg-neutral-900/80 border border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all shadow-lg"
          title="Close full screen"
        >
          <X size={20} />
        </button>
      </div>

      {/* Interactive Image Container */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing p-4"
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transition: isGesturing ? 'none' : 'transform 0.18s ease-out',
          }}
          className="max-h-full max-w-full object-contain pointer-events-none rounded-lg"
        />
      </div>

      {/* Gesture Hint Toast */}
      {showHint && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none rounded-full bg-neutral-900/90 border border-neutral-800 px-4 py-1.5 text-[11px] font-mono text-neutral-300 shadow-md animate-in fade-in duration-300">
          Pinch to zoom • Double-tap to expand • Drag to pan
        </div>
      )}
    </div>
  )
}

export default ImageLightbox
