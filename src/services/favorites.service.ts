import { Preferences } from '@capacitor/preferences'

const STARRED_KEY = 'userStarredTopicIds'
const UNSTARRED_KEY = 'userUnstarredTopicIds'
const LEGACY_FAVORITES_KEY = 'favoriteTopicIds'

export interface FavoriteOverrides {
  starred: Set<string>
  unstarred: Set<string>
}

/**
 * Loads user favorite overrides from preferences.
 * Migrates any legacy favoriteTopicIds into the starred set.
 */
export async function getFavoriteOverrides(): Promise<FavoriteOverrides> {
  const [starredRes, unstarredRes, legacyRes] = await Promise.all([
    Preferences.get({ key: STARRED_KEY }),
    Preferences.get({ key: UNSTARRED_KEY }),
    Preferences.get({ key: LEGACY_FAVORITES_KEY }),
  ])

  const parseSet = (val: string | null): Set<string> => {
    if (!val) return new Set()
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) ? new Set(parsed) : new Set()
    } catch {
      return new Set()
    }
  }

  const starred = parseSet(starredRes.value)
  const unstarred = parseSet(unstarredRes.value)

  // Migration from legacy single list if STARRED_KEY wasn't initialized yet
  if (!starredRes.value && legacyRes.value) {
    const legacy = parseSet(legacyRes.value)
    for (const id of legacy) {
      starred.add(id)
    }
    await Preferences.set({ key: STARRED_KEY, value: JSON.stringify([...starred]) })
    await Preferences.remove({ key: LEGACY_FAVORITES_KEY })
  }

  return { starred, unstarred }
}

/**
 * Determines whether a topic is currently marked as favorite,
 * considering both the database's is_favorite status and local user overrides.
 */
export function isTopicFavorite(
  topicId: string,
  dbIsFavorite: boolean,
  overrides: FavoriteOverrides
): boolean {
  if (overrides.unstarred.has(topicId)) {
    return false
  }
  if (overrides.starred.has(topicId)) {
    return true
  }
  return dbIsFavorite
}

/**
 * Toggles the favorite status for a topic and persists the change.
 */
export async function toggleTopicFavorite(
  topicId: string,
  dbIsFavorite: boolean,
  currentOverrides: FavoriteOverrides
): Promise<FavoriteOverrides> {
  const currentlyActive = isTopicFavorite(topicId, dbIsFavorite, currentOverrides)
  const newStarred = new Set(currentOverrides.starred)
  const newUnstarred = new Set(currentOverrides.unstarred)

  if (currentlyActive) {
    // Un-starring:
    // If it was favorite in the DB, add an override to unstar it
    if (dbIsFavorite) {
      newUnstarred.add(topicId)
    }
    // If it had been locally starred, remove that local star
    newStarred.delete(topicId)
  } else {
    // Starring:
    // If it had been explicitly unstarred overriding DB, remove that override
    newUnstarred.delete(topicId)
    // If it was not favorite in the DB, add to local starred set
    if (!dbIsFavorite) {
      newStarred.add(topicId)
    }
  }

  await Promise.all([
    Preferences.set({ key: STARRED_KEY, value: JSON.stringify([...newStarred]) }),
    Preferences.set({ key: UNSTARRED_KEY, value: JSON.stringify([...newUnstarred]) }),
  ])

  return { starred: newStarred, unstarred: newUnstarred }
}
