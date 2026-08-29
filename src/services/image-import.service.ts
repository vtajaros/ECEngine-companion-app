import { FilePicker } from '@capawesome/capacitor-file-picker'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { unzipSync } from 'fflate'
import { UserCancelledError } from './import.service'

export { UserCancelledError }

/**
 * Thrown when the picked file is not a valid zip archive or contains no valid images.
 */
export class InvalidImageZipError extends Error {
  constructor(message = 'The selected file is not a valid zip archive.') {
    super(message)
    this.name = 'InvalidImageZipError'
  }
}

/** Destination subfolder inside Directory.Data where images are stored flat. */
export const IMAGES_SUBDIR = 'ece-images'

/** Supported image extensions (case-insensitive). */
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

const PICK_FILES_CANCELED_MSG = 'pickFiles canceled.'

export interface ImportImagesProgress {
  processed: number
  total: number
  currentFilename: string
}

/**
 * Converts a Uint8Array into a base64 string in chunks to prevent call-stack overflow on large files.
 */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/**
 * Prompts user to pick a .zip archive of images, unzips client-side,
 * and writes all valid image files flat to Directory.Data/ece-images.
 *
 * @throws {UserCancelledError} if the user dismisses the file picker.
 * @throws {InvalidImageZipError} if the zip is corrupt or has 0 valid image files.
 */
export async function importImagesZip(
  onProgress?: (progress: ImportImagesProgress) => void
): Promise<{ importedCount: number; skippedCount: number }> {
  // ── Step 1: Pick zip file with readData: true ───────────────────────────────
  let base64Data: string
  try {
    const result = await FilePicker.pickFiles({
      limit: 1,
      types: [
        'application/zip',
        'application/x-zip-compressed',
        'application/octet-stream',
      ],
      readData: true,
    })

    const file = result.files[0]
    if (!file || !file.data) {
      throw new Error('File picker returned no file data.')
    }
    base64Data = file.data
  } catch (err: unknown) {
    if (err instanceof Error && err.message === PICK_FILES_CANCELED_MSG) {
      throw new UserCancelledError()
    }
    throw err
  }

  // ── Step 2: Decode base64 to Uint8Array ─────────────────────────────────────
  let bytes: Uint8Array
  try {
    const binaryString = atob(base64Data)
    bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
  } catch {
    throw new InvalidImageZipError('Failed to decode zip data.')
  }

  // ── Step 3: Unzip with fflate ───────────────────────────────────────────────
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes)
  } catch {
    throw new InvalidImageZipError('Failed to extract zip archive.')
  }

  // ── Step 4: Ensure destination directory exists in Directory.Data ──────────
  try {
    await Filesystem.mkdir({
      path: IMAGES_SUBDIR,
      directory: Directory.Data,
      recursive: true,
    })
  } catch {
    // Directory already exists
  }

  // ── Step 5: Process and write entries ───────────────────────────────────────
  const entryKeys = Object.keys(entries)
  const totalEntries = entryKeys.length
  let importedCount = 0
  let skippedCount = 0
  let processed = 0

  for (const entryPath of entryKeys) {
    processed++
    const entryBytes = entries[entryPath]

    // Skip directories and zero-length items
    if (entryPath.endsWith('/') || !entryBytes || entryBytes.length === 0) {
      skippedCount++
      continue
    }

    // Skip macOS metadata and hidden files
    if (entryPath.startsWith('__MACOSX/') || entryPath.includes('/.DS_Store') || entryPath === '.DS_Store') {
      skippedCount++
      continue
    }

    // Extract basename (guard against zip-slip / folder nesting)
    const basename = entryPath.split('/').pop() || entryPath
    if (!basename || basename.startsWith('.')) {
      skippedCount++
      continue
    }

    const dotIndex = basename.lastIndexOf('.')
    if (dotIndex === -1) {
      skippedCount++
      continue
    }

    const ext = basename.slice(dotIndex).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      skippedCount++
      continue
    }

    // Write file to Directory.Data/ece-images/<basename>
    await Filesystem.writeFile({
      path: `${IMAGES_SUBDIR}/${basename}`,
      directory: Directory.Data,
      data: uint8ToBase64(entryBytes),
    })

    importedCount++

    onProgress?.({
      processed,
      total: totalEntries,
      currentFilename: basename,
    })

    // Yield to the event loop to allow UI to repaint progress updates
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  if (importedCount === 0) {
    throw new InvalidImageZipError('Zip contained no valid image files (.png, .jpg, .jpeg, .webp).')
  }

  return { importedCount, skippedCount }
}

/**
 * Returns the count of imported image files currently in Directory.Data/ece-images.
 */
export async function getImportedImageCount(): Promise<number> {
  try {
    const res = await Filesystem.readdir({
      path: IMAGES_SUBDIR,
      directory: Directory.Data,
    })
    return res.files.length
  } catch {
    return 0
  }
}

/**
 * Removes all imported images in Directory.Data/ece-images.
 */
export async function clearImportedImages(): Promise<void> {
  try {
    await Filesystem.rmdir({
      path: IMAGES_SUBDIR,
      directory: Directory.Data,
      recursive: true,
    })
  } catch (err) {
    console.warn('[image-import] Error clearing images directory:', err)
  }
}
