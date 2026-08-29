import { Preferences } from '@capacitor/preferences'

const BOOKMARK_KEY = 'bookmarkedIds'

export const bookmarkService = {
  async getAll(): Promise<Set<string>> {
    const { value } = await Preferences.get({ key: BOOKMARK_KEY })
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
    await Preferences.set({ key: BOOKMARK_KEY, value: JSON.stringify(Array.from(next)) })
    return next
  },

  async isBookmarked(cardId: string): Promise<boolean> {
    const all = await this.getAll()
    return all.has(cardId)
  },
}
