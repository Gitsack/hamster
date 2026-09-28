/**
 * How much a failed download deserves the operator's attention.
 *
 *   error   — nothing will fix this without a person: a configuration problem,
 *             an unknown media type, a failure we have no name for.
 *   warning — routine. The release itself was bad (incomplete on usenet,
 *             corrupt, not the media it claimed to be) or the network hiccuped.
 *             Hamster blacklists the release or retries, and the item stays
 *             wanted, so the next search picks another candidate.
 *   info    — no loss at all: the item is already in the library (the failure
 *             was a duplicate or an upgrade attempt), or the library already
 *             holds a bigger file than the one that failed to replace it.
 *
 * Severity is computed at read time, not stored: a failure stops mattering the
 * moment its item reaches the library by another route.
 */
export type FailureSeverity = 'error' | 'warning' | 'info'

/** Nothing was lost: the library copy is already the better one. */
const INFO_PATTERNS = ['existing file is larger']

/**
 * Failures that recur no matter how Hamster is configured. Lower-case
 * substrings of the error message. Deliberately absent: path mapping, mount,
 * permission and disk-space errors — those persist until someone acts.
 */
const ROUTINE_PATTERNS = [
  // The release is broken on the usenet side.
  'not-complete',
  'cannot be completed',
  'incomplete',
  'missing articles',
  'out of retention',
  'crc error',
  'par2',
  'repair failed',
  'verification failed',
  'unpack failed',
  'extraction failed',
  'damaged',
  'corrupt',
  'no valid duration',
  'password protected',
  'encrypted',
  // The release was not what it claimed to be.
  'no video files found',
  'no audio files found',
  'no book files found',
  // The indexer or network hiccuped; the next grab goes through.
  'timed out',
  'timeout',
  'fetch failed',
  'url fetching failed',
  'maximum retries',
  'could not reach indexer',
  'returned http',
  'connection reset',
  'connection refused',
  'econnreset',
  'temporarily unavailable',
  // The source vanished mid-import, usually because a parallel import of the
  // same release had already moved it.
  'copyfile',
  'the download folder exists but the file is missing',
]

/** True when the download's movie, episode, album or book already has a file. */
const IN_LIBRARY_SQL = `(
  exists (select 1 from movie_files f where f.movie_id = downloads.movie_id)
  or exists (select 1 from episode_files f where f.episode_id = downloads.episode_id)
  or exists (
    select 1 from track_files tf join tracks t on t.id = tf.track_id
    where t.album_id = downloads.album_id
  )
  or exists (select 1 from book_files f where f.book_id = downloads.book_id)
)`

function likeAny(patterns: string[]): string {
  return `lower(downloads.error_message) like any (array[${patterns.map(() => '?').join(', ')}])`
}

/**
 * The severity of a failed download, as a SQL expression over the `downloads`
 * table, so counts and pagination can filter on it.
 */
export function failureSeveritySql(): { sql: string; bindings: string[] } {
  const wrap = (patterns: string[]) => patterns.map((pattern) => `%${pattern}%`)
  return {
    sql: `(case
      when ${IN_LIBRARY_SQL} then 'info'
      when downloads.error_message is null then 'error'
      when ${likeAny(INFO_PATTERNS)} then 'info'
      when ${likeAny(ROUTINE_PATTERNS)} then 'warning'
      else 'error'
    end)`,
    bindings: [...wrap(INFO_PATTERNS), ...wrap(ROUTINE_PATTERNS)],
  }
}
