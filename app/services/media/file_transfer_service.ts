import fs from 'node:fs/promises'

/**
 * Moves and copies media files into the library.
 *
 * Two things matter here that a bare fs.copyFile does not handle:
 *
 * 1. A copy writes to a `.partial` sibling and is only renamed into place once
 *    it finished. Copying straight to the final path leaves a truncated file
 *    that looks like a complete import when the process dies halfway through.
 * 2. Copies run one at a time. fs.copyFile holds a libuv threadpool thread for
 *    the entire transfer, and that pool is four threads by default, so two
 *    concurrent 4K imports starve every other file read and DNS lookup in the
 *    process and stall HTTP requests for minutes.
 */
export class FileTransferService {
  private queue: Promise<unknown> = Promise.resolve()

  /**
   * Move a file into the library, falling back to a copy across devices.
   */
  async move(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      await fs.rename(sourcePath, destinationPath)
      return
    } catch {
      // Cross-device (separate mounts or SMB shares), so copy and drop the source
    }

    await this.copy(sourcePath, destinationPath)
    await fs.unlink(sourcePath)
  }

  /**
   * Copy a file into the library, leaving the source in place.
   */
  async copy(sourcePath: string, destinationPath: string): Promise<void> {
    return this.enqueue(() => this.copyViaPartial(sourcePath, destinationPath))
  }

  private async copyViaPartial(sourcePath: string, destinationPath: string): Promise<void> {
    const partialPath = `${destinationPath}.partial`

    try {
      await fs.copyFile(sourcePath, partialPath)
      await fs.rename(partialPath, destinationPath)
    } catch (error) {
      await fs.unlink(partialPath).catch(() => {})
      throw error
    }
  }

  /**
   * Run transfers one at a time so a large copy cannot exhaust the fs threadpool.
   */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task)
    this.queue = result.catch(() => {})
    return result
  }
}

export const fileTransferService = new FileTransferService()
