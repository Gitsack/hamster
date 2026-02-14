import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import Artist from '#models/artist'
import Album from '#models/album'
import Author from '#models/author'
import Book from '#models/book'
import TvShow from '#models/tv_show'
import Season from '#models/season'
import Episode from '#models/episode'
import TrackFile from '#models/track_file'

/**
 * Service for handling cascade removal logic when items are removed from library.
 *
 * Core principle: "In library" = "requested OR hasFile"
 * - When the last child is removed (unrequested and no file), the parent should be removed too
 */
class LibraryCleanupService {
  /**
   * Remove an artist if they have no albums that are either requested or have track files.
   * Call this after removing/unrequesting an album.
   */
  async removeArtistIfEmpty(artistId: string): Promise<boolean> {
    const artist = await Artist.find(artistId)
    if (!artist) return false

    // Check if any albums are requested
    const requestedAlbums = await Album.query()
      .where('artistId', artistId)
      .where('requested', true)
      .first()

    if (requestedAlbums) {
      logger.debug({ artistId }, 'LibraryCleanup: Artist has requested albums, keeping')
      return false
    }

    // Check if any albums have track files
    const albumsWithFiles = await Album.query()
      .where('artistId', artistId)
      .whereHas('trackFiles', () => {})
      .first()

    if (albumsWithFiles) {
      logger.debug({ artistId }, 'LibraryCleanup: Artist has albums with files, keeping')
      return false
    }

    // No requested albums and no albums with files - remove artist and all albums
    logger.info({ artistId, artistName: artist.name }, 'LibraryCleanup: Removing empty artist')

    // Delete all albums (and their tracks via cascade) and artist in a transaction
    await db.transaction(async (trx) => {
      await Album.query({ client: trx }).where('artistId', artistId).delete()
      artist.useTransaction(trx)
      await artist.delete()
    })
    return true
  }

  /**
   * Remove an author if they have no books that are either requested or have files.
   * Call this after removing/unrequesting a book.
   */
  async removeAuthorIfEmpty(authorId: string): Promise<boolean> {
    const author = await Author.find(authorId)
    if (!author) return false

    // Check if any books are requested
    const requestedBooks = await Book.query()
      .where('authorId', authorId)
      .where('requested', true)
      .first()

    if (requestedBooks) {
      logger.debug({ authorId }, 'LibraryCleanup: Author has requested books, keeping')
      return false
    }

    // Check if any books have files
    const booksWithFiles = await Book.query()
      .where('authorId', authorId)
      .where('hasFile', true)
      .first()

    if (booksWithFiles) {
      logger.debug({ authorId }, 'LibraryCleanup: Author has books with files, keeping')
      return false
    }

    // No requested books and no books with files - remove author and all books
    logger.info({ authorId, authorName: author.name }, 'LibraryCleanup: Removing empty author')

    await db.transaction(async (trx) => {
      await Book.query({ client: trx }).where('authorId', authorId).delete()
      author.useTransaction(trx)
      await author.delete()
    })
    return true
  }

  /**
   * Remove a TV show if it has no episodes that are either requested or have files.
   * Call this after removing/unrequesting episodes.
   */
  async removeTvShowIfEmpty(showId: string): Promise<boolean> {
    const show = await TvShow.find(showId)
    if (!show) return false

    // Check if any episodes are requested
    const requestedEpisodes = await Episode.query()
      .where('tvShowId', showId)
      .where('requested', true)
      .first()

    if (requestedEpisodes) {
      logger.debug({ showId }, 'LibraryCleanup: TV show has requested episodes, keeping')
      return false
    }

    // Check if any episodes have files
    const episodesWithFiles = await Episode.query()
      .where('tvShowId', showId)
      .where('hasFile', true)
      .first()

    if (episodesWithFiles) {
      logger.debug({ showId }, 'LibraryCleanup: TV show has episodes with files, keeping')
      return false
    }

    // No requested episodes and no episodes with files - remove show, seasons, episodes
    logger.info({ showId, showTitle: show.title }, 'LibraryCleanup: Removing empty TV show')

    await db.transaction(async (trx) => {
      await Episode.query({ client: trx }).where('tvShowId', showId).delete()
      await Season.query({ client: trx }).where('tvShowId', showId).delete()
      show.useTransaction(trx)
      await show.delete()
    })
    return true
  }

  /**
   * Remove a season if it has no episodes that are either requested or have files.
   * Call this after removing/unrequesting an episode.
   */
  async removeSeasonIfEmpty(seasonId: string): Promise<boolean> {
    const season = await Season.find(seasonId)
    if (!season) return false

    // Check if any episodes in this season are requested
    const requestedEpisodes = await Episode.query()
      .where('seasonId', seasonId)
      .where('requested', true)
      .first()

    if (requestedEpisodes) {
      logger.debug({ seasonId }, 'LibraryCleanup: Season has requested episodes, keeping')
      return false
    }

    // Check if any episodes in this season have files
    const episodesWithFiles = await Episode.query()
      .where('seasonId', seasonId)
      .where('hasFile', true)
      .first()

    if (episodesWithFiles) {
      logger.debug({ seasonId }, 'LibraryCleanup: Season has episodes with files, keeping')
      return false
    }

    // No requested episodes and no episodes with files - remove season and its episodes
    logger.info(
      { seasonId, seasonTitle: season.title || `Season ${season.seasonNumber}` },
      'LibraryCleanup: Removing empty season'
    )

    await db.transaction(async (trx) => {
      await Episode.query({ client: trx }).where('seasonId', seasonId).delete()
      season.useTransaction(trx)
      await season.delete()
    })
    return true
  }

  /**
   * Check if an album has any files (tracks with files).
   */
  async albumHasFiles(albumId: string): Promise<boolean> {
    const trackWithFile = await TrackFile.query().where('albumId', albumId).first()

    return !!trackWithFile
  }

  /**
   * Remove an album and trigger cascade check for artist.
   * Returns true if album was deleted.
   */
  async removeAlbum(albumId: string): Promise<boolean> {
    const album = await Album.find(albumId)
    if (!album) return false

    const artistId = album.artistId
    logger.info({ albumId, albumTitle: album.title }, 'LibraryCleanup: Removing album')

    // Delete the album (tracks deleted via cascade or manual cleanup)
    await album.delete()

    // Check if artist should be removed
    await this.removeArtistIfEmpty(artistId)

    return true
  }

  /**
   * Remove a book and trigger cascade check for author.
   * Returns true if book was deleted.
   */
  async removeBook(bookId: string): Promise<boolean> {
    const book = await Book.find(bookId)
    if (!book) return false

    const authorId = book.authorId
    logger.info({ bookId, bookTitle: book.title }, 'LibraryCleanup: Removing book')

    // Delete the book
    await book.delete()

    // Check if author should be removed
    await this.removeAuthorIfEmpty(authorId)

    return true
  }

  /**
   * Remove an episode and trigger cascade check for season and show.
   * Returns true if episode was deleted.
   */
  async removeEpisode(episodeId: string): Promise<boolean> {
    const episode = await Episode.find(episodeId)
    if (!episode) return false

    const seasonId = episode.seasonId
    const showId = episode.tvShowId
    logger.info(
      { episodeId, season: episode.seasonNumber, episode: episode.episodeNumber },
      'LibraryCleanup: Removing episode'
    )

    // Delete the episode
    await episode.delete()

    // Check if season should be removed
    const seasonRemoved = await this.removeSeasonIfEmpty(seasonId)

    // If season wasn't removed, we still need to check show
    // If season was removed, the show check was already done
    if (!seasonRemoved) {
      await this.removeTvShowIfEmpty(showId)
    }

    return true
  }
}

export const libraryCleanupService = new LibraryCleanupService()
