import { AlertTriangle, CheckCircle2, X } from 'lucide-react'

export interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'default' | 'danger'
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}: ConfirmModalProps) {
  if (!isOpen) return null

  const isDanger = variant === 'danger'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />

      {/* Modal Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Gradient Accent Bar */}
          <div
            className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-transparent ${
              isDanger ? 'via-red-500' : 'via-[#00ff41]'
            } to-transparent`}
          />

          {/* Close Button */}
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-4 right-4 p-1 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-colors"
          >
            <X size={18} />
          </button>

          {/* Icon Circle */}
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border ${
              isDanger
                ? 'bg-red-500/10 border-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                : 'bg-[#00ff41]/10 border-[#00ff41]/20 text-[#00ff41] shadow-[0_0_15px_rgba(0,255,65,0.15)]'
            }`}
          >
            {isDanger ? <AlertTriangle size={26} /> : <CheckCircle2 size={26} />}
          </div>

          {/* Title & Message */}
          <h2 className="text-lg font-bold text-neutral-100 uppercase tracking-wide">
            {title}
          </h2>
          <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
            {message}
          </p>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onConfirm}
              className={`w-full rounded-xl py-3 text-xs font-bold uppercase tracking-wider active:scale-95 transition-all ${
                isDanger
                  ? 'bg-red-600 text-white hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.25)]'
                  : 'bg-[#00ff41] text-neutral-950 hover:bg-[#00ff41]/90 shadow-[0_0_15px_rgba(0,255,65,0.25)]'
              }`}
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-300 hover:bg-neutral-800 hover:text-white active:scale-95 transition-all"
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default ConfirmModal
