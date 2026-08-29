import { shuffleArray } from './utils'

// Re-export for backward compatibility
export const shuffle = shuffleArray

/**
 * Returns true if this MCQ's choices are safe to shuffle.
 * Shuffling is blocked when any choice references other choices by letter
 * position (e.g. "Both A and B", "A and C"), because
 * shuffling would make those positional references incorrect.
 *
 * Blocked patterns (case-insensitive):
 *   - Any choice containing positional references like:
 *     "both a and b", "a and b", "a & b", "a or b", "b and c",
 *     "a, b and c", "a, b, and c", "b & d", etc.
 *     i.e. two or more of the letters a/b/c/d joined by
 *     "and", "or", "&", or a comma — referring to choice positions.
 *
 * Note: Absolute patterns like "all of the above" are no longer blocked here,
 * because `shuffleChoices` now detects them and pins them to D (the last choice).
 */
export function isSafeToShuffleChoices(choices: string[]): boolean {
  // Matches positional references: "a and b", "both a & c", "a, b and c",
  // "a or b", "b & d", "a, b, or c", etc.
  // Requires at least two choice letters (a/b/c/d) near connectors.
  const positionalPattern =
    /\b(both\s+)?([abcd])\s*(?:,\s*[abcd]\s*)*(?:\s+(?:and|or)\s+|\s*&\s*)([abcd])\b(?!\s*\w)/i

  return !choices.some(choice => positionalPattern.test(choice))
}

/**
 * Shuffle MCQ choices and remap the correct answer index.
 * Returns new choices array, the updated answer index, and (if provided)
 * the correspondingly shuffled choicesPlainText array.
 */
export function shuffleChoices(
  choices: string[],
  answerIndex: number,
  choicesPlainText?: boolean[]
): { choices: string[]; answer: number; choicesPlainText?: boolean[] } {
  // Matches "all of the above", "none of the above", "all of the choices", etc.
  const absolutePattern = /\b(all|none)\s+of\s+(the\s+above|these|the\s+choices)\b/i

  // Find if there is any choice that matches the absolute pattern
  const pinnedIndex = choices.findIndex(c => absolutePattern.test(c))
  
  if (pinnedIndex !== -1) {
    // Pin this choice to the end (index choices.length - 1)
    const pinnedChoice = choices[pinnedIndex]
    const pinnedIsAnswer = answerIndex === pinnedIndex
    
    // Get the other choices to shuffle
    const others = choices
      .map((c, i) => ({ choice: c, originalIndex: i }))
      .filter(s => s.originalIndex !== pinnedIndex)
    
    const shuffledOthers = shuffleArray(others)
    
    // Reconstruct the array: shuffled others + pinned at the end
    const newChoices = [...shuffledOthers.map(s => s.choice), pinnedChoice]
    
    // Determine new answer index
    let newAnswer = -1
    if (pinnedIsAnswer) {
      newAnswer = newChoices.length - 1
    } else {
      newAnswer = shuffledOthers.findIndex(s => s.originalIndex === answerIndex)
    }
    
    const result: { choices: string[]; answer: number; choicesPlainText?: boolean[] } = {
      choices: newChoices,
      answer: newAnswer,
    }
    if (choicesPlainText) {
      result.choicesPlainText = [
        ...shuffledOthers.map(s => choicesPlainText[s.originalIndex]),
        choicesPlainText[pinnedIndex]
      ]
    }
    return result
  }

  // Build indexed pairs so we can track which slot went where
  const indexed = choices.map((c, i) => ({ choice: c, originalIndex: i }))
  const shuffled = shuffleArray(indexed)
  const newChoices = shuffled.map(s => s.choice)
  const newAnswer = shuffled.findIndex(s => s.originalIndex === answerIndex)
  const result: { choices: string[]; answer: number; choicesPlainText?: boolean[] } = {
    choices: newChoices,
    answer: newAnswer,
  }
  if (choicesPlainText) {
    result.choicesPlainText = shuffled.map(s => choicesPlainText[s.originalIndex])
  }
  return result
}
