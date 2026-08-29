/**
 * Shuffle an array in-place using the Fisher-Yates algorithm.
 * Returns a new shuffled array (does not mutate the original).
 *
 * NOTE: This file was created during the Capacitor scaffold because
 * scrambler.ts (ported verbatim from ECEngine desktop) depends on it.
 * The original utils.ts was not included in the initial port manifest
 * but is referenced by scrambler.ts at runtime.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
