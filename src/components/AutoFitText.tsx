import React, { useRef, useEffect, useState } from 'react'

interface AutoFitTextProps {
  html: string
  className?: string
  minScale?: number
}

/**
 * AutoFitText — dynamically scales text/KaTeX content to fit within container width.
 * Prevents long mathematical formulas from overflowing or getting clipped on mobile screens.
 */
export const AutoFitText: React.FC<AutoFitTextProps> = ({
  html,
  className,
  minScale = 0.4,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number>(1)

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current && contentRef.current) {
        const containerWidth = containerRef.current.clientWidth
        const contentWidth = contentRef.current.scrollWidth

        if (contentWidth > containerWidth && containerWidth > 0) {
          // Add 5% margin so equation does not touch the absolute border edges
          const calculatedScale = (containerWidth * 0.95) / contentWidth
          setScale(Math.max(calculatedScale, minScale))
        } else {
          setScale(1)
        }
      }
    }

    // Initial measurement
    updateScale()

    const resizeObserver = new ResizeObserver(() => {
      updateScale()
    })

    if (containerRef.current) resizeObserver.observe(containerRef.current)
    if (contentRef.current) resizeObserver.observe(contentRef.current)

    // Also re-measure on window resize / orientation changes
    window.addEventListener('resize', updateScale)
    window.addEventListener('orientationchange', updateScale)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateScale)
      window.removeEventListener('orientationchange', updateScale)
    }
  }, [html, minScale])

  return (
    <div ref={containerRef} className="w-full flex justify-center items-center overflow-hidden">
      <div
        ref={contentRef}
        className={className}
        style={{
          transform: scale < 1 ? `scale(${scale})` : 'none',
          transformOrigin: 'center center',
          width: '100%',
          textAlign: 'center',
          wordBreak: 'break-word',
          transition: 'transform 0.15s ease-out',
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

export default AutoFitText
