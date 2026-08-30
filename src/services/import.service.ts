/**
 * src/services/import.service.ts
 *
 * Provides importDatabaseFile(): opens the native file picker, copies the selected
 * SQLite file into the app's private storage (Directory.Data), validates its magic
 * header, and returns the resolved absolute path ready to hand to db.service.ts's
 * openDatabase().
 *
 * ── Plugin choice: @capawesome/capacitor-file-picker ──────────────────────────
 * Chosen over alternatives for the following reasons:
 *
 *   1. Uses Android's Storage Access Framework (ACTION_GET_CONTENT) — this is the
 *      correct, scoped-storage-compliant way to let the user pick any file from
 *      any location (Downloads, Google Drive, Files app, etc.) on Android 10+.
 *      The OS handles the permission grant; we never touch /sdcard/ directly.
 *
 *   2. Provides FilePicker.copyFile() that accepts a content:// URI as the `from`
 *      argument and copies via ContentResolver.openInputStream(), so we never need
 *      to resolve the content URI to a real path ourselves.
 *
 *   3. Cancellation is a first-class case: the plugin rejects with the message
 *      "pickFiles canceled." so we can detect it without relying on error codes.
 *
 * ── Known uncertainties / caveats (verified from Android source) ──────────────
 *
 *   A. path is a content:// URI string on Android (uri.toString() in FilePicker.java
 *      line 53-54), NOT a bare filesystem path. The PickedFile.path TypeScript type
 *      is string | undefined, but Android always provides it for ACTION_GET_CONTENT.
 *      We guard against undefined and throw a clear error.
 *
 *   B. MIME type filtering (types option) only applies when limit === 1 (Android
 *      source, FilePickerPlugin.java line 105). SQLite files have no single agreed
 *      MIME type; common values are:
 *        - application/x-sqlite3
 *        - application/vnd.sqlite3
 *        - application/octet-stream (most file managers use this for unknown types)
 *      We pass all three with limit: 1. The picker may still show all files
 *      depending on the file manager app — users must select the correct file.
 *
 *   C. FilePicker.copyFile({ from, to }) expects `to` to be a path resolvable via
 *      ContentResolver.openOutputStream() (FilePickerPlugin.java line 81, 84).
 *      A bare absolute path to a file inside the app's private storage is passed
 *      through getUriByPath() which wraps it in a FileProvider URI on Android.
 *      We use Filesystem.getUri() to get the canonical file:// URI, then pass
 *      its path (with file:// stripped) as the `to` argument. This path is
 *      inside the app sandbox and is always writable without permissions.
 *
 *   D. Cancellation rejection message is exactly "pickFiles canceled." — confirmed
 *      in FilePickerPlugin.java line 43 (ERROR_PICK_FILE_CANCELED constant).
 *      We match on this string. Any other rejection message is a real error.
 */

import { FilePicker } from '@capawesome/capacitor-file-picker'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { DB_PRIVATE_FILENAME, PICK_FILES_CANCELED_MSG } from '../config/app-config'

/** Sentinel error thrown when the user dismisses the file picker without selecting a file. */
export class UserCancelledError extends Error {
  constructor() {
    super('User cancelled the file picker.')
    this.name = 'UserCancelledError'
  }
}

/** Thrown when the picked file is not a valid SQLite database (magic header mismatch). */
export class InvalidDatabaseFileError extends Error {
  constructor() {
    super('The selected file is not a valid SQLite database.')
    this.name = 'InvalidDatabaseFileError'
  }
}

/**
 * Expected 16-byte magic header at the beginning of all standard SQLite 3 database files.
 * ASCII string "SQLite format 3\0".
 */
const SQLITE_MAGIC_HEADER = 'SQLite format 3\0'

/**
 * Opens the native file picker, copies the selected SQLite database file into the
 * app's private storage (Directory.Data), validates its magic header, and returns
 * the absolute path to use with db.service.ts's openDatabase().
 *
 * @throws {UserCancelledError} if the user dismisses the picker without selecting a file.
 * @throws {InvalidDatabaseFileError} if the picked file does not begin with the SQLite magic header.
 * @throws {Error} if no file path was returned by the picker, or if any other
 *                 step (copy, getUri) fails.
 * @returns Absolute path to the database in the app's private storage, with any
 *          "file://" prefix stripped (required by @capacitor-community/sqlite's
 *          createNCConnection on Android).
 */
export async function importDatabaseFile(): Promise<string> {
  // ── Step 1: Open the native file picker ──────────────────────────────────────
  //
  // We set limit: 1 (single selection) and pass the three MIME types under which
  // SQLite files are commonly served. Note: on Android, EXTRA_MIME_TYPES is only
  // applied when limit === 1 (confirmed from FilePickerPlugin.java source). The
  // picker may still show all files if the user's file manager doesn't filter by
  // MIME type, so this is advisory only.
  let pickedPath: string

  try {
    const result = await FilePicker.pickFiles({
      limit: 1,
      types: [
        'application/x-sqlite3',
        'application/vnd.sqlite3',
        'application/octet-stream',
      ],
      readData: false, // Never read large binary files into memory as base64
    })

    const file = result.files[0]
    if (!file) {
      // Resolved successfully but empty files array — shouldn't happen on Android
      // with RESULT_OK, but guard defensively.
      throw new Error('File picker returned no files.')
    }

    // On Android, path is a content:// URI string (confirmed from source).
    // The TypeScript type allows undefined, so we guard here.
    if (!file.path) {
      throw new Error(
        `File picker returned a file ("${file.name}") but no path/URI. ` +
          `This may happen on Web (where only Blob is available) or an unexpected Android edge case.`
      )
    }

    pickedPath = file.path
  } catch (err: unknown) {
    // Distinguish user cancellation from real failures.
    // The plugin rejects with the string "pickFiles canceled." (confirmed in source).
    if (
      err instanceof Error &&
      err.message === PICK_FILES_CANCELED_MSG
    ) {
      throw new UserCancelledError()
    }
    // Re-throw any other error as-is (plugin failure, permission denied, etc.)
    throw err
  }

  // ── Step 2: Resolve the destination path inside the app's private storage ────
  //
  // Filesystem.getUri() returns a file:// URI for Directory.Data files.
  // Example: "file:///data/user/0/com.ecengine.companion/files/ecengine.sqlite"
  // We strip the "file://" prefix because @capacitor-community/sqlite's
  // createNCConnection() on Android calls new java.io.File(path) and expects
  // a bare absolute path (confirmed during prior debug verification session).
  const destUriResult = await Filesystem.getUri({
    path: DB_PRIVATE_FILENAME,
    directory: Directory.Data,
  })
  const destUri = destUriResult.uri
  const destAbsolutePath = destUri.startsWith('file://') ? destUri.slice(7) : destUri

  // ── Step 3: Copy the picked file into private storage ────────────────────────
  //
  // FilePicker.copyFile({ from, to }) on Android:
  //   - from: content:// URI string → passed to getUriByPath() which detects the
  //           "content" scheme and returns it as-is for ContentResolver.openInputStream().
  //   - to:   bare absolute path → passed to getUriByPath() which detects no
  //           scheme and wraps it via FileProvider.getUriForFile(), then
  //           ContentResolver.openOutputStream() writes to it.
  // overwrite: true (default) ensures we always replace any pre-existing file.
  await FilePicker.copyFile({
    from: pickedPath,
    to: destAbsolutePath,
    overwrite: true,
  })

  // ── Step 4: Validate SQLite 3 magic header ──────────────────────────────────
  //
  // MIME filtering in the picker is advisory only and not strictly enforced by all
  // Android file managers. Validating the 16-byte SQLite header ("SQLite format 3\0")
  // acts as the real validation gate before handing the path over to openDatabase().
  // If validation fails, we clean up the invalid file from private storage immediately
  // to avoid leaving a corrupt/stale file behind.
  let isValidSqlite = false
  try {
    const fileData = await Filesystem.readFile({
      path: DB_PRIVATE_FILENAME,
      directory: Directory.Data,
    })
    const base64 = typeof fileData.data === 'string' ? fileData.data : ''
    // 24 base64 characters are sufficient to decode the first 16-18 bytes
    const binaryString = atob(base64.slice(0, 24))
    const header = binaryString.slice(0, 16)
    if (header === SQLITE_MAGIC_HEADER) {
      isValidSqlite = true
    }
  } catch {
    isValidSqlite = false
  }

  if (!isValidSqlite) {
    try {
      await Filesystem.deleteFile({
        path: DB_PRIVATE_FILENAME,
        directory: Directory.Data,
      })
    } catch (cleanupErr) {
      console.warn('[import] Failed to clean up invalid database file:', cleanupErr)
    }
    throw new InvalidDatabaseFileError()
  }

  // ── Step 5: Return the validated destination path for openDatabase() ─────────
  return destAbsolutePath
}
