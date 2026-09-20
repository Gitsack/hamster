/**
 * Matching a download client's job name back to the release title we sent.
 *
 * We hand SABnzbd `<release title>.nzb`, but the name it reports back has been
 * through its own cleanup: dots become spaces (or underscores, depending on the
 * user's settings), and a second copy of a job it already holds gets a `.1`,
 * `.2`, … suffix. Comparing the raw strings therefore never matches, which is
 * how a grab whose HTTP response we lost ends up looking like a job nobody
 * sent.
 */

/**
 * Reduce a job or release name to the form both sides agree on: lowercase
 * words, no separators, no `.nzb` extension and no duplicate-copy suffix.
 */
export function normalizeJobName(name: string): string {
  return (
    name
      .replace(/\.nzb$/i, '')
      // SABnzbd's suffix for a job it already has a copy of. A release title ends
      // in a group name, not a bare one- or two-digit number, so this only ever
      // strips what SABnzbd added.
      .replace(/\.\d{1,2}$/, '')
      .toLowerCase()
      .replace(/[._-]/g, ' ')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Whether a download client's job name refers to the release we sent.
 */
export function isSameJob(jobName: string, releaseTitle: string): boolean {
  const job = normalizeJobName(jobName)
  return job.length > 0 && job === normalizeJobName(releaseTitle)
}
