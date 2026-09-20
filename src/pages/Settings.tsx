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
  Database,
} from 'lucide-react'
import { Preferences } from '@capacitor/preferences'
import {
  importImagesZip,
  getImportedImageCount,
  clearImportedImages,
  UserCancelledError as ImageUserCancelledError,
  InvalidImageZipError,
  ImportImagesProgress,
} from '../services/image-import.service'
import { importDatabaseFile, UserCancelledError as DbUserCancelledError } from '../services/import.service'
import { openDatabase } from '../services/db.service'
import { ConfirmModal } from '../components/ConfirmModal'
import { checkMissingImages, MissingImagesReport } from '../services/image-check.service'
import { GROQ_API_KEY_PREF } from '../config/app-config'
import { App as CapacitorApp } from '@capacitor/app'

interface GroqUsageSnapshot {
  limitRequests: string | null
  remainingRequests: string | null
  resetRequests: string | null
  limitTokens: string | null
  remainingTokens: string | null
  resetTokens: string | null
  fetchedAt: number
}

function formatMissingImagesReport(
  report: MissingImagesReport
): { message: string; type: 'success' | 'warning' } | null {
  const { referencedCount, missingCount, cardsAffected } = report
  if (referencedCount === 0) {
    return null
  }
  if (missingCount === 0) {
    return {
      message: `All ${referencedCount.toLocaleString()} referenced images are present.`,
      type: 'success',
    }
  }
  if (missingCount === referencedCount) {
    return {
      message: `${referencedCount.toLocaleString()} images are referenced by your cards, but no images are imported yet.`,
      type: 'warning',
    }
  }
  return {
    message: `${missingCount.toLocaleString()} of ${referencedCount.toLocaleString()} referenced images are missing (${cardsAffected.toLocaleString()} cards affected). Import your latest ece-images.zip.`,
    type: 'warning',
  }
}

export interface SettingsProps {
  onClose: () => void
  onDatabaseImported: () => void
}

export function Settings({ onClose, onDatabaseImported }: SettingsProps) {
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
  const [imageReport, setImageReport] = useState<{ message: string; type: 'success' | 'warning' } | null>(null)

  const [isReimporting, setIsReimporting] = useState(false)
  const [reimportError, setReimportError] = useState<string | null>(null)
  const [reimportReport, setReimportReport] = useState<{ message: string; type: 'success' | 'warning' } | null>(null)
  const [showReimportConfirm, setShowReimportConfirm] = useState(false)

  const refreshImageCount = async () => {
    const count = await getImportedImageCount()
    setImageCount(count)
  }

  useEffect(() => {
    Preferences.get({ key: GROQ_API_KEY_PREF }).then(({ value }) => {
      if (value && value.trim().length > 0) {
        setHasSavedKey(true)
        setApiKeyInput(value)
      } else {
        setHasSavedKey(false)
      }
    })

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Asynchronously fetch image count on mount
    refreshImageCount()
  }, [])

  const [usage, setUsage] = useState<GroqUsageSnapshot | null>(null)

  useEffect(() => {
    Preferences.get({ key: 'groqUsageSnapshot' }).then(({ value }) => {
      if (value) {
        try {
          const parsed = JSON.parse(value)
          if (parsed && (parsed.limitRequests || parsed.limitTokens)) {
            setUsage(parsed)
          }
        } catch {
          /* ignore */
        }
      }
    })
  }, [])

  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      onClose()
    })
    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {})
    }
  }, [onClose])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = apiKeyInput.trim()
    if (!trimmed) return

    setIsSaving(true)
    try {
      await Preferences.set({ key: GROQ_API_KEY_PREF, value: trimmed })
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
      await Preferences.remove({ key: GROQ_API_KEY_PREF })
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
    setImageReport(null)
    setImportProgress(null)

    try {
      const result = await importImagesZip((progress) => {
        setImportProgress(progress)
      })
      await refreshImageCount()
      setImageSuccess(
        `Imported ${result.importedCount} images (${result.unchangedCount} already present, ${result.skippedCount} skipped)`
      )
      setTimeout(() => setImageSuccess(null), 3500)

      try {
        const report = await checkMissingImages()
        console.info('[image-check]', report)
        setImageReport(formatMissingImagesReport(report))
      } catch (checkErr) {
        console.warn('[image-check] Failed to check missing images:', checkErr)
      }
    } catch (err: unknown) {
      if (err instanceof ImageUserCancelledError) {
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
    setImageReport(null)
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

  const handleReimportDatabase = async () => {
    setIsReimporting(true)
    setReimportError(null)
    setReimportReport(null)
    try {
      const resolvedPath = await importDatabaseFile()
      await openDatabase(resolvedPath)
      onDatabaseImported()
      await refreshImageCount()

      try {
        const report = await checkMissingImages()
        console.info('[image-check]', report)
        setReimportReport(formatMissingImagesReport(report))
      } catch (checkErr) {
        console.warn('[image-check] Failed to check missing images:', checkErr)
      }
    } catch (err: unknown) {
      if (err instanceof DbUserCancelledError) {
        return
      }
      setReimportError(err instanceof Error ? err.message : 'Failed to import database.')
    } finally {
      setIsReimporting(false)
    }
  }

  const confirmReimportDatabase = () => {
    setShowReimportConfirm(false)
    handleReimportDatabase()
  }

  return (
    <div className="flex h-full flex-col bg-neutral-950 text-neutral-50 overflow-y-auto">
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
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5 min-w-0 sm:flex-1">
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
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border shrink-0 whitespace-nowrap ${
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

          {hasSavedKey && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 sm:p-7 shadow-sm">
              <h2 className="text-base font-semibold text-neutral-100 mb-1">Usage Limits</h2>
              <p className="text-xs text-neutral-400 mb-4">Your plan's rate limits, from the most recent explanation request.</p>

              {!usage || (!usage.limitRequests && !usage.limitTokens) ? (
                <p className="text-xs text-neutral-500 italic">Usage data available after first request this session.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {usage.limitRequests && usage.remainingRequests && (
                    <div>
                      <div className="flex justify-between text-xs text-neutral-300 mb-1">
                        <span>Current request usage</span>
                        <span className="font-mono text-[#00ff41]">
                          {Number(usage.limitRequests) - Number(usage.remainingRequests)} / {usage.limitRequests}
                        </span>
                      </div>
                      <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-[#00ff41] h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                ((Number(usage.limitRequests) - Number(usage.remainingRequests)) /
                                  Number(usage.limitRequests)) *
                                  100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                      {usage.resetRequests && (
                        <p className="text-[10px] text-neutral-500 mt-1">Resets in {usage.resetRequests}</p>
                      )}
                    </div>
                  )}

                  {usage.limitTokens && usage.remainingTokens && (
                    <div>
                      <div className="flex justify-between text-xs text-neutral-300 mb-1">
                        <span>Token bandwidth (TPM)</span>
                        <span className="font-mono text-[#00ff41]">
                          {Number(usage.limitTokens) - Number(usage.remainingTokens)} / {usage.limitTokens}
                        </span>
                      </div>
                      <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-[#00ff41] h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                ((Number(usage.limitTokens) - Number(usage.remainingTokens)) /
                                  Number(usage.limitTokens)) *
                                  100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                      {usage.resetTokens && (
                        <p className="text-[10px] text-neutral-500 mt-1">Resets in {usage.resetTokens}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Question & Solution Images Card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 sm:p-7 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5 min-w-0 sm:flex-1">
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
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border shrink-0 whitespace-nowrap ${
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

              {imageReport && (
                <div
                  className={`text-xs font-mono flex items-start gap-1.5 animate-in fade-in ${
                    imageReport.type === 'warning' ? 'text-amber-400' : 'text-[#00ff41]'
                  }`}
                >
                  {imageReport.type === 'warning' ? (
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                  )}
                  <span>{imageReport.message}</span>
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

          {/* Database Card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 sm:p-7 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20">
                  <Database size={18} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-neutral-100">
                    Database
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Replace the currently loaded question bank
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={isReimporting}
                  onClick={() => setShowReimportConfirm(true)}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-5 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                    !isReimporting
                      ? 'bg-[#00ff41] text-neutral-950 hover:bg-[#00ff41]/90 shadow-[0_0_15px_rgba(0,255,65,0.25)]'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'
                  }`}
                >
                  {isReimporting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin text-[#00ff41]" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Reimport Database</span>
                    </>
                  )}
                </button>
              </div>

              {reimportReport && (
                <div
                  className={`text-xs font-mono flex items-start gap-1.5 animate-in fade-in ${
                    reimportReport.type === 'warning' ? 'text-amber-400' : 'text-[#00ff41]'
                  }`}
                >
                  {reimportReport.type === 'warning' ? (
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                  )}
                  <span>{reimportReport.message}</span>
                </div>
              )}

              {reimportError && (
                <div className="text-xs font-mono text-red-400 flex items-center gap-1.5 animate-in fade-in">
                  <AlertTriangle size={14} />
                  <span>{reimportError}</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      <ConfirmModal
        isOpen={showReimportConfirm}
        variant="danger"
        title="Replace Database?"
        message="This will replace your currently loaded question bank with a new database file. This cannot be undone."
        confirmLabel="Reimport"
        cancelLabel="Cancel"
        onConfirm={confirmReimportDatabase}
        onCancel={() => setShowReimportConfirm(false)}
      />
    </div>
  )
}
export default Settings
