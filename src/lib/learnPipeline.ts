import { Card, MCQData } from '../types'
import { isSafeToShuffleChoices, shuffleChoices } from './scrambler'
import { weightedSample, plainSample } from './sampling'
import { shuffleArray } from './utils'
import { bookmarkService } from '../services/bookmark.service'

export interface LearnPipelineSettings {
  bookmarkedOnly: boolean
  shuffleQuestions: boolean
  shuffleChoices: boolean
  itemCount: 'All' | number
  randomSample: boolean
}

export async function buildLearnQueue(
  cards: Card[],
  settings: LearnPipelineSettings
): Promise<Card[]> {
  let result = cards

  // 1. Bookmark filter
  if (settings.bookmarkedOnly) {
    const bookmarked = await bookmarkService.getAll()
    result = result.filter(c => bookmarked.has(c.id))
  }

  // 2. Shuffle question order
  if (settings.shuffleQuestions) {
    result = shuffleArray(result)
  }

  // 3. Shuffle choices (MCQ only, guarded by isSafeToShuffleChoices)
  if (settings.shuffleChoices) {
    result = result.map(card => {
      if (card.type !== 'mcq') return card
      const mcq = card.data as MCQData
      if (!Array.isArray(mcq.choices) || !isSafeToShuffleChoices(mcq.choices)) return card
      const sc = shuffleChoices(mcq.choices, mcq.answer, mcq.choicesPlainText)
      return {
        ...card,
        data: {
          ...mcq,
          choices: sc.choices,
          answer: sc.answer,
          ...(sc.choicesPlainText ? { choicesPlainText: sc.choicesPlainText } : {}),
        },
      }
    })
  }

  // 4. Sample / truncate
  if (settings.itemCount !== 'All' && result.length > settings.itemCount) {
    result = settings.randomSample
      ? weightedSample(result, settings.itemCount)
      : plainSample(result, settings.itemCount)
  }

  return result
}
