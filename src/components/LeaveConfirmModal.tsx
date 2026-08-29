import { AlertTriangle, X } from 'lucide-react'

export interface LeaveConfirmModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  message?: string
}

export function LeaveConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  message = 'You have an active study session. Leaving now will lose your current progress. Are you sure you want to exit?',
}: LeaveConfirmModalProps) {
  if (!isOpen) return null

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
          {/* Top Red Gradient Accent Bar */}
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-transparent via-red-500 to-transparent" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-4 right-4 p-1 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-colors"
          >
            <X size={18} />
          </button>

          {/* Warning Icon */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
            <AlertTriangle size={26} />
          </div>

          {/* Title & Message */}
          <h2 className="text-lg font-bold text-neutral-100 uppercase tracking-wide">
            Abort Session?
          </h2>
          <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
            {message}
          </p>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full rounded-xl bg-red-600 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-red-500 active:scale-95 transition-all shadow-[0_0_15px_rgba(239,68,68,0.25)]"
            >
              Leave Session
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-300 hover:bg-neutral-800 hover:text-white active:scale-95 transition-all"
            >
              Keep Studying
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default LeaveConfirmModal
