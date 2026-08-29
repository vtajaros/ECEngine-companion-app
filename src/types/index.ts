export type Subject = 'MATH' | 'GEAS' | 'ELECS' | 'EST'
export type CardType = 'flashcard' | 'mcq' | 'formula' | 'concept'
export type Difficulty = 'easy' | 'medium' | 'hard'

// Discriminated union payload shape
export type CardData = FlashcardData | MCQData | FormulaData | ConceptData

export interface Card {
  id: string
  topicId: string
  type: CardType
  data: CardData
  difficulty: Difficulty
  tags: string[]
  isCustom: boolean
  createdAt: string
  /**
   * Set to `true` on MCQ cards synthesised from flashcards via generateMCQs().
   * These cards reuse the source flashcard's DB id — writing progress into that
   * row would corrupt the flashcard's own SM-2 state. Never write progress when
   * this flag is present and true.
   */
  isGenerated?: boolean
  // Progress fields — populated when fetched via getCardsWithProgress, absent otherwise
  easeFactor?: number
  repetitions?: number
  interval?: number
  correct_count?: number
  total_count?: number
  last_result?: string | null
}

export interface FlashcardData {
  front: string
  back: string
  imageFront?: string
  imageBack?: string
  imagePath?: string
  explanation?: string
  explanationImagePath?: string
}

export interface MCQData {
  question: string
  choices: string[]
  answer: number
  explanation: string
  imagePath?: string
  solutionImagePath?: string
  yearAsked?: number
  choicesPlainText?: boolean[]  // per-choice flag: true = render as plain text, skip LaTeX auto-detection
}

export interface FormulaData {
  name: string
  latex: string
  variables: Record<string, string>
  imagePath?: string           // legacy: explanation-area image, kept for backward compat
  imagePathFront?: string      // NEW: image shown on the front (name) face
  description?: string
  explanation?: string
  explanationImagePath?: string
  backIsPlainText?: boolean    // true when user chose text mode for the back/equation field
}

export interface ConceptData {
  title: string
  body: string
  image?: string
  imagePath?: string
}

export interface Progress {
  cardId: string
  easeFactor: number
  interval: number
  repetitions: number
  nextReview: string
  lastReviewed: string
}

export interface Topic {
  id: string
  name: string
  subject: string
  description?: string
  parentId: string | null
  orderIndex: number
  createdAt?: number
  tags?: string[]
}

export interface ExamSession {
  id: string
  topicId?: string
  mode: 'practice' | 'mock' | 'custom'
  startedAt: string
  finishedAt?: string
  score: number
  total: number
  answers: Record<string, number>
}
