import type { HttpContext } from '@adonisjs/core/http'
import Movie from '#models/movie'
import TvShow from '#models/tv_show'
import Episode from '#models/episode'
import Artist from '#models/artist'
import Album from '#models/album'
import Author from '#models/author'
import Book from '#models/book'
import Download from '#models/download'
import DownloadClient from '#models/download_client'
import Indexer from '#models/indexer'

interface RecentItem {
  id: string
  title: string
  type: 'movie' | 'tvshow' | 'album' | 'book'
  imageUrl: string | null
  addedAt: string
  year: number | null
  subtitle: string | null
}

export default class DashboardController {
  async index({ inertia, logger }: HttpContext) {
    try {
      // Run all count queries in parallel
      const [
        movieCount,
        tvShowCount,
        episodeCount,
        artistCount,
        albumCount,
        authorCount,
        bookCount,
        missingMovies,
        missingEpisodes,
        missingAlbums,
        missingBooks,
        activeDownloads,
        downloadClients,
        indexers,
        recentMovies,
        recentTvShows,
        recentAlbums,
        recentBooks,
      ] = await Promise.all([
        Movie.query().count('* as total'),
        TvShow.query().count('* as total'),
        Episode.query().count('* as total'),
        Artist.query().count('* as total'),
        Album.query().count('* as total'),
        Author.query().count('* as total'),
        Book.query().count('* as total'),
        // Missing: monitored but no file
        Movie.query().where('monitored', true).where('hasFile', false).count('* as total'),
        Episode.query().where('requested', true).where('hasFile', false).count('* as total'),
        Album.query()
          .where('requested', true)
          .whereDoesntHave('trackFiles', (q) => q)
          .count('* as total'),
        Book.query().where('requested', true).where('hasFile', false).count('* as total'),
        // Active downloads
        Download.query()
          .whereIn('status', ['queued', 'downloading', 'paused', 'importing'])
          .count('* as total'),
        // Download clients & indexers
        DownloadClient.query().select('id', 'name', 'type', 'enabled'),
        Indexer.query().select('id', 'name', 'type', 'enabled'),
        // Recent additions (last 10 of each type, we'll merge & sort client-side)
        Movie.query().orderBy('createdAt', 'desc').limit(10),
        TvShow.query().orderBy('createdAt', 'desc').limit(10),
        Album.query().preload('artist').orderBy('createdAt', 'desc').limit(10),
        Book.query().preload('author').orderBy('createdAt', 'desc').limit(10),
      ])

      const toCount = (result: { $extras: Record<string, unknown> }[]) =>
        Number(result[0].$extras.total)

      // Build recent items list
      const recentItems: RecentItem[] = []

      for (const movie of recentMovies) {
        recentItems.push({
          id: movie.id,
          title: movie.title,
          type: 'movie',
          imageUrl: movie.posterUrl,
          addedAt: movie.createdAt.toISO()!,
          year: movie.year,
          subtitle: null,
        })
      }

      for (const show of recentTvShows) {
        recentItems.push({
          id: show.id,
          title: show.title,
          type: 'tvshow',
          imageUrl: show.posterUrl,
          addedAt: show.createdAt.toISO()!,
          year: show.year,
          subtitle: show.network,
        })
      }

      for (const album of recentAlbums) {
        recentItems.push({
          id: album.id,
          title: album.title,
          type: 'album',
          imageUrl: album.imageUrl,
          addedAt: album.createdAt.toISO()!,
          year: album.releaseDate ? album.releaseDate.year : null,
          subtitle: album.artist?.name ?? null,
        })
      }

      for (const book of recentBooks) {
        recentItems.push({
          id: book.id,
          title: book.title,
          type: 'book',
          imageUrl: book.coverUrl,
          addedAt: book.createdAt.toISO()!,
          year: book.releaseDate ? book.releaseDate.year : null,
          subtitle: book.author?.name ?? null,
        })
      }

      // Sort by addedAt descending and take top 10
      recentItems.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
      const recent = recentItems.slice(0, 10)

      return inertia.render('dashboard', {
        stats: {
          movies: toCount(movieCount),
          tvShows: toCount(tvShowCount),
          episodes: toCount(episodeCount),
          artists: toCount(artistCount),
          albums: toCount(albumCount),
          authors: toCount(authorCount),
          books: toCount(bookCount),
        },
        missing: {
          movies: toCount(missingMovies),
          episodes: toCount(missingEpisodes),
          albums: toCount(missingAlbums),
          books: toCount(missingBooks),
        },
        activeDownloadCount: toCount(activeDownloads),
        recentAdditions: recent,
        health: {
          downloadClients: downloadClients.map((dc) => ({
            id: dc.id,
            name: dc.name,
            type: dc.type,
            enabled: dc.enabled,
          })),
          indexers: indexers.map((idx) => ({
            id: idx.id,
            name: idx.name,
            type: idx.type,
            enabled: idx.enabled,
          })),
        },
      })
    } catch (error) {
      logger.error({ err: error }, 'Dashboard query failed')

      return inertia.render('dashboard', {
        stats: {
          movies: 0,
          tvShows: 0,
          episodes: 0,
          artists: 0,
          albums: 0,
          authors: 0,
          books: 0,
        },
        missing: {
          movies: 0,
          episodes: 0,
          albums: 0,
          books: 0,
        },
        activeDownloadCount: 0,
        recentAdditions: [],
        health: {
          downloadClients: [],
          indexers: [],
        },
      })
    }
  }
}
