import path from 'node:path'
import db from '@adonisjs/lucid/services/db'

/**
 * Files in a library folder that are not a movie's or episode's main file and
 * must not be taken for one: versions made from it, and Hamster's own work
 * files that sit in the library for a moment while they are written.
 *
 * Without this, the library scan matched `Show - S01E01 - Pilot - Mobile.mkv`
 * to S01E01 and recorded it as a second file of the episode (a movie folder
 * the same way when its version was the largest file). With two file records,
 * whichever one the database returned first was "the" file — and "keep only
 * this version" could delete the version instead of the original.
 */
export interface LibraryFileFilter {
  /** True for a version or work file; `relativePath` is relative to its root folder. */
  isNotMainFile(relativePath: string): boolean
}

/** `Movie.mkv.hamster-prune.mkv` from subtitle pruning; `.partial` from copies. */
const WORK_FILE = /\.hamster-[a-z]+\.[^.]+$|\.partial$/i

/**
 * Build the filter from what is recorded: every version's path, and every
 * label a version file can end in (`… - Mobile.mkv`), which also covers a
 * version moved into place a moment before its record says so.
 */
export async function libraryFileFilter(): Promise<LibraryFileFilter> {
  const [paths, labels] = await Promise.all([
    db.from('media_versions').whereNotNull('relative_path').select('relative_path'),
    db
      .from('version_profiles')
      .select('label')
      .union((query) => query.from('media_versions').select('label')),
  ])
  return createLibraryFileFilter(
    paths.map((row) => row.relative_path as string),
    labels.map((row) => row.label as string)
  )
}

export function createLibraryFileFilter(
  versionPaths: string[],
  labels: string[]
): LibraryFileFilter {
  const known = new Set(versionPaths.map((p) => path.normalize(p)))
  const suffixes = [...new Set(labels)].map((label) => ` - ${label}.mkv`.toLowerCase())
  return {
    isNotMainFile(relativePath: string) {
      if (known.has(path.normalize(relativePath))) return true
      const name = path.basename(relativePath)
      if (WORK_FILE.test(name)) return true
      const lower = name.toLowerCase()
      return suffixes.some((suffix) => lower.endsWith(suffix))
    },
  }
}
