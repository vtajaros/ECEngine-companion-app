import { FilePicker } from '@capawesome/capacitor-file-picker'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { unzipSync } from 'fflate'
import { UserCancelledError } from './import.service'
import { PICK_FILES_CANCELED_MSG } from '../config/app-config'

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
 * and writes new or changed image files flat to Directory.Data/ece-images.
 *
 * @throws {UserCancelledError} if the user dismisses the file picker.
 * @throws {InvalidImageZipError} if the zip is corrupt or has 0 valid image files.
 */
export async function importImagesZip(
  onProgress?: (progress: ImportImagesProgress) => void
): Promise<{ importedCount: number; skippedCount: number; unchangedCount: number }> {
  const tTotalStart = performance.now()

  // ── Step 1: Pick zip file with readData: true ───────────────────────────────
  const tPickStart = performance.now()
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
  const tPickEnd = performance.now()

  // ── Step 2: Decode base64 to Uint8Array ─────────────────────────────────────
  const tDecodeStart = performance.now()
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
  const tDecodeEnd = performance.now()

  // ── Step 3: Scan existing folder in Directory.Data ─────────────────────────
  const tScanStart = performance.now()
  const existingFiles = new Map<string, number>()
  try {
    const res = await Filesystem.readdir({
      path: IMAGES_SUBDIR,
      directory: Directory.Data,
    })
    for (const f of res.files) {
      if (f.type === 'file') {
        existingFiles.set(f.name, f.size)
      }
    }
  } catch {
    // folder may not exist yet → treat as empty
  }
  const tScanEnd = performance.now()

  // ── Step 4: Unzip with fflate filter ───────────────────────────────────────
  const tUnzipStart = performance.now()
  let skippedCount = 0
  let unchangedCount = 0
  let entries: Record<string, Uint8Array>

  try {
    entries = unzipSync(bytes, {
      filter(file) {
        // Skip directories and zero-length items
        if (file.name.endsWith('/') || file.originalSize === 0) {
          skippedCount++
          return false
        }

        // Skip macOS metadata and hidden files
        if (
          file.name.startsWith('__MACOSX/') ||
          file.name.includes('/.DS_Store') ||
          file.name === '.DS_Store'
        ) {
          skippedCount++
          return false
        }

        // Extract basename (guard against zip-slip / folder nesting)
        const basename = file.name.split('/').pop() || file.name
        if (!basename || basename.startsWith('.')) {
          skippedCount++
          return false
        }

        const dotIndex = basename.lastIndexOf('.')
        if (dotIndex === -1) {
          skippedCount++
          return false
        }

        const ext = basename.slice(dotIndex).toLowerCase()
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          skippedCount++
          return false
        }

        // Check if identical file already exists on disk
        const existingSize = existingFiles.get(basename)
        if (existingSize !== undefined && existingSize === file.originalSize) {
          unchangedCount++
          return false
        }

        return true
      },
    })
  } catch {
    throw new InvalidImageZipError('Failed to extract zip archive.')
  }
  const tUnzipEnd = performance.now()

  // ── Step 5: Ensure destination directory exists in Directory.Data ──────────
  try {
    await Filesystem.mkdir({
      path: IMAGES_SUBDIR,
      directory: Directory.Data,
      recursive: true,
    })
  } catch {
    // Directory already exists
  }

  // ── Step 6: Process and write entries ───────────────────────────────────────
  const tWriteStart = performance.now()
  const entryKeys = Object.keys(entries)
  const totalEntries = entryKeys.length
  let importedCount = 0
  let processed = 0

  for (const entryPath of entryKeys) {
    const entryBytes = entries[entryPath]
    const basename = entryPath.split('/').pop() || entryPath

    // Write file to Directory.Data/ece-images/<basename>
    await Filesystem.writeFile({
      path: `${IMAGES_SUBDIR}/${basename}`,
      directory: Directory.Data,
      data: uint8ToBase64(entryBytes),
    })

    importedCount++
    processed++

    onProgress?.({
      processed,
      total: totalEntries,
      currentFilename: basename,
    })

    // Yield to the event loop every 8 writes instead of after every write
    if (processed % 8 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  const tWriteEnd = performance.now()

  // Empty-result rule: throw ONLY when written + unchanged === 0
  if (importedCount + unchangedCount === 0) {
    throw new InvalidImageZipError('Zip contained no valid image files (.png, .jpg, .jpeg, .webp).')
  }

  const tTotalEnd = performance.now()

  console.info('[image-import] timings (ms)', {
    pickAndRead: Math.round(tPickEnd - tPickStart),
    decode: Math.round(tDecodeEnd - tDecodeStart),
    scanExisting: Math.round(tScanEnd - tScanStart),
    unzip: Math.round(tUnzipEnd - tUnzipStart),
    write: Math.round(tWriteEnd - tWriteStart),
    total: Math.round(tTotalEnd - tTotalStart),
    written: importedCount,
    unchanged: unchangedCount,
    skipped: skippedCount,
  })

  return { importedCount, skippedCount, unchangedCount }
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
