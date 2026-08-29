import { useEffect } from 'react'
import { X, Shuffle, ArrowLeftRight, BookmarkCheck, PlayCircle, Volume2 } from 'lucide-react'
import { Preferences } from '@capacitor/preferences'

const TTS_ENABLED_KEY = 'ecengine:tts:enabled'

export interface FlashcardSettings {
  shuffleCards: boolean
  swapTermDef: boolean
  bookmarkedOnly: boolean
  autoAdvance: boolean
  autoAdvanceDelay: number
  ttsEnabled: boolean
}

export const DEFAULT_FLASHCARD_SETTINGS: FlashcardSettings = {
  shuffleCards: false,
  swapTermDef: false,
  bookmarkedOnly: false,
  autoAdvance: false,
  autoAdvanceDelay: 3,
  ttsEnabled: false,
}

const AUTO_ADVANCE_DELAYS = [1.5, 2, 3, 5, 10]

interface FlashcardSettingsModalProps {
  isOpen: boolean
  cardCount: number
  settings: FlashcardSettings
  onSettingsChange: (s: FlashcardSettings) => void
  onStart: () => void
  onClose: () => void
}

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

export function FlashcardSettingsModal({
  isOpen,
  cardCount,
  settings,
  onSettingsChange,
  onStart,
  onClose,
}: FlashcardSettingsModalProps) {
  // Load persisted TTS preference on modal open
  useEffect(() => {
    if (!isOpen) return
    Preferences.get({ key: TTS_ENABLED_KEY }).then(({ value }) => {
      const persisted = value === 'true'
      if (persisted !== settings.ttsEnabled) {
        onSettingsChange({ ...settings, ttsEnabled: persisted })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  const set = (patch: Partial<FlashcardSettings>) => onSettingsChange({ ...settings, ...patch })

  const handleTtsChange = async (value: boolean) => {
    set({ ttsEnabled: value })
    await Preferences.set({ key: TTS_ENABLED_KEY, value: String(value) })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4">
        <div className="relative w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl flex flex-col max-h-[90dvh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-neutral-100 tracking-tight">
                Flashcard Settings
              </h2>
              <p className="text-[11px] text-neutral-400 mt-0.5 font-mono">
                {cardCount} flashcards available
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
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1 divide-y divide-neutral-800/60">
            {/* Shuffle Cards */}
            <div className="flex items-center justify-between py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-400">
                  <Shuffle size={14} />
                </div>
                <div>
                  <span className="text-sm font-medium text-neutral-200">Shuffle Cards</span>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Randomizes flashcard order
                  </p>
                </div>
              </div>
              <ToggleSwitch
                checked={settings.shuffleCards}
                onChange={(v) => set({ shuffleCards: v })}
              />
            </div>

            {/* Swap Term & Definition */}
            <div className="flex items-center justify-between py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-400">
                  <ArrowLeftRight size={14} />
                </div>
                <div>
                  <span className="text-sm font-medium text-neutral-200">Swap Term & Definition</span>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Show definition on the front face first
                  </p>
                </div>
              </div>
              <ToggleSwitch
                checked={settings.swapTermDef}
                onChange={(v) => set({ swapTermDef: v })}
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

            {/* Auto-Advance Cards */}
            <div className="flex flex-col gap-2 py-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-400">
                    <PlayCircle size={14} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-neutral-200">Auto-Advance Cards</span>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Automatically moves to next card after delay
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={settings.autoAdvance}
                  onChange={(v) => set({ autoAdvance: v })}
                />
              </div>

              {settings.autoAdvance && (
                <div className="mt-2 pl-9">
                  <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block mb-1.5">
                    Advance Delay:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {AUTO_ADVANCE_DELAYS.map((delay) => (
                      <button
                        key={delay}
                        type="button"
                        onClick={() => set({ autoAdvanceDelay: delay })}
                        className={`rounded-lg px-3 py-1 text-xs font-mono font-semibold border transition-all active:scale-95 ${
                          settings.autoAdvanceDelay === delay
                            ? 'bg-[#00ff41] text-neutral-950 border-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.25)]'
                            : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-neutral-500'
                        }`}
                      >
                        {delay}s
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Read Terms Aloud (TTS) */}
            <div className="flex items-center justify-between py-3.5">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                  settings.ttsEnabled
                    ? 'bg-[#00ff41]/10 border-[#00ff41]/30 text-[#00ff41]'
                    : 'bg-neutral-800 border-transparent text-neutral-400'
                }`}>
                  <Volume2 size={14} />
                </div>
                <div>
                  <span className="text-sm font-medium text-neutral-200">Read Aloud</span>
                  <p className="text-[11px] text-neutral-500 mt-0.5 max-w-[220px]">
                    Reads the front of each flashcard using Android's native voice.
                  </p>
                </div>
              </div>
              <ToggleSwitch
                checked={settings.ttsEnabled}
                onChange={handleTtsChange}
              />
            </div>
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
              Start Session
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default FlashcardSettingsModal
