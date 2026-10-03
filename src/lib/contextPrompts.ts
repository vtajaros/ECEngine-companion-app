import { getTosTopicById } from './tosClassification'

export interface PromptContextData {
  /** Question text (for MCQ or problem cards) */
  question?: string
  /** Multiple choice options */
  choices?: string[]
  /** 0-based index of the correct choice */
  answer?: number
  /** Stored explanation or solution derivation */
  explanation?: string
  /** Front term/text for flashcards */
  front?: string
  /** Back definition/text for flashcards */
  back?: string
  /** Subject identifier (MATH, GEAS, ELECS, EST) */
  subject?: string | null
  /** Table of Specifications topic identifier (e.g. ELECS-1.1) */
  tosTopicId?: string | null
  /** Deck title / source name */
  deckName?: string | null
  /** Image attached to question / card */
  image?: string | null
  /** Solution image attached to explanation */
  solutionImage?: string | null
  /** Card position in deck (1-based) */
  cardNumber?: number | null
  /** Total count of cards in source deck */
  totalInDeck?: number | null
}

function resolveTopicLabel(tosTopicId?: string | null, subject?: string | null): string | null {
  if (tosTopicId) {
    const topic = getTosTopicById(tosTopicId)
    if (topic) {
      return `${topic.subject} - ${topic.name}`
    }
    return tosTopicId
  }
  return subject ?? null
}

function formatImageNote(image?: string | null, solutionImage?: string | null): string {
  const images: string[] = []
  if (image) {
    const cleanImg = image.split('/').pop() || image
    images.push(`Question Image: ${cleanImg}`)
  }
  if (solutionImage) {
    const cleanSol = solutionImage.split('/').pop() || solutionImage
    images.push(`Solution Image: ${cleanSol}`)
  }
  if (images.length === 0) return ''
  return `\nIMAGE NOTE: This card references visual diagram(s) [${images.join(', ')}]. Please reconstruct, clarify, or explain the geometry, pinouts, and visual connections.`
}

/**
 * Builds a prompt for external AI (ChatGPT, Claude, Gemini) focused on step-by-step text explanation and reasoning.
 */
export function buildTextExplanationPrompt(data: PromptContextData): string {
  const isFlashcard = !data.choices || data.choices.length === 0
  const topicLabel = resolveTopicLabel(data.tosTopicId, data.subject)

  const metaLines: string[] = []
  if (data.subject) metaLines.push(`SUBJECT: ${data.subject}`)
  if (topicLabel) metaLines.push(`TOPIC: ${topicLabel}`)
  if (data.deckName) {
    const cardPos = data.cardNumber && data.totalInDeck ? ` (Card #${data.cardNumber} of ${data.totalInDeck})` : ''
    metaLines.push(`DECK: ${data.deckName}${cardPos}`)
  }
  const metaHeader = metaLines.length > 0 ? `${metaLines.join('\n')}\n\n` : ''
  const imageNote = formatImageNote(data.image, data.solutionImage)

  if (isFlashcard) {
    return `---
Please explain this technical concept for the Philippine ECE Board Exam:

${metaHeader}FRONT (TERM / QUESTION):
${data.front ?? data.question ?? ''}

BACK (DEFINITION / ANSWER):
${data.back ?? data.explanation ?? ''}${imageNote ? `\n${imageNote}` : ''}

Please explain:
1. A clear technical explanation and physical intuition behind this concept
2. Relevant formulas, equations, or laws governing it
3. Practical engineering applications in electronics or communications
4. A high-yield memory tip, visual mnemonic, or board exam pitfall to watch out for
---`
  }

  const choicesText = (data.choices ?? [])
    .map((c, i) => `${String.fromCharCode(65 + i)}. ${c ?? ''}`)
    .join('\n')

  const correctLetter =
    typeof data.answer === 'number' && data.answer >= 0 && data.choices && data.answer < data.choices.length
      ? `${String.fromCharCode(65 + data.answer)}. ${data.choices[data.answer] ?? ''}`
      : 'Not specified'

  return `---
Please explain the correct answer to this multiple choice question:

${metaHeader}QUESTION:
${data.question ?? ''}

CHOICES:
${choicesText}

CORRECT ANSWER: ${correctLetter}${imageNote ? `\n${imageNote}` : ''}

Please explain:
1. Why the correct answer is right
2. Why each of the other choices is wrong
3. Any relevant formula, law, or concept that applies
4. A memory tip or way to remember this for the board exam
---`
}

/**
 * Builds a prompt for external AI (ChatGPT, Claude, Gemini) focused on visual breakdowns, diagrams, and image generation.
 */
export function buildVisualBreakdownPrompt(data: PromptContextData): string {
  const isFlashcard = !data.choices || data.choices.length === 0
  const topicLabel = resolveTopicLabel(data.tosTopicId, data.subject)

  const metaLines: string[] = []
  if (data.subject) metaLines.push(`SUBJECT: ${data.subject}`)
  if (topicLabel) metaLines.push(`TOPIC: ${topicLabel}`)
  if (data.deckName) {
    const cardPos = data.cardNumber && data.totalInDeck ? ` (Card #${data.cardNumber} of ${data.totalInDeck})` : ''
    metaLines.push(`DECK: ${data.deckName}${cardPos}`)
  }
  const metaHeader = metaLines.length > 0 ? `${metaLines.join('\n')}\n\n` : ''
  const imageNote = formatImageNote(data.image, data.solutionImage)

  let contentBlock: string
  if (isFlashcard) {
    contentBlock = `FRONT (TERM / CONCEPT):
${data.front ?? data.question ?? ''}

BACK (DEFINITION / ANSWER):
${data.back ?? data.explanation ?? ''}`
  } else {
    const choicesText = (data.choices ?? [])
      .map((c, i) => `${String.fromCharCode(65 + i)}. ${c ?? ''}`)
      .join('\n')

    const correctLetter =
      typeof data.answer === 'number' && data.answer >= 0 && data.choices && data.answer < data.choices.length
        ? `${String.fromCharCode(65 + data.answer)}. ${data.choices[data.answer] ?? ''}`
        : 'Not specified'

    contentBlock = `QUESTION:
${data.question ?? ''}

CHOICES:
${choicesText}

CORRECT ANSWER: ${correctLetter}`
  }

  return `---
Please provide a comprehensive visual breakdown and technical diagram for this ECE board exam problem:

Context: PRC Electronics Engineering (ECE) Licensure Examination review. Use standard IEEE/IEC schematic symbols, standard engineering notation, and high-yield visual mnemonics suited for technical board exam recall.

${metaHeader}${contentBlock}${imageNote ? `\n${imageNote}` : ''}

Please generate:
1. 🧠 MENTAL MODEL & VISUAL INTUITION:
   - Describe step-by-step how to mentally visualize this physical system, circuit, or mathematical relationship.
2. 📐 TECHNICAL DIAGRAM / SCHEMATIC CODE:
   - Provide clean, renderable diagram code representing the setup (use Mermaid.js, ASCII schematic, or SVG diagram code suitable for previewing).
3. 🎨 IMAGE GENERATION PROMPT:
   - Provide an exact, high-detail prompt ready to paste into DALL-E 3, Midjourney, or Imagen to generate a clean, textbook-style technical infographic or schematic (white vector on dark/high-contrast background, clear labels, no hallucinated text).
4. ⚡ EXAM QUICK-IDENTIFICATION TIP:
   - What visual pattern or signature in the diagram should immediately reveal the correct formula or answer in the exam?
---`
}
