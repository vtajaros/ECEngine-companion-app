import { Filesystem, Directory } from '@capacitor/filesystem'
import { dbService } from './db.service'
import { IMAGES_SUBDIR } from './image-import.service'

export interface MissingImagesReport {
  /** Unique image filenames referenced by cards. */
  referencedCount: number
  /** Unique referenced filenames with no file on the device. */
  missingCount: number
  /** Cards that have at least one missing image. */
  cardsAffected: number
  /** Up to 10 missing filenames, for diagnostics. */
  sampleMissing: string[]
}

async function listExistingImageNames(): Promise<Set<string>> {
  try {
    const res = await Filesystem.readdir({ path: IMAGES_SUBDIR, directory: Directory.Data })
    return new Set(res.files.map((f) => f.name))
  } catch {
    // Folder does not exist yet: nothing imported.
    return new Set()
  }
}

/**
 * Compares every image filename referenced by cards in the open database against the
 * files present in Directory.Data/ece-images. Read-only. Throws if the DB is not open.
 */
export async function checkMissingImages(): Promise<MissingImagesReport> {
  const [refs, existing] = await Promise.all([
    dbService.getImageReferences(),
    listExistingImageNames(),
  ])
  const referenced = new Set<string>()
  const missing = new Set<string>()
  const affectedCards = new Set<string>()
  for (const { cardId, filename } of refs) {
    referenced.add(filename)
    if (!existing.has(filename)) {
      missing.add(filename)
      affectedCards.add(cardId)
    }
  }
  return {
    referencedCount: referenced.size,
    missingCount: missing.size,
    cardsAffected: affectedCards.size,
    sampleMissing: [...missing].slice(0, 10),
  }
}
