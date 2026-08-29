import { Filesystem, Directory } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import { IMAGES_SUBDIR } from './image-import.service'

/**
 * Resolves an image filename from a card's data (e.g., '1730000000000_diagram.webp')
 * to a WebView-displayable file URL via Capacitor.convertFileSrc().
 * Returns null if the filename is empty or the file does not exist in private storage.
 */
export async function resolveImageSrc(filename: string | undefined | null): Promise<string | null> {
  if (!filename || filename.trim() === '') return null
  const path = `${IMAGES_SUBDIR}/${filename.trim()}`
  try {
    // Confirm file exists in Directory.Data before constructing URL
    await Filesystem.stat({ path, directory: Directory.Data })
    const uriResult = await Filesystem.getUri({ path, directory: Directory.Data })
    return Capacitor.convertFileSrc(uriResult.uri)
  } catch {
    return null
  }
}
