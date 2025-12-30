import type { HttpContext } from '@adonisjs/core/http'
import path from 'node:path'
import fs from 'node:fs/promises'
import MovieFile from '#models/movie_file'
import EpisodeFile from '#models/episode_file'
import BookFile from '#models/book_file'
import TrackFile from '#models/track_file'
import Movie from '#models/movie'
import Author from '#models/author'
import RootFolder from '#models/root_folder'
import { completedDownloadsScanner } from '#services/tasks/completed_downloads_scanner'
import { folderScanner } from '#services/tasks/folder_scanner'

export default class FilesController {
  /**
   * Download a movie file
   */
  async downloadMovie({ params, response }: HttpContext) {
    const movieFile = await MovieFile.query()
      .where('id', params.id)
      .preload('movie')
      .first()

    if (!movieFile) {
      return response.notFound({ error: 'Movie file not found' })
    }

    const movie = movieFile.movie
    if (!movie) {
      return response.notFound({ error: 'Movie not found' })
    }

    const rootFolder = await RootFolder.find(movie.rootFolderId)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }

    const absolutePath = path.join(rootFolder.path, movieFile.relativePath)

    try {
      await fs.access(absolutePath)
    } catch {
      return response.notFound({ error: 'File not found on disk' })
    }

    const fileName = path.basename(absolutePath)
    response.header('Content-Disposition', `attachment; filename="${fileName}"`)
    return response.download(absolutePath)
  }

  /**
   * Download an episode file
   */
  async downloadEpisode({ params, response }: HttpContext) {
    const episodeFile = await EpisodeFile.query()
      .where('id', params.id)
      .preload('tvShow')
      .first()

    if (!episodeFile) {
      return response.notFound({ error: 'Episode file not found' })
    }

    const tvShow = episodeFile.tvShow
    if (!tvShow) {
      return response.notFound({ error: 'TV show not found' })
    }

    const rootFolder = await RootFolder.find(tvShow.rootFolderId)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }

    const absolutePath = path.join(rootFolder.path, episodeFile.relativePath)

    try {
      await fs.access(absolutePath)
    } catch {
      return response.notFound({ error: 'File not found on disk' })
    }

    const fileName = path.basename(absolutePath)
    response.header('Content-Disposition', `attachment; filename="${fileName}"`)
    return response.download(absolutePath)
  }

  /**
   * Download a book file
   */
  async downloadBook({ params, response }: HttpContext) {
    const bookFile = await BookFile.query()
      .where('id', params.id)
      .preload('book')
      .first()

    if (!bookFile) {
      return response.notFound({ error: 'Book file not found' })
    }

    const book = bookFile.book
    if (!book) {
      return response.notFound({ error: 'Book not found' })
    }

    const author = await Author.find(book.authorId)
    if (!author) {
      return response.notFound({ error: 'Author not found' })
    }

    const rootFolder = await RootFolder.find(author.rootFolderId)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }

    const absolutePath = path.join(rootFolder.path, bookFile.relativePath)

    try {
      await fs.access(absolutePath)
    } catch {
      return response.notFound({ error: 'File not found on disk' })
    }

    const fileName = path.basename(absolutePath)
    response.header('Content-Disposition', `attachment; filename="${fileName}"`)
    return response.download(absolutePath)
  }

  /**
   * Download a track file
   */
  async downloadTrack({ params, response }: HttpContext) {
    const trackFile = await TrackFile.query()
      .where('id', params.id)
      .preload('track', (query) => {
        query.preload('album', (albumQuery) => {
          albumQuery.preload('artist')
        })
      })
      .first()

    if (!trackFile) {
      return response.notFound({ error: 'Track file not found' })
    }

    const track = trackFile.track
    if (!track?.album?.artist) {
      return response.notFound({ error: 'Track or album not found' })
    }

    const artist = track.album.artist
    const rootFolder = await RootFolder.find(artist.rootFolderId)
    if (!rootFolder) {
      return response.notFound({ error: 'Root folder not found' })
    }

    const absolutePath = path.join(rootFolder.path, trackFile.relativePath)

    try {
      await fs.access(absolutePath)
    } catch {
      return response.notFound({ error: 'File not found on disk' })
    }

    const fileName = path.basename(absolutePath)
    response.header('Content-Disposition', `attachment; filename="${fileName}"`)
    return response.download(absolutePath)
  }

  /**
   * Sync hasFile flags for all media types
   * This scans the database and updates hasFile flags based on file records
   */
  async syncFileStatus({ response }: HttpContext) {
    const results = {
      movies: { updated: 0 },
      episodes: { updated: 0 },
      books: { updated: 0 },
      tracks: { updated: 0 },
    }

    // Sync movies
    const movies = await Movie.query()
    for (const movie of movies) {
      const hasFile = await MovieFile.query().where('movieId', movie.id).first()
      const shouldHaveFile = !!hasFile
      if (movie.hasFile !== shouldHaveFile) {
        movie.hasFile = shouldHaveFile
        await movie.save()
        results.movies.updated++
      }
    }

    // Sync episodes
    const { default: Episode } = await import('#models/episode')
    const episodes = await Episode.query()
    for (const episode of episodes) {
      const hasFile = await EpisodeFile.query().where('episodeId', episode.id).first()
      const shouldHaveFile = !!hasFile
      if (episode.hasFile !== shouldHaveFile) {
        episode.hasFile = shouldHaveFile
        await episode.save()
        results.episodes.updated++
      }
    }

    // Sync books
    const { default: Book } = await import('#models/book')
    const books = await Book.query()
    for (const book of books) {
      const hasFile = await BookFile.query().where('bookId', book.id).first()
      const shouldHaveFile = !!hasFile
      if (book.hasFile !== shouldHaveFile) {
        book.hasFile = shouldHaveFile
        await book.save()
        results.books.updated++
      }
    }

    // Sync tracks
    const { default: Track } = await import('#models/track')
    const tracks = await Track.query()
    for (const track of tracks) {
      const hasFile = await TrackFile.query().where('trackId', track.id).first()
      const shouldHaveFile = !!hasFile
      if (track.hasFile !== shouldHaveFile) {
        track.hasFile = shouldHaveFile
        await track.save()
        results.tracks.updated++
      }
    }

    return response.json({
      success: true,
      message: 'File status synced',
      results,
    })
  }

  /**
   * Scan for completed downloads that weren't imported (API-based)
   * This queries SABnzbd history for completed downloads
   */
  async scanCompletedDownloads({ response }: HttpContext) {
    const results = await completedDownloadsScanner.scan()

    return response.json({
      success: true,
      message: 'Completed downloads scan finished',
      processed: results.processed,
      imported: results.imported,
      errors: results.errors,
    })
  }

  /**
   * Scan download folders directly on the filesystem
   * This is independent of download client APIs - scans actual files
   */
  async scanFolders({ response }: HttpContext) {
    const results = await folderScanner.scan()

    return response.json({
      success: true,
      message: 'Folder scan finished',
      processed: results.processed,
      imported: results.imported,
      errors: results.errors,
    })
  }

  /**
   * Run both API-based and filesystem-based scans
   */
  async scanAll({ response }: HttpContext) {
    // Run both scanners
    const apiResults = await completedDownloadsScanner.scan()
    const folderResults = await folderScanner.scan()

    return response.json({
      success: true,
      message: 'Full scan finished',
      apiScan: {
        processed: apiResults.processed,
        imported: apiResults.imported,
        errors: apiResults.errors,
      },
      folderScan: {
        processed: folderResults.processed,
        imported: folderResults.imported,
        errors: folderResults.errors,
      },
      totalImported: apiResults.imported + folderResults.imported,
    })
  }
}
