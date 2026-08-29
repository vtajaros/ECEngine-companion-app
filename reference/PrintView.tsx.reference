import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Table2, List, BookOpen, Bold, Loader2, CheckCircle2, AlertCircle, Minus, Square, X, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { dbService } from '../services/db.service'
import { Card, MCQData, FlashcardData, FormulaData } from '../types'
import { renderMath, renderPlainText } from '../lib/latex'
import { Tooltip } from '../components/ui/Tooltip'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LayoutMode = 'table' | 'glossary' | 'qa'
type BoldSide = 'term' | 'definition' | 'none'
type ExportState = 'idle' | 'loading' | 'success' | 'error'

type PrintTheme = 'light' | 'sepia' | 'dark'

interface ThemeDef {
  label: string
  vars: Record<string, string>
}

const PRINT_THEMES: Record<PrintTheme, ThemeDef> = {
  light: {
    label: 'Light',
    vars: {
      '--pt-bg-outer': '#e5e7eb',
      '--pt-bg-paper': '#ffffff',
      '--pt-text-primary': '#111827',
      '--pt-text-secondary': '#6b7280',
      '--pt-text-body': '#374151',
      '--pt-text-muted': '#9ca3af',
      '--pt-border': '#d1d5db',
      '--pt-border-light': '#e5e7eb',
      '--pt-thead-bg': '#f9fafb',
      '--pt-answer-bg': '#fef3c7',
      '--pt-answer-text': '#92400e',
      '--pt-formula-bg': '#f3f4f6',
      '--pt-formula-text': '#1e40af',
      '--pt-rule': '#111827',
    },
  },
  sepia: {
    label: 'Sepia',
    vars: {
      '--pt-bg-outer': '#c8b89a',
      '--pt-bg-paper': '#f5ead7',
      '--pt-text-primary': '#2c1a0e',
      '--pt-text-secondary': '#7a5c3e',
      '--pt-text-body': '#3d2b1a',
      '--pt-text-muted': '#a08060',
      '--pt-border': '#c4a882',
      '--pt-border-light': '#ddd0b8',
      '--pt-thead-bg': '#ede0c4',
      '--pt-answer-bg': '#e8d5a3',
      '--pt-answer-text': '#5c3a00',
      '--pt-formula-bg': '#ede0c4',
      '--pt-formula-text': '#3a2200',
      '--pt-rule': '#2c1a0e',
    },
  },
  dark: {
    label: 'Dark',
    vars: {
      '--pt-bg-outer': '#1a1d23',
      '--pt-bg-paper': '#252931',
      '--pt-text-primary': '#e8eaf0',
      '--pt-text-secondary': '#9099a8',
      '--pt-text-body': '#c8cdd6',
      '--pt-text-muted': '#5a6070',
      '--pt-border': '#363b45',
      '--pt-border-light': '#2e3340',
      '--pt-thead-bg': '#1e2128',
      '--pt-answer-bg': 'rgba(100,160,255,0.12)',
      '--pt-answer-text': '#7eb8f7',
      '--pt-formula-bg': '#1e2128',
      '--pt-formula-text': '#7eb8f7',
      '--pt-rule': '#4a5060',
    },
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

function isMCQ(card: Card): card is Card & { data: MCQData } {
  return card.type === 'mcq'
}
function isFlashcard(card: Card): card is Card & { data: FlashcardData } {
  return card.type === 'flashcard'
}
function isFormula(card: Card): card is Card & { data: FormulaData } {
  return card.type === 'formula'
}

/** Renders text that may contain LaTeX via dangerouslySetInnerHTML. */
function MathText({ text, style, plainText }: { text: string; style?: React.CSSProperties; plainText?: boolean }) {
  return (
    <span
      style={style}
      dangerouslySetInnerHTML={{ __html: plainText ? renderPlainText(text) : renderMath(text) }}
    />
  )
}

/** Clickable image that calls onZoom with the image path when clicked. */
function ClickableImg({
  src, alt, style, onZoom,
}: {
  src: string
  alt: string
  style?: React.CSSProperties
  onZoom: (src: string) => void
}) {
  return (
    <img
      src={src}
      alt={alt}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      onClick={(e) => { e.stopPropagation(); onZoom(src) }}
      style={{
        cursor: 'zoom-in',
        ...style,
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Sub-renderers — Paper content (print-safe black/white)
// ---------------------------------------------------------------------------

interface MCQTableRowProps {
  index: number
  card: Card & { data: MCQData }
  hideAnswers?: boolean
  hideSolutions?: boolean
  onZoom: (src: string) => void
}
function MCQTableRow({ index, card, hideAnswers, hideSolutions, onZoom }: MCQTableRowProps) {
  const { question, choices, answer, explanation, solutionImagePath, imagePath, choicesPlainText } = card.data
  const hasSolution = !hideSolutions && ((explanation && explanation.trim().length > 0) || !!solutionImagePath)
  return (
    <tr style={{ borderBottom: '1px solid var(--pt-border)', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
      <td style={{ padding: '10px 12px', verticalAlign: 'top', width: '65%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ fontWeight: 700, minWidth: '24px', color: 'var(--pt-text-primary)' }}>{index}.</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, color: 'var(--pt-text-primary)', marginBottom: '6px', lineHeight: 1.5 }}>
              <MathText text={question} />
            </p>
            {/* question imagePath */}
            {imagePath && (
              <ClickableImg
                src={`ece-app://${imagePath}`}
                alt="Question diagram"
                onZoom={onZoom}
                style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '6px', borderRadius: '4px', border: '1px solid var(--pt-border-light)', display: 'block' }}
              />
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: '2px 8px', marginTop: '4px' }}>
              {[0, 1, 2, 3].map((ci) => {
                const choice = choices[ci]
                if (choice === undefined) return null
                return (
                  <div
                    key={ci}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: (!hideAnswers && ci === answer) ? 'var(--pt-answer-bg)' : 'transparent',
                      color: (!hideAnswers && ci === answer) ? 'var(--pt-answer-text)' : 'var(--pt-text-body)',
                      fontWeight: (!hideAnswers && ci === answer) ? 700 : 400,
                      borderRadius: '3px',
                      display: 'flex',
                      gap: '6px',
                      gridColumn: ci < 2 ? 1 : 2,
                      gridRow: ci % 2 === 0 ? 1 : 2,
                      alignSelf: 'start',
                      justifySelf: 'start',
                    }}
                  >
                    <span style={{ minWidth: '18px', fontWeight: 700 }}>{CHOICE_LABELS[ci]}.</span>
                    <span><MathText text={choice} plainText={choicesPlainText?.[ci]} /></span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </td>
      <td
        style={{
          padding: '10px 12px',
          verticalAlign: 'top',
          width: '35%',
          borderLeft: '1px solid var(--pt-border)',
          fontSize: '13px',
        }}
      >
        {!hideAnswers && <span style={{ fontWeight: 700, color: 'var(--pt-text-primary)' }}>
          <MathText text={choices[answer] ?? '—'} plainText={choicesPlainText?.[answer]} />
        </span>}
        {hideAnswers && <span style={{ color: 'var(--pt-text-muted)' }}>—</span>}
        {/* Solution block — displayed below the answer in the Answer column */}
        {hasSolution && (
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--pt-border-light)' }}>
            <span style={{ fontWeight: 700, fontSize: '11px', color: 'var(--pt-text-primary)', display: 'block', marginBottom: '4px', letterSpacing: '0.05em' }}>SOLUTION:</span>
            {solutionImagePath && (
              <ClickableImg
                src={`ece-app://${solutionImagePath}`}
                alt="Solution diagram"
                onZoom={onZoom}
                style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', marginBottom: '6px', borderRadius: '4px', border: '1px solid var(--pt-border-light)', display: 'block' }}
              />
            )}
            {explanation && explanation.trim().length > 0 && (
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--pt-text-body)', lineHeight: 1.6 }}>
                <MathText text={explanation} />
              </p>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

interface MCQGlossaryItemProps {
  index: number
  card: Card & { data: MCQData }
  qaMode?: boolean
  hideAnswers?: boolean
  hideSolutions?: boolean
  onZoom: (src: string) => void
}
function MCQGlossaryItem({ index, card, qaMode = false, hideAnswers, hideSolutions, onZoom }: MCQGlossaryItemProps) {
  const { question, choices, answer, imagePath, choicesPlainText, explanation, solutionImagePath } = card.data
  const hasSolution = !hideSolutions && ((explanation && explanation.trim().length > 0) || !!solutionImagePath)
  if (qaMode) {
    return (
      <div style={{
        marginBottom: '14px',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        borderBottom: '1px solid var(--pt-border-light)',
        paddingBottom: '10px',
        display: 'block',
      }}>
        <div style={{ display: 'flex', gap: '4px', fontWeight: 400, color: 'var(--pt-text-primary)', marginBottom: '4px' }}>
          <span style={{ flexShrink: 0 }}>{index}.</span>
          <span><MathText text={question} /></span>
        </div>
        {imagePath && (
          <ClickableImg
            src={`ece-app://${imagePath}`}
            alt="Question diagram"
            onZoom={onZoom}
            style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '6px', marginLeft: '16px', borderRadius: '4px', border: '1px solid var(--pt-border-light)', display: 'block' }}
          />
        )}
        {!hideAnswers && <p style={{ fontWeight: 700, color: 'var(--pt-text-body)', margin: 0, paddingLeft: '16px' }}>
          <MathText text={choices[answer] ?? '—'} plainText={choicesPlainText?.[answer]} />
        </p>}
        {hideAnswers && <p style={{ color: 'var(--pt-text-muted)', margin: 0, paddingLeft: '16px' }}>—</p>}
        {/* Solution block (QA mode) */}
        {hasSolution && (
          <div style={{ marginTop: '8px', paddingTop: '6px', paddingLeft: '16px', borderTop: '1px dashed var(--pt-border-light)' }}>
            <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--pt-text-primary)', display: 'block', marginBottom: '4px' }}>SOLUTION:</span>
            {solutionImagePath && (
              <ClickableImg
                src={`ece-app://${solutionImagePath}`}
                alt="Solution diagram"
                onZoom={onZoom}
                style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', marginBottom: '6px', borderRadius: '4px', border: '1px solid var(--pt-border-light)', display: 'block' }}
              />
            )}
            {explanation && explanation.trim().length > 0 && (
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--pt-text-body)', lineHeight: 1.6 }}>
                <MathText text={explanation} />
              </p>
            )}
          </div>
        )}
      </div>
    )
  }
  return (
    <div style={{
      marginBottom: '16px',
      pageBreakInside: 'avoid',
      breakInside: 'avoid',
      display: 'block',
    }}>
      <div style={{ display: 'flex', gap: '4px', fontWeight: 600, color: 'var(--pt-text-primary)', marginBottom: '6px' }}>
        <span style={{ flexShrink: 0 }}>{index}.</span>
        <span><MathText text={question} /></span>
      </div>
      {imagePath && (
        <ClickableImg
          src={`ece-app://${imagePath}`}
          alt="Question diagram"
          onZoom={onZoom}
          style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '6px', borderRadius: '4px', border: '1px solid var(--pt-border-light)', display: 'block' }}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: '2px 8px', marginTop: '12px' }}>
        {[0, 1, 2, 3].map((ci) => {
          const choice = choices[ci]
          if (choice === undefined) return null
          return (
            <div
              key={ci}
              style={{
                padding: '4px 8px',
                backgroundColor: (!hideAnswers && ci === answer) ? 'var(--pt-answer-bg)' : 'transparent',
                color: (!hideAnswers && ci === answer) ? 'var(--pt-answer-text)' : 'var(--pt-text-body)',
                fontWeight: (!hideAnswers && ci === answer) ? 700 : 400,
                borderRadius: '3px',
                display: 'flex',
                gap: '6px',
                gridColumn: ci < 2 ? 1 : 2,
                gridRow: ci % 2 === 0 ? 1 : 2,
                alignSelf: 'start',
                justifySelf: 'start',
              }}
            >
              <span style={{ minWidth: '18px', fontWeight: 700 }}>{CHOICE_LABELS[ci]}.</span>
              <span><MathText text={choice} plainText={choicesPlainText?.[ci]} /></span>
            </div>
          )
        })}
      </div>
      {/* Solution block (glossary mode) */}
      {hasSolution && (
        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--pt-border-light)' }}>
          <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--pt-text-primary)', display: 'block', marginBottom: '4px' }}>SOLUTION:</span>
          {solutionImagePath && (
            <ClickableImg
              src={`ece-app://${solutionImagePath}`}
              alt="Solution diagram"
              onZoom={onZoom}
              style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', marginBottom: '6px', borderRadius: '4px', border: '1px solid var(--pt-border-light)', display: 'block' }}
            />
          )}
          {explanation && explanation.trim().length > 0 && (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--pt-text-body)', lineHeight: 1.6 }}>
              <MathText text={explanation} />
            </p>
          )}
        </div>
      )}
    </div>
  )
}

interface FormulaItemProps {
  index: number
  card: Card & { data: FormulaData }
  onZoom: (src: string) => void
}
function FormulaItem({ index, card, onZoom }: FormulaItemProps) {
  const { name, latex, variables, imagePath } = card.data
  const vars = variables as unknown
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', pageBreakInside: 'avoid', borderBottom: '1px solid var(--pt-border-light)', paddingBottom: '12px' }}>
      <div style={{ width: '35%', minWidth: '120px' }}>
        <p style={{ fontWeight: 700, color: 'var(--pt-text-primary)', margin: 0 }}>
          {index}. <MathText text={name} />
        </p>
        {/* variables below name if present */}
        {vars ? (
          <div style={{ fontSize: '12px', color: 'var(--pt-text-secondary)', lineHeight: 1.8, marginTop: '4px' }}>
            {typeof vars === 'string' ? (
              vars.split('\n').map((line, idx) => (
                <span key={idx} style={{ display: 'block', marginBottom: '2px' }}>
                  <MathText text={line} />
                </span>
              ))
            ) : typeof vars === 'object' && vars !== null && Object.keys(vars as Record<string, string>).length > 0 ? (
              Object.entries(vars as Record<string, string>).map(([k, v]) => (
                <span key={k} style={{ display: 'inline-block', marginRight: '16px' }}>
                  <strong><MathText text={k} /></strong>: <MathText text={String(v)} />
                </span>
              ))
            ) : null}
          </div>
        ) : null}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {latex ? (
          <div
            style={{ fontFamily: 'monospace', backgroundColor: 'var(--pt-formula-bg)', padding: '6px 8px', borderRadius: '4px', color: 'var(--pt-formula-text)', marginBottom: '0px', overflowX: 'auto', textAlign: 'center' }}
            dangerouslySetInnerHTML={{ __html: renderMath(card.data.backIsPlainText ? latex : `$$${latex}$$`) }}
          />
        ) : null}
        {imagePath && (
          <ClickableImg
            src={`ece-app://${imagePath}`}
            alt="Formula diagram"
            onZoom={onZoom}
            style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PrintView() {

  const controls = window.electron.windowControls
  const [searchParams] = useSearchParams()

  const topicId = searchParams.get('id') ?? searchParams.get('topicId') ?? ''
  const title = decodeURIComponent(searchParams.get('title') ?? 'Test Paper')

  // pdf config injected by main process via executeJavaScript BEFORE React mounts.
  // We gate rendering until config is present in pdf mode.
  const [pdfConfig, setPdfConfig] = useState<{ pdfmode: string; theme: string; layout: string } | null>(
    () => (window as any).__pdfConfig ?? null
  )
  const isPdfMode = pdfConfig?.pdfmode === '1' || (window as any).__pdfConfig?.pdfmode === '1'

  useEffect(() => {
    if ((window as any).__pdfConfig) {
      setPdfConfig((window as any).__pdfConfig)
      return
    }
    const handler = () => {
      setPdfConfig((window as any).__pdfConfig ?? null)
    }
    window.addEventListener('pdf-config-ready', handler)
    return () => window.removeEventListener('pdf-config-ready', handler)
  }, [])

  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [layout, setLayout] = useState<LayoutMode>('glossary')
  const [boldSide, setBoldSide] = useState<BoldSide>('term')
  const [exportState, setExportState] = useState<ExportState>('idle')
  const [exportError, setExportError] = useState('')
  const [scale, setScale] = useState(1)
  const [theme, setTheme] = useState<PrintTheme>('light')
  const [showAnswers, setShowAnswers] = useState(true)
  const [showSolutions, setShowSolutions] = useState(true)
  const [topicDescription, setTopicDescription] = useState<string>('')

  // ── Find-in-document state ──────────────────────────────────────────────────
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findIndex, setFindIndex] = useState(0)   // 0-based index of current match
  const [findTotal, setFindTotal] = useState(0)
  const findInputRef = useRef<HTMLInputElement>(null)
  const paperAreaRef = useRef<HTMLDivElement>(null)
  // Keep the list of highlight <mark> elements so we can clear them
  const findMarkEls = useRef<HTMLElement[]>([])

  // ── Image lightbox state ─────────────────────────────────────────────────────
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  // Sync theme+layout from pdfConfig once it arrives
  useEffect(() => {
    if (!pdfConfig) return
    setTheme((pdfConfig.theme ?? 'light') as PrintTheme)
    setLayout((pdfConfig.layout ?? 'table') as LayoutMode)
  }, [pdfConfig])

  const MIN_SCALE = 0.5
  const MAX_SCALE = 2.0
  const SCALE_STEP = 0.1

  // Ref for cleanup on unmount
  const zoomCleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => () => { zoomCleanupRef.current?.() }, [])

  // ── Find helpers ─────────────────────────────────────────────────────────────

  /** Remove all highlight marks previously inserted by find. */
  const clearFindHighlights = useCallback(() => {
    for (const mark of findMarkEls.current) {
      const parent = mark.parentNode
      if (!parent) continue
      // Replace the <mark> with its text-node child
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
      parent.removeChild(mark)
      // Merge adjacent text nodes
      parent.normalize()
    }
    findMarkEls.current = []
  }, [])

  /** Walk text nodes inside el and wrap every occurrence of `query` with <mark>. */
  const applyFindHighlights = useCallback((el: HTMLElement, query: string): HTMLElement[] => {
    if (!query) return []
    const lq = query.toLowerCase()
    const marks: HTMLElement[] = []

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
    const textNodes: Text[] = []
    let node: Node | null
    while ((node = walker.nextNode())) textNodes.push(node as Text)

    for (const tn of textNodes) {
      const text = tn.nodeValue ?? ''
      const lt = text.toLowerCase()
      let lastIdx = 0
      const fragments: Node[] = []
      let idx: number
      let found = false

      while ((idx = lt.indexOf(lq, lastIdx)) !== -1) {
        found = true
        if (idx > lastIdx) {
          fragments.push(document.createTextNode(text.slice(lastIdx, idx)))
        }
        const mark = document.createElement('mark')
        mark.dataset.findMark = '1'
        mark.style.cssText = [
          'background: rgba(255,200,0,0.55)',
          'color: inherit',
          'border-radius: 2px',
          'outline: none',
          'padding: 0 1px',
        ].join(';')
        mark.appendChild(document.createTextNode(text.slice(idx, idx + lq.length)))
        fragments.push(mark)
        marks.push(mark)
        lastIdx = idx + lq.length
      }

      if (found) {
        if (lastIdx < text.length) fragments.push(document.createTextNode(text.slice(lastIdx)))
        const parent = tn.parentNode!
        for (const f of fragments) parent.insertBefore(f, tn)
        parent.removeChild(tn)
      }
    }
    return marks
  }, [])

  /** Highlight active match differently and scroll it into view. */
  const activateFindMatch = useCallback((marks: HTMLElement[], index: number) => {
    marks.forEach((m, i) => {
      if (i === index) {
        m.style.background = 'rgba(255,140,0,0.85)'
        m.style.outline = '2px solid rgba(255,140,0,1)'
        m.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        m.style.background = 'rgba(255,200,0,0.55)'
        m.style.outline = 'none'
      }
    })
  }, [])

  /** Run a full find pass: clear old marks, apply new ones, activate current. */
  const runFind = useCallback((query: string, indexOverride?: number) => {
    clearFindHighlights()
    if (!paperAreaRef.current || !query.trim()) {
      setFindTotal(0)
      setFindIndex(0)
      return
    }
    const marks = applyFindHighlights(paperAreaRef.current, query.trim())
    findMarkEls.current = marks
    setFindTotal(marks.length)
    if (marks.length === 0) { setFindIndex(0); return }
    const active = indexOverride !== undefined
      ? Math.max(0, Math.min(indexOverride, marks.length - 1))
      : 0
    setFindIndex(active)
    activateFindMatch(marks, active)
  }, [clearFindHighlights, applyFindHighlights, activateFindMatch])

  const navigateFind = useCallback((dir: 1 | -1) => {
    if (findMarkEls.current.length === 0) return
    setFindIndex(prev => {
      const next = (prev + dir + findMarkEls.current.length) % findMarkEls.current.length
      activateFindMatch(findMarkEls.current, next)
      return next
    })
  }, [activateFindMatch])

  const openFind = useCallback(() => {
    setFindOpen(true)
    setTimeout(() => findInputRef.current?.focus(), 50)
  }, [])

  const closeFind = useCallback(() => {
    setFindOpen(false)
    clearFindHighlights()
    setFindQuery('')
    setFindTotal(0)
    setFindIndex(0)
  }, [clearFindHighlights])

  // Keyboard shortcut: Ctrl+F / Cmd+F → open find; Escape → close lightbox or find bar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        if (findOpen) {
          findInputRef.current?.focus()
          findInputRef.current?.select()
        } else {
          openFind()
        }
      }
      if (e.key === 'Escape') {
        if (zoomedImage) {
          setZoomedImage(null)
        } else if (findOpen) {
          closeFind()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [findOpen, zoomedImage, openFind, closeFind])

  // Re-run find when cards are re-rendered (layout/theme changes clear the DOM)
  const findQueryRef = useRef(findQuery)
  findQueryRef.current = findQuery
  useEffect(() => {
    if (findOpen && findQueryRef.current) {
      // Defer slightly so React finishes rendering the paper content
      const tid = setTimeout(() => runFind(findQueryRef.current), 80)
      return () => clearTimeout(tid)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, theme, showAnswers, showSolutions, boldSide, cards])

  // Right-click + wheel zoom (Sumatra PDF style)
  // useCallback ref: fires the instant the DOM node exists, bypasses early-return null problem
  const rightMouseDown = useRef(false)
  const scrollAreaRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return

    let didZoom = false

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        rightMouseDown.current = true
        didZoom = false
      }
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) rightMouseDown.current = false
    }
    const onContextMenu = (e: MouseEvent) => {
      if (didZoom) {
        e.preventDefault()
        didZoom = false
      }
    }
    const onWheel = (e: WheelEvent) => {
      const isCtrl = e.ctrlKey
      const isRightHeld = rightMouseDown.current
      if (!isCtrl && !isRightHeld) return

      e.preventDefault()
      e.stopPropagation()

      const delta = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP
      setScale(prev => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((prev + delta) * 10) / 10)))
      if (isRightHeld) didZoom = true
    }

    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('mouseup', onMouseUp)
    el.addEventListener('contextmenu', onContextMenu)
    el.addEventListener('wheel', onWheel, { passive: false })

    zoomCleanupRef.current = () => {
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    const initialScale = () => {
      const availableWidth = window.innerWidth
      if (availableWidth < 800) setScale(availableWidth / 800)
      else setScale(1)
    }
    initialScale()
    window.addEventListener('resize', initialScale)
    return () => window.removeEventListener('resize', initialScale)
  }, [])

  useEffect(() => {
    if (!topicId) { setLoading(false); return }
    dbService.getAllCardsByTopic(topicId).then((result) => {
      setCards(result)
      setLoading(false)
    })

    // Fetch description if any
    window.electron.decks.getTopics().then((res) => {
      if (res.success && res.data) {
        const topic = res.data.find((t: any) => t.id === topicId)
        if (topic?.description) {
          setTopicDescription(topic.description)
        }
      }
    }).catch(console.error)
  }, [topicId])

  // Signal to print.ipc.ts that the PDF render is complete.
  // Fires only in PDF mode, after cards have loaded and React has committed the DOM.
  useEffect(() => {
    if (!isPdfMode || loading) return
    document.fonts.ready.then(() => {
      setTimeout(() => {
        ; (window as any).__pdfReady = true
        window.dispatchEvent(new Event('pdf-ready'))
      }, 500)
    })
  }, [isPdfMode, loading])



  const handleExportPDF = async () => {
    setExportState('loading')
    setExportError('')
    try {
      const result = await window.electron.print.toPDF(title, PRINT_THEMES[theme].vars, topicId, title, theme, layout)
      if (result.canceled) {
        setExportState('idle')
      } else if (result.success) {
        setExportState('success')
        setTimeout(() => setExportState('idle'), 2500)
      } else {
        setExportError(result.error ?? 'Unknown error')
        setExportState('error')
      }
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Unexpected error')
      setExportState('error')
    }
  }

  const mcqCards = cards.filter(isMCQ)
  const flashcardCards = cards.filter(isFlashcard)
  const formulaCards = cards.filter(isFormula)

  const isFlashcardOnly = flashcardCards.length > 0 && mcqCards.length === 0
  const hasFormulas = formulaCards.length > 0

  useEffect(() => {
    if (isFlashcardOnly && layout === 'qa') {
      setLayout('glossary')
    }
  }, [isFlashcardOnly, layout])

  useEffect(() => {
    if (hasFormulas && (layout === 'glossary' || layout === 'qa')) {
      setLayout('table')
    }
  }, [hasFormulas, layout])



  // -------------------------------------------------------------------------
  // Titlebar (custom centered, matching main window, not printed)
  // -------------------------------------------------------------------------
  const titleBar = (
    <div className="print:hidden w-full h-8 bg-surface text-gray-400 flex items-center justify-between select-none [-webkit-app-region:drag] relative shrink-0 px-0">
      {/* Left side spacer to balance the right controls or put logo */}
      <div className="flex items-center [-webkit-app-region:no-drag] pl-3">
        <img
          src="/ecengine_icon.png"
          alt="Logo"
          className="w-4 h-4 object-contain"
          onError={(e) => {
            const img = e.currentTarget
            if (!img.src.includes('resources')) {
              img.src = 'resources/ecengine_icon.png'
            }
          }}
        />
      </div>

      {/* Centered Title */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
        <span className="font-rajdhani font-bold tracking-wider text-white text-xs whitespace-nowrap">
          <span className="text-accent">TEST PAPER VIEW</span> — {title}
          <span className="text-gray-500 font-normal"> · {cards.length} cards</span>
        </span>
      </div>

      {/* Right Side: Window Controls */}
      {controls && (
        <div className="flex h-full ml-auto [-webkit-app-region:no-drag]">
          <button
            onClick={() => controls?.minimize()}
            className="px-3 h-full hover:bg-[#333] hover:text-white transition-colors flex items-center justify-center"
            title="Minimize"
          >
            <Minus size={12} />
          </button>
          <button
            onClick={() => controls?.maximize()}
            className="px-3 h-full hover:bg-[#333] hover:text-white transition-colors flex items-center justify-center"
            title="Maximize"
          >
            <Square size={10} />
          </button>
          <button
            onClick={() => controls?.close()}
            className="px-3 h-full hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )

  // -------------------------------------------------------------------------
  // Toolbar (not printed)
  // -------------------------------------------------------------------------
  const toolbar = (
    <div
      className="print:hidden w-full flex items-center px-4 py-2 gap-2"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--bg-card)',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        justifyContent: 'center',
      }}
    >
      {/* Layout toggle — icon-only with tooltips */}
      <div
        className="flex-shrink-0"
        style={{
          display: 'flex',
          gap: '2px',
          background: 'var(--bg-card)',
          padding: '3px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--bg-elevated)',
        }}
      >
        {([['glossary', List, 'Glossary'], ['table', Table2, 'Table'], ['qa', BookOpen, 'Q&A']] as const).map(
          ([mode, Icon, label]) => {
            const isDisabled = (mode === 'qa' && isFlashcardOnly) || (hasFormulas && (mode === 'glossary' || mode === 'qa'))
            if (mode === 'qa' && isFlashcardOnly) return null
            return (
              <Tooltip key={mode} content={label} position="bottom">
                <motion.button
                  id={`print-layout-${mode}`}
                  disabled={isDisabled}
                  onClick={() => { if (!isDisabled) setLayout(mode) }}
                  whileTap={{ scale: isDisabled ? 1 : 0.95 }}
                  style={{
                    width: '28px', height: '28px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                    background: layout === mode ? 'var(--accent-primary)' : 'transparent',
                    color: isDisabled ? 'var(--text-secondary)' : (layout === mode ? '#000' : 'var(--text-secondary)'),
                    opacity: isDisabled ? 0.35 : 1,
                  }}
                >
                  <Icon size={14} />
                </motion.button>
              </Tooltip>
            )
          }
        )}
      </div>

      {/* Bold side toggle — icon-only with tooltips */}
      {flashcardCards.length > 0 && layout !== 'qa' && (
        <div
          className="flex-shrink-0"
          style={{
            display: 'flex',
            gap: '2px',
            background: 'var(--bg-card)',
            padding: '3px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--bg-elevated)',
          }}
        >
          {([['term', 'Bold Term'], ['definition', 'Bold Def']] as const).map(
            ([side, label]) => (
              <Tooltip key={side} content={label} position="bottom">
                <motion.button
                  onClick={() => setBoldSide(side)}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    width: '28px', height: '28px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: boldSide === side ? 'var(--accent-primary)' : 'transparent',
                    color: boldSide === side ? '#000' : 'var(--text-secondary)',
                  }}
                >
                  <Bold size={13} />
                  {side === 'term'
                    ? <span style={{ fontSize: '9px', fontWeight: 900, lineHeight: 1, marginLeft: '-1px' }}>T</span>
                    : <span style={{ fontSize: '9px', fontWeight: 900, lineHeight: 1, marginLeft: '-1px' }}>D</span>
                  }
                </motion.button>
              </Tooltip>
            )
          )}
        </div>
      )}

      {/* Theme picker */}
      <div
        className="flex-shrink-0"
        style={{
          display: 'flex',
          gap: '2px',
          background: 'var(--bg-card)',
          padding: '3px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--bg-elevated)',
        }}
      >
        {(Object.keys(PRINT_THEMES) as PrintTheme[]).map((t) => (
          <motion.button
            key={t}
            onClick={() => setTheme(t)}
            whileTap={{ scale: 0.95 }}
            className="whitespace-nowrap flex-shrink-0 text-[10px] px-[8px] py-[5px]"
            style={{
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              transition: 'all 0.15s',
              background: theme === t ? 'var(--accent-primary)' : 'transparent',
              color: theme === t ? '#000' : 'var(--text-secondary)',
            }}
          >
            {PRINT_THEMES[t].label}
          </motion.button>
        ))}
      </div>

      {/* ANS / SOL'N checkbox group — only for MCQ decks */}
      {mcqCards.length > 0 && (
        <div
          className="flex-shrink-0"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-card)',
            padding: '4px 8px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--bg-elevated)',
            height: '34px',
          }}
        >
          {/* ANS checkbox */}
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              fontWeight: 700,
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: showAnswers ? 'var(--accent-primary)' : 'var(--text-secondary)',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={showAnswers}
              onChange={() => setShowAnswers(h => !h)}
              style={{
                accentColor: 'var(--accent-primary)',
                width: '12px', height: '12px',
                cursor: 'pointer',
              }}
            />
            ANS
          </label>

          {/* SOL'N checkbox */}
          {mcqCards.some(c => (c.data.explanation && c.data.explanation.trim().length > 0) || !!c.data.solutionImagePath) && (
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                fontWeight: 700,
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: showSolutions ? 'var(--accent-primary)' : 'var(--text-secondary)',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={showSolutions}
                onChange={() => setShowSolutions(h => !h)}
                style={{
                  accentColor: 'var(--accent-primary)',
                  width: '12px', height: '12px',
                  cursor: 'pointer',
                }}
              />
              SOL'N
            </label>
          )}
        </div>
      )}

      {/* Zoom controls */}
      <div
        className="flex-shrink-0"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          background: 'var(--bg-card)',
          padding: '3px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--bg-elevated)',
        }}
      >
        <motion.button
          onClick={() => setScale(s => Math.max(MIN_SCALE, Math.round((s - SCALE_STEP) * 10) / 10))}
          whileTap={{ scale: 0.9 }}
          title="Zoom Out"
          style={{
            width: '24px', height: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            border: 'none', cursor: 'pointer',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '16px', fontWeight: 700,
            transition: 'all 0.15s',
          }}
        >−</motion.button>
        <span
          onClick={() => setScale(1)}
          title="Reset zoom"
          style={{
            fontSize: '11px', fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            minWidth: '30px', textAlign: 'center',
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          {Math.round(scale * 100)}%
        </span>
        <motion.button
          onClick={() => setScale(s => Math.min(MAX_SCALE, Math.round((s + SCALE_STEP) * 10) / 10))}
          whileTap={{ scale: 0.9 }}
          title="Zoom In"
          style={{
            width: '24px', height: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            border: 'none', cursor: 'pointer',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '16px', fontWeight: 700,
            transition: 'all 0.15s',
          }}
        >+</motion.button>
      </div>

      {/* Find / Search button */}
      <Tooltip content="Find in document (Ctrl+F)" position="bottom">
        <motion.button
          onClick={() => findOpen ? closeFind() : openFind()}
          whileTap={{ scale: 0.9 }}
          style={{
            width: '32px', height: '32px',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--bg-elevated)',
            cursor: 'pointer',
            background: findOpen ? 'var(--accent-primary)' : 'var(--bg-card)',
            color: findOpen ? '#000' : 'var(--text-secondary)',
            transition: 'all 0.15s',
          }}
        >
          <Search size={14} />
        </motion.button>
      </Tooltip>

      {/* Export PDF button */}
      <motion.button
        id="print-export-pdf"
        onClick={handleExportPDF}
        disabled={exportState === 'loading'}
        whileTap={{ scale: 0.96 }}
        className="whitespace-nowrap flex-shrink-0 text-[12px] px-[16px] py-[7px]"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: exportState === 'success' ? 'var(--color-correct)' : 'var(--accent-primary)',
          color: '#000',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          cursor: exportState === 'loading' ? 'not-allowed' : 'pointer',
          opacity: exportState === 'loading' ? 0.7 : 1,
          transition: 'all 0.15s',
        }}
      >
        {exportState === 'loading' ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Generating…
          </>
        ) : exportState === 'success' ? (
          <>
            <CheckCircle2 size={14} />
            Saved!
          </>
        ) : (
          <>
            <FileText size={14} />
            Export PDF
          </>
        )}
      </motion.button>

      {/* Error message */}
      {exportState === 'error' && exportError && (
        <motion.span
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: 'var(--color-wrong)',
            fontFamily: 'var(--font-body)',
            flexShrink: 0,
          }}
        >
          <AlertCircle size={13} />
          {exportError}
        </motion.span>
      )}
    </div>
  )

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div style={{ background: '#0D0D0D', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Paper content
  // -------------------------------------------------------------------------
  const paperContent = (
    <div
      style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        color: 'var(--pt-text-primary)',
        maxWidth: isPdfMode ? 'none' : '800px',
        margin: isPdfMode ? '0' : '0 auto',
        padding: isPdfMode ? '0' : '0',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ textAlign: 'center', fontSize: '24px', fontWeight: 700, color: 'var(--pt-text-primary)', margin: topicDescription ? '0 0 6px 0' : '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </h1>
        {topicDescription && (
          <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--pt-text-secondary)', margin: '0 0 12px 0', fontStyle: 'italic', maxWidth: '80%', marginInline: 'auto' }}>
            {topicDescription}
          </p>
        )}
        <hr style={{ border: 'none', borderTop: '2px solid var(--pt-rule)', margin: '0' }} />
      </div>

      {/* MCQ Section */}
      {mcqCards.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          {cards.some(c => !isMCQ(c)) && (
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--pt-text-body)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', borderBottom: '1px solid var(--pt-border-light)', paddingBottom: '4px' }}>
              Multiple Choice
            </h2>
          )}
          {layout === 'table' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--pt-border)', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--pt-border)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--pt-text-body)', width: '65%', backgroundColor: 'var(--pt-thead-bg)' }}>Question &amp; Choices</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--pt-text-body)', borderLeft: '1px solid var(--pt-border)', width: '35%', backgroundColor: 'var(--pt-thead-bg)' }}>Answer</th>
                </tr>
              </thead>
              <tbody style={{ display: 'table-row-group' }}>
                {mcqCards.map((card, i) => (
                  <MCQTableRow key={card.id} index={i + 1} card={card} hideAnswers={!showAnswers} hideSolutions={!showSolutions} onZoom={setZoomedImage} />
                ))}
              </tbody>
            </table>
          ) : (
            <div>
              {mcqCards.map((card, i) => (
                <MCQGlossaryItem key={card.id} index={i + 1} card={card} qaMode={layout === 'qa'} hideAnswers={!showAnswers} hideSolutions={!showSolutions} onZoom={setZoomedImage} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Flashcard Section */}
      {flashcardCards.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          {cards.some(c => !isFlashcard(c)) && (
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--pt-text-body)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', borderBottom: '1px solid var(--pt-border-light)', paddingBottom: '4px' }}>
              Flashcards
            </h2>
          )}
          {layout === 'table' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--pt-border)', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--pt-border)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--pt-text-body)', width: '50%', backgroundColor: 'var(--pt-thead-bg)' }}>TERM</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--pt-text-body)', borderLeft: '1px solid var(--pt-border)', width: '50%', backgroundColor: 'var(--pt-thead-bg)' }}>DEFINITION</th>
                </tr>
              </thead>
              <tbody>
                {flashcardCards.map((card) => {
                  const { front, back, imageFront, imageBack, imagePath } = card.data
                  return (
                    <tr key={card.id} style={{ borderBottom: '1px solid var(--pt-border)', pageBreakInside: 'avoid' }}>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top', width: '50%', overflow: 'hidden' }}>
                        {imageFront && (
                          <ClickableImg
                            src={`ece-app://${imageFront}`}
                            alt="Front diagram"
                            onZoom={setZoomedImage}
                            style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
                          />
                        )}
                        {imagePath && (
                          <ClickableImg
                            src={`ece-app://${imagePath}`}
                            alt="Flashcard diagram"
                            onZoom={setZoomedImage}
                            style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
                          />
                        )}
                        <p style={{ color: 'var(--pt-text-primary)', margin: 0, fontWeight: boldSide === 'term' ? 700 : 400 }}><MathText text={front} /></p>
                      </td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top', width: '50%', borderLeft: '1px solid var(--pt-border)', overflow: 'hidden' }}>
                        {imageBack && (
                          <ClickableImg
                            src={`ece-app://${imageBack}`}
                            alt="Back diagram"
                            onZoom={setZoomedImage}
                            style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
                          />
                        )}
                        <p style={{ color: 'var(--pt-text-body)', margin: 0, fontWeight: boldSide === 'definition' ? 700 : 400 }}><MathText text={back} /></p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div>
              {flashcardCards.map((card) => {
                const { front, back, imageFront, imageBack, imagePath } = card.data
                return (
                  <div key={card.id} style={{ marginBottom: '16px', pageBreakInside: 'avoid' }}>
                    <p style={{ fontWeight: boldSide === 'term' ? 700 : 400, color: 'var(--pt-text-primary)', marginBottom: '4px' }}>
                      <MathText text={front} />
                    </p>
                    {imageFront && (
                      <ClickableImg
                        src={`ece-app://${imageFront}`}
                        alt="Front diagram"
                        onZoom={setZoomedImage}
                        style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginLeft: '20px', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
                      />
                    )}
                    {imagePath && (
                      <ClickableImg
                        src={`ece-app://${imagePath}`}
                        alt="Flashcard diagram"
                        onZoom={setZoomedImage}
                        style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginLeft: '20px', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
                      />
                    )}
                    <div style={{ paddingLeft: '20px', color: 'var(--pt-text-body)' }}>
                      {imageBack && (
                        <ClickableImg
                          src={`ece-app://${imageBack}`}
                          alt="Back diagram"
                          onZoom={setZoomedImage}
                          style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
                        />
                      )}
                      <p style={{ margin: 0, fontWeight: boldSide === 'definition' ? 700 : 400 }}><MathText text={back} /></p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Formula Section */}
      {formulaCards.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--pt-text-body)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', borderBottom: '1px solid var(--pt-border-light)', paddingBottom: '4px' }}>
            Formulas
          </h2>
          {formulaCards.map((card, i) => (
            <FormulaItem key={card.id} index={i + 1} card={card} onZoom={setZoomedImage} />
          ))}
        </section>
      )}

      {cards.length === 0 && (
        <p style={{ color: 'var(--pt-text-muted)', textAlign: 'center', padding: '48px 0' }}>No cards found for this deck.</p>
      )}
    </div>
  )

  // -------------------------------------------------------------------------
  // Render — full-screen white layout (no AppShell chrome)
  // -------------------------------------------------------------------------

  // PDF mode: render bare paper content with no shell, no height constraints
  if (isPdfMode) {
    const currentThemeVars = PRINT_THEMES[theme].vars
    const paperBg = currentThemeVars['--pt-bg-paper']
    return (
      <>
        <style>{`
          @page {
            size: A4 portrait;
            margin: 0;
          }
          *, *::before, *::after { box-sizing: border-box; }
          html, body, #root {
            margin: 0 !important;
            padding: 0 !important;
            background: ${paperBg} !important;
            height: auto !important;
            overflow: visible !important;
            width: 794px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        `}</style>
        <div
          id="pdf-paper-content"
          style={{
            ...currentThemeVars,
            background: paperBg,
            color: currentThemeVars['--pt-text-primary'],
            fontFamily: 'Georgia, "Times New Roman", serif',
            minHeight: 'unset',
            height: 'auto',
            width: '794px',
            boxSizing: 'border-box',
            margin: 0,
            padding: 0,
          } as React.CSSProperties}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', borderSpacing: 0 }}>
            <thead style={{ height: '36px' }}>
              <tr>
                <td><div style={{ height: '36px' }}></div></td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '0 48px' }}>
                  {paperContent}
                </td>
              </tr>
            </tbody>
            <tfoot style={{ height: '36px' }}>
              <tr>
                <td><div style={{ height: '36px' }}></div></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </>
    )
  }

  return (
    <div className={`h-screen w-full flex flex-col overflow-hidden bg-engine-black print:bg-white ${isFullscreen ? '' : 'rounded-xl border border-[#333]'}`}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }

        /* theme vars are applied inline via JS — no static override needed */

        @media print {
          /* Remove browser-added URL, date, and page number headers/footers */
          @page {
            margin: 1cm 1.5cm;
            size: A4 portrait;
          }

          /* Hide all UI chrome */
          .print\\:hidden { display: none !important; }

          /* Hide the dark outer shell, show only white paper area */
          body > * { visibility: hidden; }
          #print-paper-area,
          #print-paper-area * { visibility: visible; }

          /* Position paper area to fill the page */
          #print-paper-area {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Ensure page breaks work correctly */
          table { border-collapse: collapse; width: 100%; }
          tr { page-break-inside: avoid; }
          .page-break-inside-avoid { page-break-inside: avoid; }
        }
      `}</style>
      {titleBar}
      {toolbar}

      {/* ── Find bar (Ctrl+F) ── */}
      {findOpen && (
        <div
          className="print:hidden"
          style={{
            position: 'absolute',
            top: '68px',   /* below titlebar (32px) + toolbar (~36px) */
            right: '16px',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 10px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Search size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <input
            ref={findInputRef}
            value={findQuery}
            onChange={(e) => {
              const q = e.target.value
              setFindQuery(q)
              runFind(q)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                navigateFind(e.shiftKey ? -1 : 1)
              }
              if (e.key === 'Escape') closeFind()
            }}
            placeholder="Find in document…"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              width: '200px',
            }}
          />
          {/* Match counter */}
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-ui)',
              color: findTotal === 0 && findQuery ? 'var(--color-wrong)' : 'var(--text-secondary)',
              minWidth: '50px',
              textAlign: 'right',
              flexShrink: 0,
            }}
          >
            {findQuery ? (findTotal === 0 ? 'No results' : `${findIndex + 1} / ${findTotal}`) : ''}
          </span>
          {/* Prev */}
          <button
            onClick={() => navigateFind(-1)}
            disabled={findTotal === 0}
            title="Previous match (Shift+Enter)"
            style={{
              background: 'transparent', border: 'none', cursor: findTotal > 0 ? 'pointer' : 'not-allowed',
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '2px',
              borderRadius: '4px', opacity: findTotal === 0 ? 0.4 : 1,
            }}
          >
            <ChevronUp size={15} />
          </button>
          {/* Next */}
          <button
            onClick={() => navigateFind(1)}
            disabled={findTotal === 0}
            title="Next match (Enter)"
            style={{
              background: 'transparent', border: 'none', cursor: findTotal > 0 ? 'pointer' : 'not-allowed',
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '2px',
              borderRadius: '4px', opacity: findTotal === 0 ? 0.4 : 1,
            }}
          >
            <ChevronDown size={15} />
          </button>
          {/* Close */}
          <button
            onClick={closeFind}
            title="Close (Esc)"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '2px',
              borderRadius: '4px',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto print-scrollbar" style={{ background: PRINT_THEMES[theme].vars['--pt-bg-outer'], padding: '40px 0' }}>
        <div className="w-full flex justify-center pb-12 overflow-x-auto">
          <div
            id="print-paper-area"
            ref={paperAreaRef}
            className="w-[800px] max-w-none"
            style={{
              ...PRINT_THEMES[theme].vars,
              maxWidth: '800px',
              margin: '0 auto',
              background: PRINT_THEMES[theme].vars['--pt-bg-paper'],
              padding: '60px 70px',
              boxShadow: '0 2px 16px rgba(0,0,0,0.13)',
              minHeight: '1100px',
              zoom: scale
            } as any}
          >
            {paperContent}
          </div>
        </div>
      </div>

      {/* Image lightbox */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 lg:p-10 cursor-zoom-out backdrop-blur-sm print:hidden"
            onClick={() => setZoomedImage(null)}
          >
            <button
              className="absolute top-6 right-6 text-text-muted hover:text-accent transition-colors p-2 bg-[#111] rounded-full border border-[#333] hover:border-accent"
              onClick={() => setZoomedImage(null)}
              title="Close"
            >
              <X size={24} />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={zoomedImage}
              alt="Zoomed diagram"
              className="max-w-[90vw] max-h-[90vh] object-contain shadow-2xl rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
