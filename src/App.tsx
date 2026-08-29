import { useState } from 'react'
import { importDatabaseFile, UserCancelledError } from './services/import.service'
import { openDatabase, dbService } from './services/db.service'

/**
 * TEMPORARY THROWAWAY DEBUG UI
 *
 * Used to verify importDatabaseFile() end-to-end on the emulator:
 *   1. Native file picker opens
 *   2. File is copied to Directory.Data via copyFile()
 *   3. openDatabase(path) opens the imported SQLite database
 *   4. dbService.getTopicsWithCardCounts() reads topics count
 *
 * This will be reverted once verified.
 */
function App() {
  const [status, setStatus] = useState<string>('Ready to test database import.')
  const [dbPath, setDbPath] = useState<string | null>(null)
  const [topicCount, setTopicCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  const handleImport = async () => {
    setLoading(true)
    setError(null)
    setDbPath(null)
    setTopicCount(null)
    setStatus('Opening file picker...')

    try {
      const resolvedPath = await importDatabaseFile()
      setDbPath(resolvedPath)
      setStatus('File copied! Opening database...')

      await openDatabase(resolvedPath)
      setStatus('Database opened! Fetching topics count...')

      const topics = await dbService.getTopicsWithCardCounts()
      setTopicCount(topics.length)
      setStatus('Import and verification successful!')
    } catch (err: unknown) {
      if (err instanceof UserCancelledError) {
        setStatus('Import cancelled')
      } else {
        const errorMsg =
          err instanceof Error
            ? `${err.name}: ${err.message}\n${err.stack || ''}`
            : String(err)
        setError(errorMsg)
        setStatus('Import failed!')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 p-6 text-slate-50">
      <h1 className="text-3xl font-semibold tracking-tight">ECEngine Companion</h1>
      <p className="mt-1 text-xs font-mono text-amber-400">[Temporary Import Test Harness]</p>

      <div className="mt-8 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={handleImport}
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-md hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Importing...' : 'Import Test DB'}
        </button>
      </div>

      <div className="mt-8 w-full max-w-lg rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm shadow-lg">
        <div className="font-semibold text-slate-300">Status:</div>
        <div className="mt-1 text-slate-400">{status}</div>

        {dbPath && (
          <div className="mt-4">
            <div className="font-semibold text-slate-300">Resolved Path:</div>
            <div className="mt-1 break-all rounded bg-slate-950 p-2 font-mono text-xs text-emerald-400">
              {dbPath}
            </div>
          </div>
        )}

        {topicCount !== null && (
          <div className="mt-4">
            <div className="font-semibold text-slate-300">Topic Count:</div>
            <div className="mt-1 font-mono text-base font-bold text-emerald-400">
              {topicCount} topics found
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded border border-red-800 bg-red-950/60 p-3 font-mono text-xs whitespace-pre-wrap text-red-300 overflow-x-auto">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
