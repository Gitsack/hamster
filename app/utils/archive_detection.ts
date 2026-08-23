import * as fs from 'node:fs/promises'
import * as path from 'node:path'

/**
 * Archive parts a download client is expected to extract before we import.
 * Covers old-style multipart RAR (.r00-.r99), new-style (.part01.rar) and the
 * common single-archive formats.
 */
const ARCHIVE_EXTENSIONS = /\.(rar|zip|7z|tar|gz|bz2|xz|r\d{2,3})$/i

/** Message used when a download finished but its archives were never extracted. */
export const NOT_UNPACKED_ERROR =
  'Download not unpacked - archives present but no media files. Waiting for the download client to extract.'

/**
 * Whether the folder still holds archive files.
 *
 * "No media files found" has two very different causes: the release is junk, or
 * the download client simply has not extracted it yet. Only the first is the
 * release's fault, so they must not be reported — or blacklisted — the same way.
 */
export async function hasPendingArchives(dir: string, depth = 3): Promise<boolean> {
  if (depth < 0) return false

  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return false
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isFile() && ARCHIVE_EXTENSIONS.test(entry.name)) return true
    if (entry.isDirectory() && (await hasPendingArchives(full, depth - 1))) return true
  }

  return false
}

/**
 * The error to report when an import found no usable media, distinguishing an
 * unextracted download from a genuinely empty or mislabelled one.
 */
export async function describeMissingMedia(dir: string, kind: 'video' | 'audio'): Promise<string> {
  if (await hasPendingArchives(dir)) return NOT_UNPACKED_ERROR
  return `No ${kind} files found in download`
}
