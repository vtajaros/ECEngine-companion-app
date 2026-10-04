import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSound } from '../../hooks/useSound'
import { X } from 'lucide-react'

interface GauntletCountdownProps {
  onBegin: () => void
  onCancel: () => void
}

type Step = 3 | 2 | 1 | 'GO!'

export const GauntletCountdown: React.FC<GauntletCountdownProps> = ({
  onBegin,
  onCancel,
}) => {
  const [step, setStep] = useState<Step>(3)
  const { play } = useSound()
  const begunRef = useRef(false)
  const timeoutsRef = useRef<NodeJS.Timeout[]>([])

  useEffect(() => {
    // Initial step 3
    play('tick')

    const t1 = setTimeout(() => {
      setStep(2)
      play('tick')
    }, 800)

    const t2 = setTimeout(() => {
      setStep(1)
      play('tick')
    }, 1600)

    const t3 = setTimeout(() => {
      setStep('GO!')
      play('go')
    }, 2400)

    const t4 = setTimeout(() => {
      if (!begunRef.current) {
        begunRef.current = true
        onBegin()
      }
    }, 3000)

    timeoutsRef.current = [t1, t2, t3, t4]

    return () => {
      timeoutsRef.current.forEach(clearTimeout)
    }
  }, [play, onBegin])

  // Escape key cancels countdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        timeoutsRef.current.forEach(clearTimeout)
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const handleCancelClick = () => {
    timeoutsRef.current.forEach(clearTimeout)
    onCancel()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-auto bg-neutral-950/95 backdrop-blur-md">
      {/* Animated Number / GO! */}
      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.4, opacity: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className={`font-display font-black tracking-widest select-none ${
              step === 'GO!'
                ? 'text-8xl sm:text-9xl text-[#00FF41] drop-shadow-[0_0_40px_rgba(0,255,65,1)]'
                : 'text-7xl sm:text-9xl text-white drop-shadow-[0_0_25px_rgba(0,255,65,0.7)]'
            }`}
          >
            {step}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Cancel button (visible during 3, 2, 1) */}
      <div className="pb-16 shrink-0">
        {step !== 'GO!' && (
          <button
            type="button"
            onClick={handleCancelClick}
            className="px-5 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-700/80 hover:border-red-500/80 text-neutral-400 hover:text-red-400 text-xs font-rajdhani font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-lg active:scale-95 cursor-pointer"
          >
            <X size={14} />
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
