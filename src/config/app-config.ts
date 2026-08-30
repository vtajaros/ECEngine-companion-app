/**
 * Shared configuration constants used across Companion-specific services.
 * These are NOT part of the verbatim desktop port (see src/lib/ for those)
 * — they are new constants introduced by the Companion app itself.
 */

/**
 * Filename used when storing the imported database in the app's private
 * Directory.Data.
 */
export const DB_PRIVATE_FILENAME = 'ecengine.sqlite'

/**
 * Error message string emitted by @capawesome/capacitor-file-picker when
 * the user closes the picker without selecting a file (RESULT_CANCELED in
 * Android). Confirmed from FilePickerPlugin.java:
 * ERROR_PICK_FILE_CANCELED = "pickFiles canceled."
 */
export const PICK_FILES_CANCELED_MSG = 'pickFiles canceled.'

/** Capacitor Preferences key used to store the user's Groq API key. */
export const GROQ_API_KEY_PREF = 'groq_api_key'

/** Groq API endpoint for chat completions. */
export const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

/** Model used for AI explanations. */
export const GROQ_MODEL = 'openai/gpt-oss-120b'
