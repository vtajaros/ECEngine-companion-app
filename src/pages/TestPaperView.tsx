import React, { useState, useEffect, useMemo, useRef, memo } from 'react'
import {
  X,
  List,
  Table2,
  BookOpen,
  Bold,
  Loader2,
  ArrowUp,
} from 'lucide-react'
import { Card, MCQData, FlashcardData, FormulaData } from '../types'
import { renderMath, renderPlainText } from '../lib/latex'
import { resolveImageSrc } from '../services/image.service'
import { dbService } from '../services/db.service'
import { ImageLightbox } from '../components/ImageLightbox'
import { App as CapacitorApp } from '@capacitor/app'

// ─── Types & Themes ──────────────────────────────────────────────────────────

export type LayoutMode = 'table' | 'glossary' | 'qa'
export type BoldSide = 'term' | 'definition'
export type PrintTheme = 'light' | 'sepia' | 'dark'

interface ThemeDef {
  label: string
  vars: Record<string, string>
}

export const PRINT_THEMES: Record<PrintTheme, ThemeDef> = {
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
      '--pt-bg-outer': '#101216',
      '--pt-bg-paper': '#1a1d24',
      '--pt-text-primary': '#e8eaf0',
      '--pt-text-secondary': '#9099a8',
      '--pt-text-body': '#c8cdd6',
      '--pt-text-muted': '#5a6070',
      '--pt-border': '#363b45',
      '--pt-border-light': '#2e3340',
      '--pt-thead-bg': '#15171d',
      '--pt-answer-bg': 'rgba(0, 255, 65, 0.15)',
      '--pt-answer-text': '#00ff41',
      '--pt-formula-bg': '#15171d',
      '--pt-formula-text': '#7eb8f7',
      '--pt-rule': '#4a5060',
    },
  },
}

export interface TestPaperViewProps {
  cards?: Card[]
  topicId?: string
  title?: string
  onExit: () => void
}

const CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

// ─── Helpers & Type Guards ───────────────────────────────────────────────────

function isMCQ(card: Card): card is Card & { data: MCQData } {
  return card.type === 'mcq'
}
function isFlashcard(card: Card): card is Card & { data: FlashcardData } {
  return card.type === 'flashcard'
}
function isFormula(card: Card): card is Card & { data: FormulaData } {
  return card.type === 'formula'
}

function MathText({
  text,
  style,
  plainText,
  className,
}: {
  text: string
  style?: React.CSSProperties
  plainText?: boolean
  className?: string
}) {
  return (
    <span
      style={style}
      className={className}
      dangerouslySetInnerHTML={{ __html: plainText ? renderPlainText(text) : renderMath(text) }}
    />
  )
}

function PaperImage({
  imagePath,
  alt,
  style,
  className,
  onZoom,
}: {
  imagePath?: string
  alt: string
  style?: React.CSSProperties
  className?: string
  onZoom: (src: string) => void
}) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!imagePath) {
      return
    }
    resolveImageSrc(imagePath).then((resolved) => {
      if (active) setSrc(resolved)
    })
    return () => {
      active = false
    }
  }, [imagePath])

  if (!src) return null

  return (
    <img
      src={src}
      alt={alt}
      style={{ cursor: 'zoom-in', ...style }}
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        onZoom(src)
      }}
    />
  )
}

// ─── MCQ Sub-Renderers ───────────────────────────────────────────────────────

interface MCQTableRowProps {
  index: number
  card: Card & { data: MCQData }
  hideAnswers?: boolean
  hideSolutions?: boolean
  onZoom: (src: string) => void
}

const MCQTableRow = memo(function MCQTableRow({
  index,
  card,
  hideAnswers,
  hideSolutions,
  onZoom,
}: MCQTableRowProps) {
  const { question, choices, answer, explanation, solutionImagePath, imagePath, choicesPlainText } =
    card.data
  const hasSolution =
    !hideSolutions && ((explanation && explanation.trim().length > 0) || !!solutionImagePath)

  return (
    <tr style={{ borderBottom: '1px solid var(--pt-border)' }}>
      <td style={{ padding: '10px 12px', verticalAlign: 'top', width: '65%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ fontWeight: 700, color: 'var(--pt-text-primary)', flexShrink: 0, fontSize: '13px' }}>
            {index}.
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'var(--pt-text-primary)', margin: '0 0 8px 0', fontSize: '13px', lineHeight: 1.5 }}>
              <MathText text={question} />
            </p>

            {imagePath && (
              <PaperImage
                imagePath={imagePath}
                alt="Question diagram"
                onZoom={onZoom}
                style={{
                  maxWidth: '100%',
                  maxHeight: '200px',
                  objectFit: 'contain',
                  marginBottom: '8px',
                  borderRadius: '4px',
                  border: '1px solid var(--pt-border-light)',
                  display: 'block',
                }}
              />
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '4px 8px',
                fontSize: '12px',
              }}
            >
              {[0, 1, 2, 3].map((ci) => {
                const choice = choices[ci]
                if (choice === undefined) return null
                const isCorrectChoice = !hideAnswers && ci === answer
                return (
                  <div
                    key={ci}
                    style={{
                      padding: '3px 6px',
                      backgroundColor: isCorrectChoice ? 'var(--pt-answer-bg)' : 'transparent',
                      color: isCorrectChoice ? 'var(--pt-answer-text)' : 'var(--pt-text-body)',
                      fontWeight: isCorrectChoice ? 700 : 400,
                      borderRadius: '3px',
                      display: 'flex',
                      gap: '4px',
                      alignItems: 'baseline',
                    }}
                  >
                    <span style={{ minWidth: '16px', fontWeight: 700, flexShrink: 0 }}>
                      {CHOICE_LABELS[ci]}.
                    </span>
                    <span>
                      <MathText text={choice} plainText={choicesPlainText?.[ci]} />
                    </span>
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
        {!hideAnswers && (
          <span style={{ fontWeight: 700, color: 'var(--pt-text-primary)' }}>
            <MathText text={choices[answer] ?? '—'} plainText={choicesPlainText?.[answer]} />
          </span>
        )}
        {hideAnswers && <span style={{ color: 'var(--pt-text-muted)' }}>—</span>}

        {/* Solution block */}
        {hasSolution && (
          <div
            style={{
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px dashed var(--pt-border-light)',
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: '11px',
                color: 'var(--pt-text-primary)',
                display: 'block',
                marginBottom: '4px',
                letterSpacing: '0.05em',
              }}
            >
              SOLUTION:
            </span>
            {solutionImagePath && (
              <PaperImage
                imagePath={solutionImagePath}
                alt="Solution diagram"
                onZoom={onZoom}
                style={{
                  maxWidth: '100%',
                  maxHeight: '260px',
                  objectFit: 'contain',
                  marginBottom: '6px',
                  borderRadius: '4px',
                  border: '1px solid var(--pt-border-light)',
                  display: 'block',
                }}
              />
            )}
            {explanation && explanation.trim().length > 0 && (
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: 'var(--pt-text-body)',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                <MathText text={explanation} />
              </p>
            )}
          </div>
        )}
      </td>
    </tr>
  )
})

interface MCQGlossaryItemProps {
  index: number
  card: Card & { data: MCQData }
  qaMode?: boolean
  hideAnswers?: boolean
  hideSolutions?: boolean
  onZoom: (src: string) => void
}

const MCQGlossaryItem = memo(function MCQGlossaryItem({
  index,
  card,
  qaMode = false,
  hideAnswers,
  hideSolutions,
  onZoom,
}: MCQGlossaryItemProps) {
  const { question, choices, answer, imagePath, choicesPlainText, explanation, solutionImagePath } =
    card.data
  const hasSolution =
    !hideSolutions && ((explanation && explanation.trim().length > 0) || !!solutionImagePath)

  if (qaMode) {
    return (
      <div
        style={{
          marginBottom: '14px',
          borderBottom: '1px solid var(--pt-border-light)',
          paddingBottom: '10px',
          display: 'block',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '6px',
            fontWeight: 500,
            color: 'var(--pt-text-primary)',
            marginBottom: '4px',
            fontSize: '13px',
            lineHeight: 1.5,
          }}
        >
          <span style={{ flexShrink: 0, fontWeight: 700 }}>{index}.</span>
          <span>
            <MathText text={question} />
          </span>
        </div>

        {imagePath && (
          <PaperImage
            imagePath={imagePath}
            alt="Question diagram"
            onZoom={onZoom}
            style={{
              maxWidth: '100%',
              maxHeight: '200px',
              objectFit: 'contain',
              marginBottom: '6px',
              marginLeft: '16px',
              borderRadius: '4px',
              border: '1px solid var(--pt-border-light)',
              display: 'block',
            }}
          />
        )}

        {!hideAnswers && (
          <p
            style={{
              fontWeight: 700,
              color: 'var(--pt-text-body)',
              margin: 0,
              paddingLeft: '16px',
              fontSize: '13px',
            }}
          >
            <MathText text={choices[answer] ?? '—'} plainText={choicesPlainText?.[answer]} />
          </p>
        )}
        {hideAnswers && (
          <p style={{ color: 'var(--pt-text-muted)', margin: 0, paddingLeft: '16px', fontSize: '13px' }}>
            —
          </p>
        )}

        {hasSolution && (
          <div
            style={{
              marginTop: '8px',
              paddingTop: '6px',
              paddingLeft: '16px',
              borderTop: '1px dashed var(--pt-border-light)',
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: '11px',
                color: 'var(--pt-text-primary)',
                display: 'block',
                marginBottom: '4px',
                letterSpacing: '0.05em',
              }}
            >
              SOLUTION:
            </span>
            {solutionImagePath && (
              <PaperImage
                imagePath={solutionImagePath}
                alt="Solution diagram"
                onZoom={onZoom}
                style={{
                  maxWidth: '100%',
                  maxHeight: '260px',
                  objectFit: 'contain',
                  marginBottom: '6px',
                  borderRadius: '4px',
                  border: '1px solid var(--pt-border-light)',
                  display: 'block',
                }}
              />
            )}
            {explanation && explanation.trim().length > 0 && (
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: 'var(--pt-text-body)',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                <MathText text={explanation} />
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--pt-border-light)',
        display: 'block',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '6px',
          fontWeight: 600,
          color: 'var(--pt-text-primary)',
          marginBottom: '6px',
          fontSize: '13px',
          lineHeight: 1.5,
        }}
      >
        <span style={{ flexShrink: 0, fontWeight: 700 }}>{index}.</span>
        <span>
          <MathText text={question} />
        </span>
      </div>

      {imagePath && (
        <PaperImage
          imagePath={imagePath}
          alt="Question diagram"
          onZoom={onZoom}
          style={{
            maxWidth: '100%',
            maxHeight: '200px',
            objectFit: 'contain',
            marginBottom: '6px',
            marginLeft: '16px',
            borderRadius: '4px',
            border: '1px solid var(--pt-border-light)',
            display: 'block',
          }}
        />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '4px 8px',
          marginTop: '8px',
          paddingLeft: '16px',
          fontSize: '12px',
        }}
      >
        {[0, 1, 2, 3].map((ci) => {
          const choice = choices[ci]
          if (choice === undefined) return null
          const isCorrectChoice = !hideAnswers && ci === answer
          return (
            <div
              key={ci}
              style={{
                padding: '4px 8px',
                backgroundColor: isCorrectChoice ? 'var(--pt-answer-bg)' : 'transparent',
                color: isCorrectChoice ? 'var(--pt-answer-text)' : 'var(--pt-text-body)',
                fontWeight: isCorrectChoice ? 700 : 400,
                borderRadius: '3px',
                display: 'flex',
                gap: '6px',
                alignItems: 'baseline',
              }}
            >
              <span style={{ minWidth: '16px', fontWeight: 700, flexShrink: 0 }}>
                {CHOICE_LABELS[ci]}.
              </span>
              <span>
                <MathText text={choice} plainText={choicesPlainText?.[ci]} />
              </span>
            </div>
          )
        })}
      </div>

      {hasSolution && (
        <div
          style={{
            marginTop: '10px',
            paddingTop: '8px',
            paddingLeft: '16px',
            borderTop: '1px dashed var(--pt-border-light)',
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: '11px',
              color: 'var(--pt-text-primary)',
              display: 'block',
              marginBottom: '4px',
              letterSpacing: '0.05em',
            }}
          >
            SOLUTION:
          </span>
          {solutionImagePath && (
            <PaperImage
              imagePath={solutionImagePath}
              alt="Solution diagram"
              onZoom={onZoom}
              style={{
                maxWidth: '100%',
                maxHeight: '260px',
                objectFit: 'contain',
                marginBottom: '6px',
                borderRadius: '4px',
                border: '1px solid var(--pt-border-light)',
                display: 'block',
              }}
            />
          )}
          {explanation && explanation.trim().length > 0 && (
            <p
              style={{
                margin: 0,
                fontSize: '12px',
                color: 'var(--pt-text-body)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              <MathText text={explanation} />
            </p>
          )}
        </div>
      )}
    </div>
  )
})

// ─── Formula Sub-Renderer ────────────────────────────────────────────────────

interface FormulaItemProps {
  index: number
  card: Card & { data: FormulaData }
  onZoom: (src: string) => void
}

const FormulaItem = memo(function FormulaItem({ index, card, onZoom }: FormulaItemProps) {
  const { name, latex, variables, imagePath, imagePathFront } = card.data
  const vars = variables as unknown

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginBottom: '16px',
        borderBottom: '1px solid var(--pt-border-light)',
        paddingBottom: '14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ fontWeight: 700, color: 'var(--pt-text-primary)', fontSize: '13px' }}>
          {index}.
        </span>
        <span style={{ fontWeight: 700, color: 'var(--pt-text-primary)', fontSize: '13px' }}>
          <MathText text={name} />
        </span>
      </div>

      {imagePathFront && (
        <PaperImage
          imagePath={imagePathFront}
          alt="Formula front diagram"
          onZoom={onZoom}
          style={{
            maxWidth: '100%',
            maxHeight: '200px',
            objectFit: 'contain',
            borderRadius: '4px',
            border: '1px solid var(--pt-border-light)',
            display: 'block',
          }}
        />
      )}

      {latex && (
        <div
          style={{
            fontFamily: 'monospace',
            backgroundColor: 'var(--pt-formula-bg)',
            padding: '8px 12px',
            borderRadius: '4px',
            color: 'var(--pt-formula-text)',
            overflowX: 'auto',
            textAlign: 'center',
          }}
          dangerouslySetInnerHTML={{
            __html: renderMath(card.data.backIsPlainText ? latex : `$$${latex}$$`),
          }}
        />
      )}

      {Boolean(vars) && (
        <div style={{ fontSize: '12px', color: 'var(--pt-text-secondary)', lineHeight: 1.6 }}>
          {typeof vars === 'string' ? (
            vars.split('\n').map((line, idx) => (
              <span key={idx} style={{ display: 'block', marginBottom: '2px' }}>
                <MathText text={line} />
              </span>
            ))
          ) : typeof vars === 'object' && vars !== null && Object.keys(vars as Record<string, string>).length > 0 ? (
            Object.entries(vars as Record<string, string>).map(([k, v]) => (
              <span key={k} style={{ display: 'inline-block', marginRight: '14px', marginBottom: '2px' }}>
                <strong>
                  <MathText text={k} />
                </strong>
                : <MathText text={String(v)} />
              </span>
            ))
          ) : null}
        </div>
      )}

      {imagePath && (
        <PaperImage
          imagePath={imagePath}
          alt="Formula diagram"
          onZoom={onZoom}
          style={{
            maxWidth: '100%',
            maxHeight: '200px',
            objectFit: 'contain',
            borderRadius: '4px',
            border: '1px solid var(--pt-border-light)',
            display: 'block',
          }}
        />
      )}
    </div>
  )
})

// ─── Main TestPaperView Component ───────────────────────────────────────────

export function TestPaperView({
  cards: initialCards,
  topicId,
  title = 'Test Paper',
  onExit,
}: TestPaperViewProps) {
  const [loadedCards, setLoadedCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(!initialCards && !!topicId)
  const [layout, setLayout] = useState<LayoutMode>('glossary')
  const [boldSide, setBoldSide] = useState<BoldSide>('term')
  const [theme, setTheme] = useState<PrintTheme>('dark')
  const [showAnswers, setShowAnswers] = useState(true)
  const [showSolutions, setShowSolutions] = useState(true)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setShowBackToTop(e.currentTarget.scrollTop > 400)
  }

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Hardware back button interception — closes lightbox if open, otherwise exits
  const lightboxSrcRef = useRef<string | null>(null)
  useEffect(() => {
    lightboxSrcRef.current = lightboxSrc
  }, [lightboxSrc])

  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      if (lightboxSrcRef.current) {
        setLightboxSrc(null)
        return
      }
      onExit()
    })
    return () => {
      listenerPromise.then((handle) => handle.remove())
    }
  }, [onExit])

  // Load cards if not provided via props
  useEffect(() => {
    if (initialCards || !topicId) return

    dbService
      .getCardsWithProgress(topicId)
      .then((res) => {
        setLoadedCards(res)
        setLoading(false)
      })
      .catch((err) => {
        console.error('[TestPaperView] Failed to load cards:', err)
        setLoading(false)
      })
  }, [initialCards, topicId])

  const cards = initialCards ?? loadedCards

  const mcqCards = useMemo(() => cards.filter(isMCQ), [cards])
  const flashcardCards = useMemo(() => cards.filter(isFlashcard), [cards])
  const formulaCards = useMemo(() => cards.filter(isFormula), [cards])

  const isFlashcardOnly = flashcardCards.length > 0 && mcqCards.length === 0
  const hasFormulas = formulaCards.length > 0

  // Adjust layout if current combination is unsupported:
  // 1. If deck has ANY formulas and layout is 'glossary' or 'qa', desktop forces 'table'
  // 2. If deck is flashcard-only and layout is 'qa', desktop forces 'glossary'
  const effectiveLayout: LayoutMode = useMemo(() => {
    if (isFlashcardOnly && layout === 'qa') {
      return 'glossary'
    }
    if (hasFormulas && (layout === 'glossary' || layout === 'qa')) {
      return 'table'
    }
    return layout
  }, [isFlashcardOnly, hasFormulas, layout])

  const activeThemeVars = PRINT_THEMES[theme].vars

  return (
    <div className="h-full w-full bg-neutral-950 flex flex-col relative overflow-hidden select-text">
      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-neutral-800 bg-neutral-950/95 px-4 py-2.5 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onExit}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors shrink-0"
            title="Exit Test Paper"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-neutral-100 uppercase tracking-wide truncate">
              {title}
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">
              {cards.length} Cards Total
            </span>
          </div>
        </div>
      </header>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="sticky top-[49px] z-30 flex flex-wrap items-center gap-2 border-b border-neutral-800 bg-neutral-900/90 px-3 py-2 backdrop-blur-md shrink-0 justify-start sm:justify-center">
        {/* Layout Toggle */}
        <div className="flex items-center gap-1 bg-neutral-950/80 p-1 rounded-lg border border-neutral-800 shrink-0">
          <button
            type="button"
            disabled={hasFormulas}
            onClick={() => setLayout('glossary')}
            title={hasFormulas ? 'Glossary not supported with formulas' : 'Glossary / List Layout'}
            className={`p-1.5 rounded-md text-xs font-medium transition-all ${
              hasFormulas
                ? 'opacity-40 cursor-not-allowed text-neutral-500'
                : effectiveLayout === 'glossary'
                  ? 'bg-[#00ff41] text-black font-bold shadow-[0_0_8px_rgba(0,255,65,0.25)]'
                  : 'text-neutral-400 hover:text-white'
            }`}
          >
            <List size={14} />
          </button>
          <button
            type="button"
            onClick={() => setLayout('table')}
            title="Table Layout"
            className={`p-1.5 rounded-md text-xs font-medium transition-all ${
              effectiveLayout === 'table'
                ? 'bg-[#00ff41] text-black font-bold shadow-[0_0_8px_rgba(0,255,65,0.25)]'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Table2 size={14} />
          </button>
          {!isFlashcardOnly && (
            <button
              type="button"
              disabled={hasFormulas}
              onClick={() => setLayout('qa')}
              title={hasFormulas ? 'Q&A not supported with formulas' : 'Q&A Layout'}
              className={`p-1.5 rounded-md text-xs font-medium transition-all ${
                hasFormulas
                  ? 'opacity-40 cursor-not-allowed text-neutral-500'
                  : effectiveLayout === 'qa'
                    ? 'bg-[#00ff41] text-black font-bold shadow-[0_0_8px_rgba(0,255,65,0.25)]'
                    : 'text-neutral-400 hover:text-white'
              }`}
            >
              <BookOpen size={14} />
            </button>
          )}
        </div>

        {/* Flashcard Bold Side Toggle */}
        {flashcardCards.length > 0 && effectiveLayout !== 'qa' && (
          <div className="flex items-center gap-1 bg-neutral-950/80 p-1 rounded-lg border border-neutral-800 shrink-0">
            <button
              type="button"
              onClick={() => setBoldSide('term')}
              title="Bold Term"
              className={`flex items-center gap-0.5 px-2 py-1 rounded-md text-xs font-bold transition-all ${
                boldSide === 'term'
                  ? 'bg-[#00ff41] text-black shadow-[0_0_8px_rgba(0,255,65,0.25)]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Bold size={12} />
              <span className="text-[10px]">T</span>
            </button>
            <button
              type="button"
              onClick={() => setBoldSide('definition')}
              title="Bold Definition"
              className={`flex items-center gap-0.5 px-2 py-1 rounded-md text-xs font-bold transition-all ${
                boldSide === 'definition'
                  ? 'bg-[#00ff41] text-black shadow-[0_0_8px_rgba(0,255,65,0.25)]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Bold size={12} />
              <span className="text-[10px]">D</span>
            </button>
          </div>
        )}

        {/* Theme Picker */}
        <div className="flex items-center gap-1 bg-neutral-950/80 p-1 rounded-lg border border-neutral-800 shrink-0">
          {(['light', 'sepia', 'dark'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${
                theme === t
                  ? 'bg-[#00ff41] text-black shadow-[0_0_8px_rgba(0,255,65,0.25)]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {PRINT_THEMES[t].label}
            </button>
          ))}
        </div>

        {/* MCQ Answers / Solutions Toggles */}
        {mcqCards.length > 0 && (
          <div className="flex items-center gap-2 bg-neutral-950/80 px-2.5 py-1 rounded-lg border border-neutral-800 shrink-0 text-xs font-bold uppercase tracking-wider">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAnswers}
                onChange={(e) => setShowAnswers(e.target.checked)}
                className="accent-[#00ff41] w-3.5 h-3.5 cursor-pointer rounded"
              />
              <span className={showAnswers ? 'text-[#00ff41]' : 'text-neutral-400'}>ANS</span>
            </label>

            {mcqCards.some(
              (c) =>
                (c.data.explanation && c.data.explanation.trim().length > 0) ||
                !!c.data.solutionImagePath
            ) && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none border-l border-neutral-800 pl-2">
                <input
                  type="checkbox"
                  checked={showSolutions}
                  onChange={(e) => setShowSolutions(e.target.checked)}
                  className="accent-[#00ff41] w-3.5 h-3.5 cursor-pointer rounded"
                />
                <span className={showSolutions ? 'text-[#00ff41]' : 'text-neutral-400'}>
                  SOL&apos;N
                </span>
              </label>
            )}
          </div>
        )}
      </div>

      {/* ── Scrollable Document Paper Area ──────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-6 flex justify-center"
        style={{ backgroundColor: activeThemeVars['--pt-bg-outer'] }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#00ff41]" />
            <span className="text-xs font-semibold uppercase tracking-wider">Loading Test Paper...</span>
          </div>
        ) : (
          <div
            className="w-full max-w-3xl rounded-2xl shadow-2xl p-4 sm:p-10 transition-colors duration-200"
            style={{
              ...activeThemeVars,
              backgroundColor: activeThemeVars['--pt-bg-paper'],
              color: activeThemeVars['--pt-text-primary'],
              fontFamily: 'Georgia, "Times New Roman", serif',
            } as React.CSSProperties}
          >
            {/* Paper Header */}
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <h1
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--pt-text-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '8px',
                }}
              >
                {title}
              </h1>
              <hr style={{ border: 'none', borderTop: '2px solid var(--pt-rule)', margin: '0' }} />
            </div>

            {/* MCQ Section */}
            {mcqCards.length > 0 && (
              <section style={{ marginBottom: '32px' }}>
                {cards.some((c) => !isMCQ(c)) && (
                  <h2
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--pt-text-body)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: '12px',
                      borderBottom: '1px solid var(--pt-border-light)',
                      paddingBottom: '4px',
                    }}
                  >
                    Multiple Choice
                  </h2>
                )}

                {effectiveLayout === 'table' ? (
                  <div className="overflow-x-auto">
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        border: '1px solid var(--pt-border)',
                        tableLayout: 'fixed',
                      }}
                    >
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--pt-border)' }}>
                          <th
                            style={{
                              padding: '8px 12px',
                              textAlign: 'left',
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: 'var(--pt-text-body)',
                              width: '65%',
                              backgroundColor: 'var(--pt-thead-bg)',
                            }}
                          >
                            Question &amp; Choices
                          </th>
                          <th
                            style={{
                              padding: '8px 12px',
                              textAlign: 'left',
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: 'var(--pt-text-body)',
                              borderLeft: '1px solid var(--pt-border)',
                              width: '35%',
                              backgroundColor: 'var(--pt-thead-bg)',
                            }}
                          >
                            Answer
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {mcqCards.map((card, i) => (
                          <MCQTableRow
                            key={card.id}
                            index={i + 1}
                            card={card}
                            hideAnswers={!showAnswers}
                            hideSolutions={!showSolutions}
                            onZoom={setLightboxSrc}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div>
                    {mcqCards.map((card, i) => (
                      <MCQGlossaryItem
                        key={card.id}
                        index={i + 1}
                        card={card}
                        qaMode={effectiveLayout === 'qa'}
                        hideAnswers={!showAnswers}
                        hideSolutions={!showSolutions}
                        onZoom={setLightboxSrc}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Flashcard Section */}
            {flashcardCards.length > 0 && (
              <section style={{ marginBottom: '32px' }}>
                {cards.some((c) => !isFlashcard(c)) && (
                  <h2
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: 'var(--pt-text-body)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: '12px',
                      borderBottom: '1px solid var(--pt-border-light)',
                      paddingBottom: '4px',
                    }}
                  >
                    Flashcards
                  </h2>
                )}

                {effectiveLayout === 'table' ? (
                  <div className="overflow-x-auto">
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        border: '1px solid var(--pt-border)',
                        tableLayout: 'fixed',
                      }}
                    >
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--pt-border)' }}>
                          <th
                            style={{
                              padding: '8px 12px',
                              textAlign: 'left',
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: 'var(--pt-text-body)',
                              width: '50%',
                              backgroundColor: 'var(--pt-thead-bg)',
                            }}
                          >
                            TERM
                          </th>
                          <th
                            style={{
                              padding: '8px 12px',
                              textAlign: 'left',
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              color: 'var(--pt-text-body)',
                              borderLeft: '1px solid var(--pt-border)',
                              width: '50%',
                              backgroundColor: 'var(--pt-thead-bg)',
                            }}
                          >
                            DEFINITION
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {flashcardCards.map((card) => {
                          const { front, back, imageFront, imageBack, imagePath } = card.data
                          return (
                            <tr key={card.id} style={{ borderBottom: '1px solid var(--pt-border)' }}>
                              <td
                                style={{
                                  padding: '10px 12px',
                                  verticalAlign: 'top',
                                  width: '50%',
                                  overflow: 'hidden',
                                }}
                              >
                                {imageFront && (
                                  <PaperImage
                                    imagePath={imageFront}
                                    alt="Front diagram"
                                    onZoom={setLightboxSrc}
                                    style={{
                                      maxWidth: '100%',
                                      maxHeight: '180px',
                                      objectFit: 'contain',
                                      marginBottom: '4px',
                                      borderRadius: '4px',
                                      border: '1px solid var(--pt-border-light)',
                                      display: 'block',
                                    }}
                                  />
                                )}
                                {imagePath && (
                                  <PaperImage
                                    imagePath={imagePath}
                                    alt="Flashcard diagram"
                                    onZoom={setLightboxSrc}
                                    style={{
                                      maxWidth: '100%',
                                      maxHeight: '180px',
                                      objectFit: 'contain',
                                      marginBottom: '4px',
                                      borderRadius: '4px',
                                      border: '1px solid var(--pt-border-light)',
                                      display: 'block',
                                    }}
                                  />
                                )}
                                <p
                                  style={{
                                    color: 'var(--pt-text-primary)',
                                    margin: 0,
                                    fontSize: '13px',
                                    fontWeight: boldSide === 'term' ? 700 : 400,
                                  }}
                                >
                                  <MathText text={front} />
                                </p>
                              </td>
                              <td
                                style={{
                                  padding: '10px 12px',
                                  verticalAlign: 'top',
                                  width: '50%',
                                  borderLeft: '1px solid var(--pt-border)',
                                  overflow: 'hidden',
                                }}
                              >
                                {imageBack && (
                                  <PaperImage
                                    imagePath={imageBack}
                                    alt="Back diagram"
                                    onZoom={setLightboxSrc}
                                    style={{
                                      maxWidth: '100%',
                                      maxHeight: '180px',
                                      objectFit: 'contain',
                                      marginBottom: '4px',
                                      borderRadius: '4px',
                                      border: '1px solid var(--pt-border-light)',
                                      display: 'block',
                                    }}
                                  />
                                )}
                                <p
                                  style={{
                                    color: 'var(--pt-text-body)',
                                    margin: 0,
                                    fontSize: '13px',
                                    fontWeight: boldSide === 'definition' ? 700 : 400,
                                  }}
                                >
                                  <MathText text={back} />
                                </p>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div>
                    {flashcardCards.map((card) => {
                      const { front, back, imageFront, imageBack, imagePath } = card.data
                      return (
                        <div
                          key={card.id}
                          style={{
                            marginBottom: '14px',
                            paddingBottom: '10px',
                            borderBottom: '1px solid var(--pt-border-light)',
                          }}
                        >
                          <p
                            style={{
                              fontWeight: boldSide === 'term' ? 700 : 400,
                              color: 'var(--pt-text-primary)',
                              marginBottom: '4px',
                              fontSize: '13px',
                            }}
                          >
                            <MathText text={front} />
                          </p>
                          {imageFront && (
                            <PaperImage
                              imagePath={imageFront}
                              alt="Front diagram"
                              onZoom={setLightboxSrc}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '180px',
                                objectFit: 'contain',
                                marginLeft: '16px',
                                marginBottom: '4px',
                                borderRadius: '4px',
                                border: '1px solid var(--pt-border-light)',
                                display: 'block',
                              }}
                            />
                          )}
                          {imagePath && (
                            <PaperImage
                              imagePath={imagePath}
                              alt="Flashcard diagram"
                              onZoom={setLightboxSrc}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '180px',
                                objectFit: 'contain',
                                marginLeft: '16px',
                                marginBottom: '4px',
                                borderRadius: '4px',
                                border: '1px solid var(--pt-border-light)',
                                display: 'block',
                              }}
                            />
                          )}
                          <div
                            style={{
                              paddingLeft: '16px',
                              color: 'var(--pt-text-body)',
                              fontSize: '13px',
                            }}
                          >
                            {imageBack && (
                              <PaperImage
                                imagePath={imageBack}
                                alt="Back diagram"
                                onZoom={setLightboxSrc}
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '180px',
                                  objectFit: 'contain',
                                  marginBottom: '4px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--pt-border-light)',
                                  display: 'block',
                                }}
                              />
                            )}
                            <p
                              style={{
                                margin: 0,
                                fontWeight: boldSide === 'definition' ? 700 : 400,
                              }}
                            >
                              <MathText text={back} />
                            </p>
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
                <h2
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--pt-text-body)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: '12px',
                    borderBottom: '1px solid var(--pt-border-light)',
                    paddingBottom: '4px',
                  }}
                >
                  Formulas
                </h2>
                {formulaCards.map((card, i) => (
                  <FormulaItem
                    key={card.id}
                    index={i + 1}
                    card={card}
                    onZoom={setLightboxSrc}
                  />
                ))}
              </section>
            )}

            {cards.length === 0 && (
              <p
                style={{
                  color: 'var(--pt-text-muted)',
                  textAlign: 'center',
                  padding: '48px 0',
                  fontSize: '13px',
                }}
              >
                No cards found for this deck.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Floating Back to Top Button */}
      {showBackToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          title="Back to Top"
          aria-label="Back to Top"
          className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-[#00ff41] text-black shadow-[0_0_15px_rgba(0,255,65,0.4)] hover:bg-[#00ff41]/90 active:scale-95 transition-all"
        >
          <ArrowUp className="w-5 h-5 stroke-[2.5]" />
        </button>
      )}

      {/* Image Lightbox */}
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  )
}

export default TestPaperView
