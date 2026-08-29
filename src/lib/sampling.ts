// src/lib/sampling.ts
export interface CardWithWeight {
  id: string
  easeFactor?: number
  ease_factor?: number
  correct_count?: number
  total_count?: number
  last_result?: string | null
  [key: string]: any
}

export function plainSample<T>(cards: T[], n: number): T[] {
  return cards.slice(0, n)
}

export function weightedSample<T extends CardWithWeight>(cards: T[], n: number): T[] {
  if (n >= cards.length) return [...cards]

  const weights = cards.map(card => {
    const total = card.total_count ?? 0
    const correct = card.correct_count ?? 0
    const ease = card.easeFactor ?? card.ease_factor ?? 2.5
    const accuracy = total > 0 ? correct / total : 0.5
    const easePenalty = Math.max(0, (2.5 - ease) / 2.5)
    const lastWrong = card.last_result === 'wrong' ? 1 : 0
    return (1 - accuracy) + easePenalty + lastWrong
  })

  // Check if all weights are identical (no meaningful progress data)
  const allEqual = weights.every(w => Math.abs(w - weights[0]) < 1e-9)

  if (allEqual) {
    // Pure random shuffle → pick first n
    const shuffled = [...cards]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, n)
  }

  // Weighted sampling without replacement (progress data exists)
  // Assign a random key: key = rand^(1/weight), sort descending, take top n
  // This is Efraimidis-Spirakis A-Res — correct weighted sampling, no sequential bias
  const keyed = cards.map((card, i) => ({
    card,
    key: Math.pow(Math.random(), 1 / (weights[i] + 1e-9))
  }))

  keyed.sort((a, b) => b.key - a.key)
  return keyed.slice(0, n).map(k => k.card)
}
