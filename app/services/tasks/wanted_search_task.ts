import Album from '#models/album'
import { indexerManager } from '#services/indexers/indexer_manager'
import { downloadManager } from '#services/download_clients/download_manager'

export interface WantedSearchResult {
  searched: number
  found: number
  grabbed: number
  errors: string[]
}

class WantedSearchTask {
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null
  private intervalMinutes = 60 // Search every hour by default

  /**
   * Start the periodic search task
   */
  start(intervalMinutes = 60) {
    if (this.intervalId) {
      this.stop()
    }

    this.intervalMinutes = intervalMinutes
    console.log(`[WantedSearch] Starting periodic search every ${intervalMinutes} minutes`)

    // Run immediately on start
    this.run().catch(console.error)

    // Then run periodically
    this.intervalId = setInterval(
      () => this.run().catch(console.error),
      intervalMinutes * 60 * 1000
    )
  }

  /**
   * Stop the periodic search task
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('[WantedSearch] Stopped periodic search')
    }
  }

  /**
   * Run a search for all wanted albums
   */
  async run(): Promise<WantedSearchResult> {
    if (this.isRunning) {
      console.log('[WantedSearch] Already running, skipping')
      return { searched: 0, found: 0, grabbed: 0, errors: ['Already running'] }
    }

    this.isRunning = true
    const result: WantedSearchResult = {
      searched: 0,
      found: 0,
      grabbed: 0,
      errors: [],
    }

    try {
      console.log('[WantedSearch] Starting search for wanted albums...')

      // Find all wanted albums (monitored but incomplete)
      const wantedAlbums = await Album.query()
        .where('monitored', true)
        .preload('artist')
        .preload('tracks')

      // Filter to only albums with missing tracks
      const albumsToSearch = wantedAlbums.filter((album) => {
        const trackCount = album.tracks.length
        const fileCount = album.tracks.filter((t) => t.trackFileId !== null).length
        return trackCount > 0 && fileCount < trackCount
      })

      console.log(`[WantedSearch] Found ${albumsToSearch.length} wanted albums`)

      for (const album of albumsToSearch) {
        result.searched++

        try {
          // Search for the album
          const searchResults = await indexerManager.search({
            artist: album.artist?.name,
            album: album.title,
            year: album.releaseDate?.year,
            limit: 10,
          })

          if (searchResults.length === 0) {
            console.log(`[WantedSearch] No results for: ${album.artist?.name} - ${album.title}`)
            continue
          }

          result.found++

          // Sort by size (prefer larger files) and grab the best
          const sorted = searchResults.sort((a, b) => b.size - a.size)
          const bestResult = sorted[0]

          console.log(`[WantedSearch] Grabbing: ${bestResult.title}`)

          await downloadManager.grab({
            title: bestResult.title,
            downloadUrl: bestResult.downloadUrl,
            size: bestResult.size,
            albumId: album.id,
            indexerId: bestResult.indexerId,
            indexerName: bestResult.indexer,
            guid: bestResult.id,
          })

          result.grabbed++

          // Small delay between grabs to be nice to indexers
          await new Promise((resolve) => setTimeout(resolve, 2000))
        } catch (error) {
          const errorMsg = `Failed to search/grab ${album.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`[WantedSearch] ${errorMsg}`)
          result.errors.push(errorMsg)
        }
      }

      console.log(
        `[WantedSearch] Complete: searched=${result.searched}, found=${result.found}, grabbed=${result.grabbed}`
      )
    } finally {
      this.isRunning = false
    }

    return result
  }

  /**
   * Check if the task is currently running
   */
  get running() {
    return this.isRunning
  }

  /**
   * Get the current interval in minutes
   */
  get interval() {
    return this.intervalMinutes
  }
}

export const wantedSearchTask = new WantedSearchTask()
