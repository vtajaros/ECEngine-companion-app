import katex from 'katex'

const LATEX_COMMANDS = [
  '\\frac', '\\sqrt', '\\sum', '\\int', '\\lim',
  '\\log', '\\sin', '\\cos', '\\tan', '\\cot', '\\sec', '\\csc',
  '\\arcsin', '\\arccos', '\\arctan',
  '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\varepsilon',
  '\\zeta', '\\eta', '\\theta', '\\vartheta', '\\iota', '\\kappa',
  '\\lambda', '\\mu', '\\nu', '\\xi', '\\pi', '\\varpi',
  '\\rho', '\\varrho', '\\sigma', '\\varsigma', '\\tau', '\\upsilon',
  '\\phi', '\\varphi', '\\chi', '\\psi', '\\omega',
  '\\Gamma', '\\Delta', '\\Theta', '\\Lambda', '\\Xi', '\\Pi',
  '\\Sigma', '\\Upsilon', '\\Phi', '\\Psi', '\\Omega',
  '\\infty', '\\pm', '\\mp', '\\cdot', '\\times', '\\div',
  '\\leq', '\\geq', '\\neq', '\\approx', '\\equiv', '\\sim',
  '\\left', '\\right', '\\forall', '\\exists', '\\in', '\\notin',
  '\\subset', '\\supset', '\\subseteq', '\\supseteq',
  '\\cup', '\\cap', '\\vec', '\\hat', '\\bar', '\\dot', '\\ddot',
  '\\partial', '\\nabla', '\\mathrm', '\\mathbf', '\\mathit', '\\text',
  '\\vert', '\\Vert', '\\langle', '\\rangle',
  '\\larr', '\\rarr', '\\lArr', '\\rArr',
  '\\to', '\\Rightarrow', '\\Leftarrow', '\\Leftrightarrow',
  '\\prod', '\\coprod', '\\oint', '\\iint', '\\iiint',
  '\\overline', '\\underline', '\\overbrace', '\\underbrace',
  '\\binom', '\\choose', '\\begin', '\\end', '\\matrix', '\\pmatrix',
  '\\placeholder', '\\cdots', '\\ldots', '\\vdots', '\\ddots',
  '\\hline', '\\circ', '\\bullet', '\\star', '\\degree',
  '\\phase', '\\SI', '\\unit', '\\ang', '\\boldsymbol'
]

// Common math function names that shouldn't be counted as English prose words
const MATH_FUNCTION_WORDS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'arcsin', 'arccos', 'arctan',
  'sinh', 'cosh', 'tanh',
  'log', 'ln', 'lg', 'exp',
  'lim', 'max', 'min', 'inf', 'sup',
  'det', 'dim', 'ker', 'deg', 'gcd', 'lcm',
  'mod', 'arg', 'var', 'cov', 're', 'im',
  'sqrt'
])

const CURRENCY_TOKEN = '\uE000CURRENCYDOLLARSIGN\uE000'

/**
 * Replaces currency dollar signs (e.g. $500,000, $150, $2.50, ($100)) and escaped dollar signs (\$)
 * with a temporary private-use token so KaTeX doesn't mistake them for math delimiters.
 */
export const protectCurrencyAndEscapedDollars = (text: string): string => {
  if (!text || typeof text !== 'string') return ''

  // 1. Explicitly escaped dollar signs: \$ -> token
  let result = text.replace(/\\\$/g, CURRENCY_TOKEN)

  // 2. Scan through dollar signs to differentiate currency from LaTeX math delimiters
  // A dollar sign directly preceding digits (e.g. $500,000 or $25,000) is currency if:
  // - It has no matching closing $ on the same line, OR
  // - The text between it and the next $ looks like English prose (e.g. 2+ prose words, no LaTeX commands or math operators)
  const dollarRegex = /(^|[\s(\[{,;:])(?<!\$)\$(?!\$)(?=\s?\d[\d,]*(?:\.\d+)?(?:[kKmMbBtT])?\b)/g

  let match: RegExpExecArray | null
  while ((match = dollarRegex.exec(result)) !== null) {
    const prefix = match[1]
    const dollarIndex = match.index + prefix.length

    // Find the next single $ after this dollar sign (if any)
    const restOfText = result.slice(dollarIndex + 1)
    const nextDollarOffset = restOfText.search(/(?<!\$)\$(?!\$)/)

    if (nextDollarOffset === -1) {
      // Unpaired dollar sign before a number -> definitely currency
      result = result.slice(0, dollarIndex) + CURRENCY_TOKEN + result.slice(dollarIndex + 1)
      dollarRegex.lastIndex = dollarIndex + CURRENCY_TOKEN.length
      continue
    }

    const insideCandidate = restOfText.slice(0, nextDollarOffset)

    // Check if the candidate inside is a valid math expression vs prose
    const hasLatexCommand = /\\([a-zA-Z]+)/.test(insideCandidate)
    const hasMathScript = /[\^_][{0-9a-zA-Z]/.test(insideCandidate)
    const hasMathRel = /[=<>≈≤≥±]/.test(insideCandidate)

    let stripped = insideCandidate.replace(/\\(text|mathrm|textbf|textit)\{[^}]*\}/g, '')
    stripped = stripped.replace(/\\[a-zA-Z]+/g, '')
    const words = (stripped.match(/\b[a-zA-Z]{2,}\b/g) || []).filter(w => !MATH_FUNCTION_WORDS.has(w.toLowerCase()))
    const isProse = words.length >= 2 && /\s/.test(stripped)

    const isMath = (hasLatexCommand || hasMathScript || hasMathRel) && !isProse

    if (!isMath) {
      // This is a currency symbol, not a LaTeX math delimiter
      result = result.slice(0, dollarIndex) + CURRENCY_TOKEN + result.slice(dollarIndex + 1)
      dollarRegex.lastIndex = dollarIndex + CURRENCY_TOKEN.length
    } else {
      // It's a valid math block, skip past the closing $
      dollarRegex.lastIndex = dollarIndex + 1 + nextDollarOffset + 1
    }
  }

  return result
}

export const restoreCurrencyTokens = (text: string): string => {
  if (!text || typeof text !== 'string') return ''
  return text.replace(new RegExp(CURRENCY_TOKEN, 'g'), '$')
}

// Detects if text contains LaTeX that needs rendering:
// - backslash commands (\frac, etc.)
// - superscripts (a^b) or subscripts (a_b) using curly braces
// - dollar sign delimiters (excluding currency values and escaped dollars)
export const isRawLatex = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false
  // Contains known backslash commands
  if (LATEX_COMMANDS.some(cmd => text.includes(cmd))) return true
  // Starts with backslash (raw command)
  if (text.startsWith('\\')) return true
  // Contains $ delimiters (excluding currency values and escaped dollars)
  const withoutCurrency = protectCurrencyAndEscapedDollars(text)
  if (withoutCurrency.includes('$')) return true
  // Superscripts or subscripts with braces: a^{...} or a_{...}
  if (/[\^_]\{/.test(text)) return true
  // Bare superscripts or subscripts: e.g. a^2 or a_1 (only when not surrounded by prose)
  const hasBareNotation = /\^\w/.test(text) || /(?<!^|[_])_(?![_])[a-zA-Z0-9{]/.test(text)
  if (hasBareNotation) {
    // Prose guard: if text contains 2+ English words separated by spaces, it's prose with notation
    let stripped = text.replace(/\\(text|mathrm|textbf|textit)\{[^}]*\}/g, '')
    stripped = stripped.replace(/\\[a-zA-Z]+/g, '')
    const words = stripped.match(/\b[a-zA-Z]{2,}\b/g) || []
    if (words.length >= 2 && /\s/.test(stripped)) {
      return false
    }
    return true
  }
  return false
}

// Determines if a string is entirely a math equation (no regular English sentences or prose words)
export const isPureMath = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false
  if (!isRawLatex(text)) return false
  if (text.includes('$')) return false // Mixed with text if $ is used

  let stripped = text.replace(/\\(text|mathrm|textbf|textit)\{[^}]*\}/g, '')
  stripped = stripped.replace(/\\[a-zA-Z]+/g, '')
  const words = stripped.match(/\b[a-zA-Z]{2,}\b/g) || []
  const nonMathWords = words.filter(w => !MATH_FUNCTION_WORDS.has(w.toLowerCase()))
  const hasSpace = /\s/.test(stripped)
  const isText = (hasSpace && nonMathWords.length > 0) || nonMathWords.length >= 2

  return !isText
}

/**
 * Escapes HTML special characters in user-supplied plain text to prevent
 * injection. Applied before inline formatting so markdown markers
 * (**, *, __) still work correctly since they don't contain HTML-special chars.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Renders a single plain-text segment: HTML-escape user content then convert newlines.
function renderSegment(segment: string): string {
  return escapeHtml(segment).replace(/\n/g, '<br>')
}

/**
 * Applies Markdown-style inline formatting markers to HTML.
 * Called on plain-text segments ONLY — never passed into KaTeX.
 * Segments must already be HTML-escaped (via renderSegment) before calling this.
 * Order: bold before italic to prevent partial marker matches.
 *
 *   **text**  →  <strong>text</strong>
 *   *text*    →  <em>text</em>
 *   __text__  →  <u>text</u>
 */
function applyInlineFormatting(text: string): string {
  let result = text
    .replace(/\*\*(.*?)\*\*/gs, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/gs, '<em>$1</em>')
    .replace(/(?<!_)__(?!_)(.+?)(?<!_)__(?!_)/gs, '<u>$1</u>')

  // Superscript: ^{multi}, ^|...|  (absolute value), ^(...) (parenthesized group),
  // or ^x (single non-space char or number with optional sign/decimal)
  result = result.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>')
  result = result.replace(/\^\|([^|]*)\|/g, '<sup>|$1|</sup>')
  result = result.replace(/\^\(([^)]*)\)/g, '<sup>($1)</sup>')
  result = result.replace(/\^([+-]?\d+(?:\.\d+)?|[^\s{|(])/g, '<sup>$1</sup>')

  // Subscript: _{multi}, _(...) (parenthesized group),
  // or _x (single non-space char or number with optional sign/decimal)
  result = result.replace(/\_\{([^}]+)\}/g, '<sub>$1</sub>')
  result = result.replace(/\_\(([^)]*)\)/g, '<sub>($1)</sub>')
  result = result.replace(/(?<!\*\*?)(?<!_)_(?!\*\*?)([+-]?\d+(?:\.\d+)?|[^\s_{(])/g, '<sub>$1</sub>')

  return result
}

/**
 * Renders a plain-text/prose segment that sits outside explicit $ delimiters.
 * If the prose contains bare LaTeX commands (e.g. \lambda, \frac{1}{2}), they are rendered with KaTeX.
 * Otherwise, markdown-style inline formatting is applied.
 */
function renderProseSegment(segment: string): string {
  if (!segment) return ''
  if (!/\\([a-zA-Z]+)/.test(segment)) {
    return applyInlineFormatting(renderSegment(segment))
  }
  // Match standalone LaTeX commands or environments in prose
  const bareRegex = /(\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\}|\\[a-zA-Z]+(?:\{(?:[^{}]|\{[^{}]*\})*\}|\[[^[\]]*\])*)/g
  const parts: string[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = bareRegex.exec(segment)) !== null) {
    if (m.index > last) {
      parts.push(applyInlineFormatting(renderSegment(segment.slice(last, m.index))))
    }
    try {
      parts.push(
        katex.renderToString(restoreCurrencyTokens(m[0].trim()), {
          throwOnError: false,
          displayMode: false
        })
      )
    } catch {
      parts.push(escapeHtml(restoreCurrencyTokens(m[0])))
    }
    last = m.index + m[0].length
  }
  if (last < segment.length) {
    parts.push(applyInlineFormatting(renderSegment(segment.slice(last))))
  }
  return parts.join('')
}

/**
 * Render inline LaTeX math expressions within text.
 * Handles three cases:
 *   Path A — pure math expressions: render entire string with KaTeX.
 *   Path B/C — $ / $$ delimited content or embedded LaTeX commands:
 *              render math blocks with KaTeX, and prose segments as formatted text.
 *
 * @param text - Raw text potentially containing LaTeX expressions
 * @returns HTML string safe for dangerouslySetInnerHTML
 */
export const renderMath = (text: string): string => {
  if (!text || typeof text !== 'string') return ''

  // ── Normalize non-standard / MathJax-only commands to KaTeX equivalents ──
  const normalized = text
    .replace(/\\exponentialE\b/g, 'e')           // Euler's number e
    .replace(/\\imaginaryI\b/g, 'i')             // imaginary unit i
    .replace(/\\imaginaryJ\b/g, 'j')             // imaginary unit j (engineering)
    .replace(/\\differentialD\b/g, 'd')          // differential d
    .replace(/\\capitalDifferentialD\b/g, 'D')   // D operator
    .replace(/\\DoubleStruckCapitalE\b/g, '\\mathbb{E}') // Expected value E
    .replace(/\\DoubleStruckCapitalN\b/g, '\\mathbb{N}') // Natural numbers
    .replace(/\\DoubleStruckCapitalR\b/g, '\\mathbb{R}') // Reals
    .replace(/\\DoubleStruckCapitalZ\b/g, '\\mathbb{Z}') // Integers
    .replace(/\\DoubleStruckCapitalC\b/g, '\\mathbb{C}') // Complex numbers
    // ECE-specific command normalization
    .replace(/\\phase\{([^}]+)\}/g, '\\angle $1')
    .replace(/\\SI\{([^}]+)\}\{([^}]+)\}/g, '$1\\,\\text{$2}')
    .replace(/\\unit\{([^}]+)\}/g, '\\text{$1}')
    .replace(/\\ang\{([^}]+)\}/g, '$1^{\\circ}')
    .replace(/\\boldsymbol\{([^}]+)\}/g, '\\mathbf{$1}')
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$')

  // Protect currency amounts ($500,000, $150) and escaped dollars (\$)
  let t = protectCurrencyAndEscapedDollars(normalized)

  // ── Path A: pure raw LaTeX with no $ delimiters ──
  // Only render the entire string with KaTeX if it is purely a math expression.
  if (!t.includes('$') && isPureMath(t)) {
    const hasFormatting = /\*\*|\*[^*]|__/.test(t)
    if (!hasFormatting) {
      try {
        return restoreCurrencyTokens(
          katex.renderToString(t, {
            throwOnError: false,
            displayMode: true,
            trust: true
          })
        )
      } catch {
        return restoreCurrencyTokens(renderSegment(t))
      }
    }
  }

  // ── Path B/C: content with $ / $$ delimiters (or mixed prose with LaTeX) ──
  const delimRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g
  const segments: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = delimRegex.exec(t)) !== null) {
    if (match.index > lastIndex) {
      segments.push(renderProseSegment(t.slice(lastIndex, match.index)))
    }
    const isDisplay = match[0].startsWith('$$')
    const inner = match[0].replace(/^\$\$?/, '').replace(/\$\$?$/, '')
    try {
      segments.push(
        katex.renderToString(restoreCurrencyTokens(inner.trim()), {
          throwOnError: false,
          displayMode: isDisplay
        })
      )
    } catch {
      segments.push(escapeHtml(restoreCurrencyTokens(match[0])))
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < t.length) {
    segments.push(renderProseSegment(t.slice(lastIndex)))
  }

  if (segments.length > 0) {
    return restoreCurrencyTokens(segments.join(''))
  }

  // ── Pure plain text: no math at all ──
  return restoreCurrencyTokens(renderProseSegment(t))
}

/**
 * Renders text as plain (non-math) content: HTML-escapes user input, converts
 * newlines, and applies inline formatting (bold, italic, underline, super/subscript).
 * Unlike renderMath(), this NEVER runs KaTeX or LaTeX auto-detection.
 * Use for MCQ choices explicitly set to text mode.
 */
export const renderPlainText = (text: string): string => {
  if (!text || typeof text !== 'string') return ''
  return restoreCurrencyTokens(applyInlineFormatting(renderSegment(protectCurrencyAndEscapedDollars(text))))
}

/**
 * Scans for double-escaped backslashes followed by a letter (e.g. \\frac).
 * These often occur due to incorrect JSON stringification of LaTeX data.
 */
export const scanForDoubleEscapes = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false
  return /\\\\\w/.test(text)
}
