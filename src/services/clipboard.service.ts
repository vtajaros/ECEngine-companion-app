import { Clipboard } from '@capacitor/clipboard'

/**
 * Copies text to the system clipboard using Capacitor Native Android Clipboard,
 * falling back to navigator.clipboard and standard DOM execCommand if needed.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.write({ string: text })
    return true
  } catch (err) {
    console.warn('[clipboardService] Capacitor native clipboard failed, trying fallback:', err)
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (err) {
    console.warn('[clipboardService] navigator.clipboard failed, trying execCommand:', err)
  }

  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    textArea.setAttribute('readonly', '')
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch (err) {
    console.error('[clipboardService] All clipboard copy methods failed:', err)
    return false
  }
}
