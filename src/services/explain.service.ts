import { Preferences } from '@capacitor/preferences'
import { CapacitorHttp, HttpResponse } from '@capacitor/core'
import { GROQ_API_KEY_PREF, GROQ_API_URL, GROQ_MODEL } from '../config/app-config'

export interface ExplainParams {
  question: string
  choices: string[]
  correctAnswerIndex: number
}

export class ExplainError extends Error {
  status?: number
  detail?: string
  constructor(message: string, status?: number, detail?: string) {
    super(message)
    this.name = 'ExplainError'
    this.status = status
    this.detail = detail
  }
}

function getHeader(headers: Record<string, string> | undefined, name: string): string | null {
  if (!headers) return null
  const target = name.toLowerCase()
  for (const [key, val] of Object.entries(headers)) {
    if (key.toLowerCase() === target && val !== undefined && val !== null) {
      return String(val)
    }
  }
  return null
}

async function callGroqChat(userPrompt: string): Promise<string> {
  const { value: apiKey } = await Preferences.get({ key: GROQ_API_KEY_PREF })
  if (!apiKey || apiKey.trim() === '') {
    throw new ExplainError('NO_KEY')
  }

  let response: HttpResponse
  try {
    response = await CapacitorHttp.post({
      url: GROQ_API_URL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      data: {
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a professional ECE (Electronics and Communications Engineering) tutor helping Filipino students prepare for the PRC board exam. Be concise, accurate, and practical.',
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      },
      connectTimeout: 15000,
      readTimeout: 15000,
    })
  } catch (err: unknown) {
    if (err instanceof ExplainError) {
      throw err
    }
    const message = err instanceof Error ? err.message : String(err)
    if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('timed out')) {
      throw new ExplainError('TIMEOUT')
    }
    throw new ExplainError('NETWORK_ERROR', undefined, message)
  }

  // Cache rate-limit headers for display in Settings
  try {
    const limitRequests = getHeader(response.headers, 'x-ratelimit-limit-requests')
    const remainingRequests = getHeader(response.headers, 'x-ratelimit-remaining-requests')
    const resetRequests = getHeader(response.headers, 'x-ratelimit-reset-requests')
    const limitTokens = getHeader(response.headers, 'x-ratelimit-limit-tokens')
    const remainingTokens = getHeader(response.headers, 'x-ratelimit-remaining-tokens')
    const resetTokens = getHeader(response.headers, 'x-ratelimit-reset-tokens')

    if (limitRequests || limitTokens) {
      const usage = {
        limitRequests,
        remainingRequests,
        resetRequests,
        limitTokens,
        remainingTokens,
        resetTokens,
        fetchedAt: Date.now(),
      }
      await Preferences.set({ key: 'groqUsageSnapshot', value: JSON.stringify(usage) })
    }
  } catch {
    // non-critical, ignore
  }

  if (response.status === 401) {
    throw new ExplainError('INVALID_KEY')
  }
  if (response.status === 429) {
    throw new ExplainError('RATE_LIMITED')
  }
  if (response.status < 200 || response.status >= 300) {
    const errorText = typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data)
    throw new ExplainError('API_ERROR', response.status, errorText)
  }

  const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
  const content = data.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string' || content.trim() === '') {
    throw new ExplainError('API_ERROR', 200, 'Empty response from model')
  }

  return content.trim()
}

export async function getExplanation(params: ExplainParams): Promise<string> {
  const { question, choices, correctAnswerIndex } = params
  const correctAnswerText = choices[correctAnswerIndex] ?? ''
  const correctAnswerLetter = String.fromCharCode(65 + correctAnswerIndex)
  const choicesText = choices.map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`).join('\n')

  const userPrompt = `QUESTION:
${question}

CHOICES:
${choicesText}

CORRECT ANSWER: ${correctAnswerLetter}. ${correctAnswerText}

Please provide a concise, professional explanation for an ECE board exam student.

STRICT FORMATTING RULES:
1. STRUCTURE:
   - **Explanation:** Always start with this header.
     - Direct Answer Justification: The first sentence MUST explicitly mention the correct answer's text and explain its specific role or why it is correct (e.g., "Hans Christian Oersted is correct because his 1820 experiment was the first to prove..."). Do NOT just say "The answer is D".
     - Ban Generic Filler: Strictly prohibit sentences like "This is essential for ECE students" or "Marking a significant milestone." If a sentence doesn't contain a technical fact, delete it.
     - Enumerated Lists: If the Explanation body lists multiple items (e.g. the five forces, steps, components), place EACH numbered item on its OWN LINE using the format "1. item\\n2. item\\n3. item". Do NOT write them inline as "(1) item, (2) item, (3) item".
   - **Key Formula:** Include this section ONLY if a mathematical calculation or specific formula is required. If conceptual, skip entirely. Do not write "N/A".
   - **Memory Tip:** Always end with this header. Provide a Mnemonic or Mental Hook (e.g., "Oersted = Observed magnetism first"). If a specific mnemonic isn't possible, provide a "Quick Fact" instead of generic advice.
2. LATEX: Wrap ALL mathematical formulas, variables (like $V_{gs}$, $I_d$, or $\\mu$), and units in standard LaTeX delimiters ($ ... $).
3. SEPARATION: Use exactly two newlines (\\n\\n) between sections.
4. CONSTRAINTS: Max 150 words. Ensure exponents (r^3) and subscripts (V_gs) render naturally in LaTeX.
5. LATEX REFERENCE:
   - JFET: $g_m = \\frac{\\Delta I_d}{\\Delta V_{gs}}$
   - Reluctance: $S = \\frac{l}{\\mu \\cdot A}$
   - APF: $APF = \\frac{n \\cdot \\frac{4}{3} \\pi r^3}{a^3}$`

  return callGroqChat(userPrompt)
}

export interface FlashcardExplainParams {
  term: string
  definition: string
}

export async function getFlashcardExplanation(params: FlashcardExplainParams): Promise<string> {
  const { term, definition } = params

  const userPrompt = `FLASHCARD:
Term: ${term}
Definition: ${definition}

Please provide a concise, professional explanation of this Electronics Engineering concept for an ECE board exam student.

STRICT FORMATTING RULES:
1. STRUCTURE:
   - **Explanation:** Always start with this header.
     - Direct Concept Breakdown: The first sentence MUST clearly explain what this term/concept IS and its primary significance in Electronics Engineering.
     - Technical Precision: Explain the core working mechanism, key characteristics, or practical engineering applications. No filler or generic fluff.
   - **Key Formula or Example:** Include this section ONLY if a mathematical calculation, formula, or concrete circuit/system example clarifies the concept. If purely conceptual, skip entirely.
   - **Memory Tip:** Always end with this header. Provide a Mnemonic, Mental Hook, or "Quick Fact" to help remember this concept on the PRC board exam.
2. LATEX: Wrap ALL mathematical formulas, variables (like $V_{gs}$, $I_d$, or $\\mu$), and units in standard LaTeX delimiters ($ ... $).
3. SEPARATION: Use exactly two newlines (\\n\\n) between sections.
4. CONSTRAINTS: Max 150 words. Ensure formulas and variables render naturally in LaTeX.`

  return callGroqChat(userPrompt)
}
