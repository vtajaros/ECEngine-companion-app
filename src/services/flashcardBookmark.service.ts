import { Preferences } from '@capacitor/preferences'

const FLASHCARD_BOOKMARK_KEY = 'flashcardBookmarkedIds'

export const flashcardBookmarkService = {
  async getAll(): Promise<Set<string>> {
    const { value } = await Preferences.get({ key: FLASHCARD_BOOKMARK_KEY })
    if (!value) return new Set()
    try {
      const arr = JSON.parse(value) as string[]
      return new Set(arr)
    } catch {
      return new Set()
    }
  },

  async toggle(cardId: string): Promise<Set<string>> {
    const current = await this.getAll()
    const next = new Set(current)
    if (next.has(cardId)) next.delete(cardId)
    else next.add(cardId)
    await Preferences.set({ key: FLASHCARD_BOOKMARK_KEY, value: JSON.stringify(Array.from(next)) })
    return next
  },

  async isBookmarked(cardId: string): Promise<boolean> {
    const all = await this.getAll()
    return all.has(cardId)
  },
}
