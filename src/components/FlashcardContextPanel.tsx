import { useState, useEffect, useMemo } from 'react'
import { Sparkles, Terminal, Copy, Check, AlertCircle, X, Cpu } from 'lucide-react'
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

  interface FormattedParagraph {
    isNumberedList: boolean
    isCallout: boolean
    headerHtml?: string
    listHtml?: string[]
    paragraphHtml?: string
  }

  const parsedParagraphs = useMemo<FormattedParagraph[]>(() => {
    if (!explanation) return []

    const formattedExplanation = /^\s*(\*\*Explanation:\*\*|\*\*Explanation\*\*|Explanation:)/i.test(explanation.trim())
      ? explanation.trim()
      : `**Explanation:** ${explanation.trim()}`

    return formattedExplanation
      .split(/\n\s*\n/)
      .filter((p) => p.trim())
      .map((paragraph) => {
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

          return {
            isNumberedList: true,
            isCallout: false,
            headerHtml: headerLines.length > 0 ? renderMath(headerLines.join(' ')) : undefined,
            listHtml: listLines.map((line) => renderMath(line)),
          }
        }

        return {
          isNumberedList: false,
          isCallout,
          paragraphHtml: renderMath(paragraph.trim()),
        }
      })
  }, [explanation])

  return (
    <div className="relative my-2.5 w-full rounded-xl overflow-hidden border border-[#232730] bg-[#0c0d12] shadow-[0_8px_32px_rgba(0,0,0,0.7),0_0_15px_rgba(0,255,65,0.05)] transition-all animate-in fade-in duration-200">
      {/* Code Block Terminal Header Bar */}
      <div className="bg-[#12141a] border-b border-[#1f232c] px-3.5 py-2 flex items-center justify-between select-none">
        {/* AI Model Badge / File Tab */}
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-[#00ff41]" />
          <span className="font-['Orbitron'] font-bold text-[#00ff41] text-[11px] tracking-wider uppercase">
            GPT-OSS-120B
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 px-2 py-0.5 rounded bg-[#181b22] border border-[#262b35] font-['JetBrains_Mono',monospace]">
            <Sparkles className="w-2.5 h-2.5 text-[#00ff41]/70" /> ai_explanation.md
          </span>
        </div>

        {/* Actions (Copy + Close) */}
        <div className="flex items-center gap-1.5">
          {!loading && explanation && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-neutral-400 hover:text-white hover:bg-[#1a1d24] border border-transparent hover:border-[#2a2f3d] transition-all font-['JetBrains_Mono',monospace] text-xs cursor-pointer"
              title="Copy explanation"
              aria-label="Copy explanation"
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

      {/* Code Block Content Body with JetBrains Mono */}
      <div className="p-4 sm:p-5 font-['JetBrains_Mono',monospace] text-[13px] sm:text-[13.5px] text-[#d4d4d4] leading-[1.75] selection:bg-[#00ff41]/20 selection:text-white">
        {loading && (
          <div className="flex items-center gap-2 text-neutral-400 py-2">
            <Terminal className="w-4 h-4 text-[#00ff41] animate-pulse" />
            <span className="text-[#a0a0a0]">Generating AI breakdown...</span>
          </div>
        )}

        {!loading && explanation && (
          <div className="space-y-4">
            {parsedParagraphs.map((p, idx) => {
              if (p.isNumberedList) {
                return (
                  <div key={idx} className="relative pl-1 space-y-1.5">
                    {p.headerHtml && (
                      <div dangerouslySetInnerHTML={{ __html: p.headerHtml }} />
                    )}
                    <ol className="list-none space-y-1.5 pl-0">
                      {p.listHtml?.map((itemHtml, li) => (
                        <li
                          key={li}
                          className="leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: itemHtml }}
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
                    p.isCallout
                      ? 'border-l-2 border-[#00ff41] pl-3.5 py-1.5 my-2 bg-[#0c1a14]/40 rounded-r text-[#e8e8e8]'
                      : 'pl-1'
                  }`}
                  dangerouslySetInnerHTML={{ __html: p.paragraphHtml || '' }}
                />
              )
            })}
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
