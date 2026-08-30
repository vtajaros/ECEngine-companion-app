import { useState, useEffect } from 'react'
import { X, Shuffle, BookmarkCheck, BarChart2, Zap, Hash } from 'lucide-react'
import type { TestSettings } from '../pages/TestMode'

export const DEFAULT_TEST_SETTINGS: TestSettings = {
  itemCount: 'All',
  instantChecking: false,
  shuffleQuestions: true,
  shuffleChoices: true,
  bookmarkedOnly: false,
  randomSample: false,
}

interface TestSettingsModalProps {
  isOpen: boolean
  cardCount: number
  settings: TestSettings
  onSettingsChange: (s: TestSettings) => void
  onStart: () => void
  onClose: () => void
}

// Threshold matching desktop: only show Number of Items section if cardCount > 20
const ITEM_COUNT_THRESHOLD = 20

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked
          ? 'bg-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.35)]'
          : 'bg-neutral-700 border border-neutral-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export function TestSettingsModal({
  isOpen,
  cardCount,
  settings,
  onSettingsChange,
  onStart,
  onClose,
}: TestSettingsModalProps) {
  // Track custom item count input state locally
  const [customInput, setCustomInput] = useState('')
  const [isCustomMode, setIsCustomMode] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    // Reset custom state on each open
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset form state on modal open
    setIsCustomMode(typeof settings.itemCount === 'number' && ![20, 50, 100].includes(settings.itemCount as number))
    setCustomInput(typeof settings.itemCount === 'number' ? String(settings.itemCount) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  const set = (patch: Partial<TestSettings>) => onSettingsChange({ ...settings, ...patch })

  const showItemCountSection = cardCount > ITEM_COUNT_THRESHOLD

  // Available preset options filtered to those less than cardCount, matching desktop
  const presetOptions: Array<'All' | number> = [
    'All',
    ...[20, 50, 100].filter((n) => n < cardCount),
  ]

  const handlePresetSelect = (val: 'All' | number) => {
    setIsCustomMode(false)
    setCustomInput('')
    set({ itemCount: val })
  }

  const handleCustomChange = (raw: string) => {
    setCustomInput(raw)
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed)) {
      // Clamp [1, cardCount] — matches desktop's exact clamping logic
      const clamped = Math.min(Math.max(1, parsed), cardCount)
      set({ itemCount: clamped })
    }
  }

  const handleCustomBlur = () => {
    const parsed = parseInt(customInput, 10)
    if (isNaN(parsed)) {
      setCustomInput(String(settings.itemCount === 'All' ? '' : settings.itemCount))
      return
    }
    const clamped = Math.min(Math.max(1, parsed), cardCount)
    setCustomInput(String(clamped))
    set({ itemCount: clamped })
  }

  const isPresetSelected = (val: 'All' | number) =>
    !isCustomMode && settings.itemCount === val

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Panel — slides up from bottom on mobile, centered on sm */}
      <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4">
        <div className="relative w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl flex flex-col max-h-[90dvh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-neutral-100 tracking-tight">
                Test Settings
              </h2>
              <p className="text-[11px] text-neutral-400 mt-0.5 font-mono">
                {cardCount} cards available
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-all active:scale-95"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
            {/* Number of Items — only shown when cardCount > 20 */}
            {showItemCountSection && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Hash size={14} className="text-neutral-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Number of Items
                  </span>
                </div>

                {/* Preset chips */}
                <div className="flex flex-wrap gap-2">
                  {presetOptions.map((val) => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => handlePresetSelect(val)}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold border transition-all active:scale-95 ${
                        isPresetSelected(val)
                          ? 'bg-[#00ff41] text-neutral-950 border-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.25)]'
                          : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-neutral-500'
                      }`}
                    >
                      {val === 'All' ? 'All' : val}
                    </button>
                  ))}

                  {/* Custom button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomMode(true)
                      setCustomInput(String(settings.itemCount === 'All' ? '' : settings.itemCount))
                    }}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold border transition-all active:scale-95 ${
                      isCustomMode
                        ? 'bg-[#00ff41] text-neutral-950 border-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.25)]'
                        : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-neutral-500'
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {/* Custom number input */}
                {isCustomMode && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={cardCount}
                      value={customInput}
                      onChange={(e) => handleCustomChange(e.target.value)}
                      onBlur={handleCustomBlur}
                      placeholder={`1–${cardCount}`}
                      className="w-28 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm font-mono text-neutral-100 placeholder-neutral-600 focus:border-[#00ff41] focus:outline-none focus:ring-1 focus:ring-[#00ff41] transition-all"
                    />
                    <span className="text-[11px] text-neutral-500 font-mono">
                      of {cardCount} cards
                    </span>
                  </div>
                )}
              </section>
            )}

            {/* Divider */}
            {showItemCountSection && (
              <div className="h-px bg-neutral-800/80" />
            )}

            {/* Toggle rows */}
            <section className="flex flex-col gap-0 divide-y divide-neutral-800/60">
              {/* Instant Checking */}
              <div className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-400">
                    <Zap size={14} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-neutral-200">Instant Checking</span>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Show answer and feedback immediately upon selection
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.instantChecking}
                  onChange={(v) => set({ instantChecking: v })}
                />
              </div>

              {/* Shuffle Questions */}
              <div className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-400">
                    <Shuffle size={14} />
                  </div>
                  <span className="text-sm font-medium text-neutral-200">Shuffle Questions</span>
                </div>
                <ToggleSwitch
                  checked={settings.shuffleQuestions}
                  onChange={(v) => set({ shuffleQuestions: v })}
                />
              </div>

              {/* Shuffle Choices */}
              <div className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-400">
                    <Shuffle size={14} className="scale-x-[-1]" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-neutral-200">Shuffle Choices</span>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Randomizes A/B/C/D order per question
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.shuffleChoices}
                  onChange={(v) => set({ shuffleChoices: v })}
                />
              </div>

              {/* Bookmarked Only */}
              <div className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-400">
                    <BookmarkCheck size={14} />
                  </div>
                  <span className="text-sm font-medium text-neutral-200">Bookmarked Only</span>
                </div>
                <ToggleSwitch
                  checked={settings.bookmarkedOnly}
                  onChange={(v) => set({ bookmarkedOnly: v })}
                />
              </div>

              {/* Random Sample */}
              <div className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-400">
                    <BarChart2 size={14} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-neutral-200">Random Sample</span>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Weighted by mastery — harder cards appear more
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.randomSample ?? false}
                  onChange={(v) => set({ randomSample: v })}
                />
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 border-t border-neutral-800 px-5 py-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 py-2.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onStart}
              className="flex-[2] rounded-xl bg-[#00ff41] py-2.5 text-sm font-bold text-neutral-950 hover:bg-[#00ff41]/90 active:scale-95 transition-all shadow-[0_0_15px_rgba(0,255,65,0.25)]"
            >
              Start Test
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default TestSettingsModal
