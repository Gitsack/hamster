import fs from 'node:fs/promises'

/**
 * Check if a path is accessible with a timeout to prevent blocking on unmounted network storage.
 * @param filePath - The path to check
 * @param timeoutMs - Timeout in milliseconds (default: 3000)
 * @returns Promise that resolves if accessible, rejects with error if not
 */
export async function accessWithTimeout(filePath: string, timeoutMs = 3000): Promise<void> {
  await Promise.race([
    fs.access(filePath),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Path check timeout - network storage may be unmounted')),
        timeoutMs
      )
    ),
  ])
}

/**
 * Check if a path is accessible with a timeout, returning a boolean instead of throwing.
 * @param filePath - The path to check
 * @param timeoutMs - Timeout in milliseconds (default: 3000)
 * @returns Promise that resolves to true if accessible, false otherwise
 */
export async function isAccessible(filePath: string, timeoutMs = 3000): Promise<boolean> {
  try {
    await accessWithTimeout(filePath, timeoutMs)
    return true
  } catch {
    return false
  }
}

/**
 * Stat a file with a timeout to prevent blocking on unmounted network storage.
 * @param filePath - The path to stat
 * @param timeoutMs - Timeout in milliseconds (default: 3000)
 * @returns Promise that resolves with fs.Stats
 */
export async function statWithTimeout(
  filePath: string,
  timeoutMs = 3000
): Promise<Awaited<ReturnType<typeof fs.stat>>> {
  return Promise.race([
    fs.stat(filePath),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Stat timeout - network storage may be unmounted')),
        timeoutMs
      )
    ),
  ])
}

/**
 * Read a directory with a timeout to prevent blocking on unmounted network storage.
 * @param dirPath - The directory path to read
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 */
export async function readdirWithTimeout(dirPath: string, timeoutMs = 5000): Promise<string[]> {
  return Promise.race([
    fs.readdir(dirPath),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Readdir timeout - network storage may be unmounted')),
        timeoutMs
      )
    ),
  ])
}
