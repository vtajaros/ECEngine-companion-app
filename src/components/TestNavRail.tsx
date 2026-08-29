import { memo, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'

export interface TestNavRailProps {
  /** Total number of questions in the test */
  totalItems: number
  /** Zero-based index of the currently visible/active question */
  currentIndex: number
  /** Set of zero-based indices that have been answered */
  answeredIndices: Set<number> | Record<number, boolean>
  /** Called when the user taps a question chip to navigate to it */
  onNavigate: (index: number) => void
}

function isAnswered(
  answeredIndices: Set<number> | Record<number, boolean>,
  index: number
): boolean {
  if (answeredIndices instanceof Set) return answeredIndices.has(index)
  return !!answeredIndices[index]
}

export const TestNavRail = memo(function TestNavRail({
  totalItems,
  currentIndex,
  answeredIndices,
  onNavigate,
}: TestNavRailProps) {
  const activeChipRef = useRef<HTMLButtonElement | null>(null)
  const railBodyRef = useRef<HTMLDivElement>(null)

  // Auto-scroll the rail so the active chip stays centered
  useEffect(() => {
    activeChipRef.current?.scrollIntoView({
      behavior: 'auto',
      block: 'nearest',
    })
  }, [currentIndex])

  const answeredCount = Array.from({ length: totalItems }, (_, i) =>
    isAnswered(answeredIndices, i)
  ).filter(Boolean).length

  return (
    <aside
      className="w-36 shrink-0 flex flex-col items-stretch border border-neutral-800 bg-neutral-950/80 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden h-[calc(100vh-140px)] select-none"
      aria-label="Question Navigator"
    >
      <div className="px-3.5 py-3 shrink-0 flex flex-col items-center gap-1 border-b border-neutral-800/80 bg-neutral-900/40">
        <span className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase leading-tight">
          Item Navigator
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="font-mono text-xs text-emerald-400 font-bold tabular-nums">
            {answeredCount}
          </span>
          <span className="font-mono text-xs text-neutral-600">/</span>
          <span className="font-mono text-xs text-neutral-400 tabular-nums">
            {totalItems}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 ml-0.5 font-medium">
            done
          </span>
        </div>
        <div className="mt-2 w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
            style={{
              width: totalItems > 0 ? `${Math.round((answeredCount / totalItems) * 100)}%` : '0%',
            }}
          />
        </div>
      </div>

      {/* Question List */}
      <div
        ref={railBodyRef}
        className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {Array.from({ length: totalItems }, (_, i) => {
          const answered = isAnswered(answeredIndices, i)
          const isActive = i === currentIndex

          return (
            <button
              key={i}
              ref={isActive ? activeChipRef : null}
              onClick={() => onNavigate(i)}
              title={`Question ${i + 1}${answered ? ' (Answered)' : ''}`}
              className={`text-xs select-none transition-all duration-150 flex items-center justify-between w-full py-2 px-2.5 rounded-lg font-medium text-left ${
                isActive
                  ? 'text-white font-bold bg-neutral-800/90 border-l-2 border-emerald-500 shadow-sm'
                  : answered
                    ? 'text-emerald-400/90 hover:text-emerald-300 hover:bg-neutral-900/60'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
              }`}
            >
              <span className="truncate">Q{i + 1}</span>
              {answered && (
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
              )}
            </button>
          )
        })}
      </div>
    </aside>
  )
})
