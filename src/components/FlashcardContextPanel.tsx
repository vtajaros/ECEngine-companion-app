import { useState, useEffect } from 'react'
import { Sparkles, Terminal, Copy, Check, AlertCircle, X } from 'lucide-react'
import { getFlashcardExplanation, ExplainError } from '../services/explain.service'
import { renderMath } from '../lib/latex'
import { copyToClipboard } from '../services/clipboard.service'

export interface FlashcardContextPanelProps {
  term: string
  definition: string
  onOpenSettings?: () => void
  onClose?: () => void
}

export function FlashcardContextPanel({
  term,
  definition,
  onOpenSettings,
  onClose,
}: FlashcardContextPanelProps) {
  const [loading, setLoading] = useState(true)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<{ status?: number; detail?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let isCancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset state for new async fetch
    setLoading(true)
    setExplanation(null)
    setErrorType(null)
    setErrorDetails(null)

    getFlashcardExplanation({
      term,
      definition,
    })
      .then((text) => {
        if (isCancelled) return
        setExplanation(text)
        setLoading(false)
      })
      .catch((err) => {
        if (isCancelled) return
        setLoading(false)
        if (err instanceof ExplainError) {
          setErrorType(err.message)
          setErrorDetails({ status: err.status, detail: err.detail })
        } else {
          setErrorType('UNKNOWN')
          setErrorDetails({ detail: String(err) })
        }
      })

    return () => {
      isCancelled = true
    }
  }, [term, definition])

  const handleCopy = async () => {
    if (!explanation) return
    const success = await copyToClipboard(explanation)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="rounded-xl border border-[#00ff41]/30 bg-neutral-950/95 my-2.5 overflow-hidden shadow-lg transition-all animate-in fade-in duration-200">
      {/* Terminal Style Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-neutral-800 bg-neutral-900/90">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#00ff41]" />
          <span className="font-mono font-bold text-xs text-neutral-200 tracking-wider">
            AI EXPLANATION
          </span>
          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20">
            GPT-OSS-120B
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {!loading && explanation && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 border border-transparent hover:border-neutral-700 transition-all font-mono text-[11px]"
              title="Copy explanation"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-[#00ff41]" />
                  <span className="text-[10px] font-bold text-[#00ff41]">COPIED</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="text-[10px]">COPY</span>
                </>
              )}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-all"
              title="Close explanation"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 font-mono text-xs sm:text-[13px] text-neutral-200 leading-relaxed">
        {loading && (
          <div className="flex items-center gap-2 text-neutral-400 py-3">
            <Terminal className="w-4 h-4 text-[#00ff41] animate-pulse" />
            <span>Generating AI breakdown...</span>
          </div>
        )}

        {!loading && explanation && (
          <div className="space-y-3.5">
            {(() => {
              const formattedExplanation = /^\s*(\*\*Explanation:\*\*|\*\*Explanation\*\*|Explanation:)/i.test(explanation.trim())
                ? explanation.trim()
                : `**Explanation:** ${explanation.trim()}`

              return formattedExplanation
                .split(/\n\s*\n/)
                .filter((p) => p.trim())
                .map((paragraph, idx) => {
                  const isCallout = /^\s*(\*\*Key Formula or Example:\*\*|Key Formula or Example:|\*\*Key Formula:\*\*|Key Formula:|\*\*Memory Tip:\*\*|Memory Tip:)/i.test(paragraph)
                  const lines = paragraph.trim().split('\n')
                  const numberedLines = lines.filter((l) => /^\s*\d+[.)]\s/.test(l.trim()))
                  const isNumberedList = !isCallout && lines.length > 1 && numberedLines.length >= 2

                  if (isNumberedList) {
                    const headerLines: string[] = []
                    const listLines: string[] = []
                    for (const line of lines) {
                      if (/^\s*\d+[.)]\s/.test(line.trim())) {
                        listLines.push(line.trim())
                      } else {
                        headerLines.push(line.trim())
                      }
                    }

                    return (
                      <div key={idx} className="space-y-1.5 pl-1">
                        {headerLines.length > 0 && (
                          <div dangerouslySetInnerHTML={{ __html: renderMath(headerLines.join(' ')) }} />
                        )}
                        <ol className="list-none space-y-1.5 pl-0">
                          {listLines.map((line, li) => (
                            <li
                              key={li}
                              className="leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: renderMath(line) }}
                            />
                          ))}
                        </ol>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={idx}
                      className={`relative transition-colors ${
                        isCallout
                          ? 'border-l-2 border-[#00ff41] pl-3 py-1.5 my-1.5 bg-[#00ff41]/5 rounded-r text-neutral-100'
                          : 'pl-1'
                      }`}
                      dangerouslySetInnerHTML={{ __html: renderMath(paragraph.trim()) }}
                    />
                  )
                })
            })()}
          </div>
        )}

        {!loading && errorType && (
          <div className="border-l-2 border-red-500 pl-3.5 py-2 bg-red-500/10 rounded-r text-red-300 text-xs space-y-2">
            {errorType === 'NO_KEY' && (
              <div className="flex flex-col gap-2">
                <p className="flex items-center gap-1.5 text-amber-300 font-semibold">
                  <AlertCircle size={14} />
                  <span>No Groq API key configured</span>
                </p>
                <p className="text-neutral-300">
                  Add your free Groq API key in Settings to enable AI explanations.
                </p>
                {onOpenSettings && (
                  <div>
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="inline-flex items-center gap-1 text-[#00ff41] hover:underline font-bold"
                    >
                      <span>Go to Settings →</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            {errorType === 'INVALID_KEY' && (
              <div className="flex flex-col gap-1.5">
                <p>Invalid Groq API key. Please check your credentials in Settings.</p>
                {onOpenSettings && (
                  <div>
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="inline-flex items-center gap-1 text-[#00ff41] hover:underline font-bold"
                    >
                      <span>Update API Key in Settings →</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            {errorType === 'RATE_LIMITED' && (
              <p>Groq service is busy (rate limit reached). Please try again in a few seconds.</p>
            )}
            {errorType === 'TIMEOUT' && (
              <p>Request timed out after 15 seconds. Check your internet connection and try again.</p>
            )}
            {!['NO_KEY', 'INVALID_KEY', 'RATE_LIMITED', 'TIMEOUT'].includes(errorType) && (
              <div className="space-y-1">
                {errorDetails?.status === 503 && <p>Groq service unavailable. Try again later.</p>}
                {errorDetails?.status === 500 && <p>Groq server error. Try again in a moment.</p>}
                {!errorDetails?.status && <p>Network error. Check your connection.</p>}
                {errorDetails?.status && errorDetails.status !== 503 && errorDetails.status !== 500 && (
                  <p>Could not generate explanation (Status: {errorDetails.status}).</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default FlashcardContextPanel
