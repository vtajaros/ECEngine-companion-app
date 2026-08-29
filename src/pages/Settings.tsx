import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Key,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Save,
  Image as ImageIcon,
  Upload,
  Trash2,
  FolderArchive,
  RefreshCw,
} from 'lucide-react'
import { Preferences } from '@capacitor/preferences'
import {
  importImagesZip,
  getImportedImageCount,
  clearImportedImages,
  UserCancelledError,
  InvalidImageZipError,
  ImportImagesProgress,
} from '../services/image-import.service'

export interface SettingsProps {
  onClose: () => void
}

export function Settings({ onClose }: SettingsProps) {
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [hasSavedKey, setHasSavedKey] = useState<boolean | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Images state
  const [imageCount, setImageCount] = useState<number | null>(null)
  const [isImportingImages, setIsImportingImages] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportImagesProgress | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageSuccess, setImageSuccess] = useState<string | null>(null)

  const refreshImageCount = async () => {
    const count = await getImportedImageCount()
    setImageCount(count)
  }

  useEffect(() => {
    Preferences.get({ key: 'groq_api_key' }).then(({ value }) => {
      if (value && value.trim().length > 0) {
        setHasSavedKey(true)
        setApiKeyInput(value)
      } else {
        setHasSavedKey(false)
      }
    })

    refreshImageCount()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = apiKeyInput.trim()
    if (!trimmed) return

    setIsSaving(true)
    try {
      await Preferences.set({ key: 'groq_api_key', value: trimmed })
      setHasSavedKey(true)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err) {
      console.error('Failed to save Groq API key:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClear = async () => {
    setIsSaving(true)
    try {
      await Preferences.remove({ key: 'groq_api_key' })
      setApiKeyInput('')
      setHasSavedKey(false)
    } catch (err) {
      console.error('Failed to remove Groq API key:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleImportImages = async () => {
    setIsImportingImages(true)
    setImageError(null)
    setImageSuccess(null)
    setImportProgress(null)

    try {
      const result = await importImagesZip((progress) => {
        setImportProgress(progress)
      })
      await refreshImageCount()
      setImageSuccess(`Imported ${result.importedCount} images (${result.skippedCount} skipped)`)
      setTimeout(() => setImageSuccess(null), 3500)
    } catch (err: unknown) {
      if (err instanceof UserCancelledError) {
        // User closed picker; ignore
        return
      }
      if (err instanceof InvalidImageZipError) {
        setImageError(err.message)
      } else {
        setImageError(err instanceof Error ? err.message : 'Failed to import images.')
      }
    } finally {
      setIsImportingImages(false)
      setImportProgress(null)
    }
  }

  const handleClearImages = async () => {
    if (!window.confirm('Are you sure you want to delete all imported images?')) {
      return
    }

    setIsImportingImages(true)
    try {
      await clearImportedImages()
      await refreshImageCount()
      setImageSuccess('Cleared all imported images.')
      setTimeout(() => setImageSuccess(null), 2500)
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to clear images.')
    } finally {
      setIsImportingImages(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 text-neutral-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200 active:scale-95 transition-all"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-sm font-semibold tracking-tight text-neutral-100 uppercase">
              Settings
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl flex flex-col gap-6">
          {/* Groq API Key Card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 sm:p-7 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20">
                  <Key size={18} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-neutral-100">
                    Groq API Key
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Powers instant AI explanations with GPT-OSS-120B
                  </p>
                </div>
              </div>

              {hasSavedKey !== null && (
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${
                    hasSavedKey
                      ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {hasSavedKey ? (
                    <>
                      <CheckCircle2 size={13} />
                      <span>API key configured ✓</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={13} />
                      <span>No API key set</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="groq-key-input"
                  className="block text-xs font-medium text-neutral-300 mb-1.5 uppercase tracking-wider font-mono"
                >
                  API Key
                </label>
                <input
                  id="groq-key-input"
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="gsk_..."
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 font-mono text-sm text-neutral-100 placeholder-neutral-600 focus:border-[#00ff41] focus:outline-none focus:ring-1 focus:ring-[#00ff41] transition-all"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!apiKeyInput.trim() || isSaving}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-5 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                    apiKeyInput.trim() && !isSaving
                      ? 'bg-[#00ff41] text-neutral-950 hover:bg-[#00ff41]/90 shadow-[0_0_15px_rgba(0,255,65,0.25)]'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'
                  }`}
                >
                  <Save size={14} />
                  <span>{isSaving ? 'Saving...' : 'Save Key'}</span>
                </button>

                {hasSavedKey && (
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={isSaving}
                    className="rounded-xl border border-neutral-800 bg-neutral-950 py-2.5 px-4 text-xs font-medium text-neutral-400 hover:text-red-400 hover:border-red-500/40 active:scale-95 transition-all"
                  >
                    Clear Key
                  </button>
                )}

                {saveSuccess && (
                  <span className="text-xs font-mono text-[#00ff41] flex items-center gap-1 animate-in fade-in">
                    <CheckCircle2 size={14} /> Saved successfully
                  </span>
                )}
              </div>
            </form>

            <div className="mt-5 pt-4 border-t border-neutral-800/80 text-xs text-neutral-400 leading-relaxed">
              Required for AI explanations. Get a free key at{' '}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#00ff41] hover:underline font-mono"
              >
                <span>console.groq.com/keys</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* Question & Solution Images Card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 sm:p-7 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20">
                  <ImageIcon size={18} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-neutral-100">
                    Question & Solution Images
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Diagrams, schematics, and solution illustrations
                  </p>
                </div>
              </div>

              {imageCount !== null && (
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border ${
                    imageCount > 0
                      ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/30'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}
                >
                  {imageCount > 0 ? (
                    <>
                      <CheckCircle2 size={13} />
                      <span>{imageCount} image{imageCount === 1 ? '' : 's'}</span>
                    </>
                  ) : (
                    <span>No images</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={isImportingImages}
                  onClick={handleImportImages}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-5 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                    !isImportingImages
                      ? 'bg-[#00ff41] text-neutral-950 hover:bg-[#00ff41]/90 shadow-[0_0_15px_rgba(0,255,65,0.25)]'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'
                  }`}
                >
                  {isImportingImages ? (
                    <>
                      <RefreshCw size={14} className="animate-spin text-[#00ff41]" />
                      <span>
                        {importProgress && importProgress.total > 0
                          ? `Importing ${importProgress.processed}/${importProgress.total}...`
                          : 'Importing...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Import Images (.zip)</span>
                    </>
                  )}
                </button>

                {imageCount !== null && imageCount > 0 && !isImportingImages && (
                  <button
                    type="button"
                    onClick={handleClearImages}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-950 py-2.5 px-4 text-xs font-medium text-neutral-400 hover:text-red-400 hover:border-red-500/40 active:scale-95 transition-all"
                  >
                    <Trash2 size={13} />
                    <span>Clear Images</span>
                  </button>
                )}
              </div>

              {imageSuccess && (
                <div className="text-xs font-mono text-[#00ff41] flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 size={14} />
                  <span>{imageSuccess}</span>
                </div>
              )}

              {imageError && (
                <div className="text-xs font-mono text-red-400 flex items-center gap-1.5 animate-in fade-in">
                  <AlertTriangle size={14} />
                  <span>{imageError}</span>
                </div>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-neutral-800/80 text-xs text-neutral-400 leading-relaxed flex items-start gap-2">
              <FolderArchive size={14} className="shrink-0 mt-0.5 text-neutral-500" />
              <span>
                Pick a <span className="font-mono text-neutral-300">.zip</span> archive of desktop's{' '}
                <span className="font-mono text-neutral-300">ece-images</span> folder. Basenames are extracted automatically to match filenames referenced in question cards.
              </span>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
export default Settings
