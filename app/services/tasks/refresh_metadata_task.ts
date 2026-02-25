import TvShow from '#models/tv_show'
import Season from '#models/season'
import Episode from '#models/episode'
import Artist from '#models/artist'
import Album from '#models/album'
import Author from '#models/author'
import Book from '#models/book'
import Movie from '#models/movie'
import { tmdbService } from '#services/metadata/tmdb_service'
import { musicBrainzService } from '#services/metadata/musicbrainz_service'
import { coverArtService } from '#services/metadata/cover_art_service'
import { openLibraryService } from '#services/metadata/openlibrary_service'
import { type AlbumType } from '#models/album'
import { DateTime } from 'luxon'

const LOG_PREFIX = '[RefreshMetadata]'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

class RefreshMetadataTask {
  private isRunning = false

  start(_intervalMinutes?: number) {
    // No-op: TaskScheduler handles the interval
  }

  stop() {
    // No-op: TaskScheduler handles stopping
  }

  get running() {
    return this.isRunning
  }

  async run(): Promise<void> {
    if (this.isRunning) {
      console.log(`${LOG_PREFIX} Already running, skipping`)
      return
    }

    this.isRunning = true

    try {
      console.log(`${LOG_PREFIX} Starting metadata refresh...`)

      await this.refreshTvShows()
      await this.refreshMovies()
      await this.refreshArtists()
      await this.refreshAuthors()

      console.log(`${LOG_PREFIX} Metadata refresh complete`)
    } catch (error) {
      console.error(`${LOG_PREFIX} Unexpected error:`, error)
    } finally {
      this.isRunning = false
    }
  }

  private async refreshTvShows(): Promise<void> {
    const shows = await TvShow.query()
      .whereNotNull('tmdbId')
      .preload('seasons', (query) => query.preload('episodes'))

    console.log(`${LOG_PREFIX} Refreshing ${shows.length} TV shows`)

    for (const show of shows) {
      try {
        const tmdbId = Number.parseInt(show.tmdbId!)

        const { cache } = await import('#services/cache/cache_service')
        cache.delete(`tmdb:tv:${tmdbId}`)

        const [tmdbData, alternateTitles] = await Promise.all([
          tmdbService.getTvShow(tmdbId),
          tmdbService.getTvShowAlternateTitles(tmdbId).catch(() => [] as string[]),
        ])
        const seriesType = tmdbService.detectSeriesType(tmdbData)

        show.merge({
          originalTitle: tmdbData.originalName || show.originalTitle,
          overview: tmdbData.overview || show.overview,
          status: tmdbData.status || show.status,
          posterUrl: tmdbData.posterPath || show.posterUrl,
          backdropUrl: tmdbData.backdropPath || show.backdropUrl,
          rating: tmdbData.voteAverage || show.rating,
          votes: tmdbData.voteCount || show.votes,
          seasonCount: tmdbData.numberOfSeasons || show.seasonCount,
          episodeCount: tmdbData.numberOfEpisodes || show.episodeCount,
          imdbId: tmdbData.imdbId || show.imdbId,
          tvdbId: tmdbData.tvdbId || show.tvdbId,
          alternateTitles,
          seriesType,
        })
        await show.save()

        const tmdbSeasons = await tmdbService.getTvShowSeasons(tmdbId)
        const existingSeasons = new Map(show.seasons.map((s) => [s.seasonNumber, s]))

        for (const tmdbSeason of tmdbSeasons) {
          if (tmdbSeason.seasonNumber === 0) continue

          let season = existingSeasons.get(tmdbSeason.seasonNumber)

          if (!season) {
            season = await Season.create({
              tvShowId: show.id,
              tmdbId: String(tmdbSeason.id),
              seasonNumber: tmdbSeason.seasonNumber,
              title: tmdbSeason.name,
              overview: tmdbSeason.overview || null,
              airDate: tmdbSeason.airDate ? DateTime.fromISO(tmdbSeason.airDate) : null,
              posterUrl: tmdbSeason.posterPath || null,
              episodeCount: tmdbSeason.episodeCount,
              requested: show.monitored,
            })
            existingSeasons.set(tmdbSeason.seasonNumber, season)
          } else {
            season.merge({
              tmdbId: String(tmdbSeason.id),
              title: tmdbSeason.name || season.title,
              overview: tmdbSeason.overview || season.overview,
              airDate: tmdbSeason.airDate ? DateTime.fromISO(tmdbSeason.airDate) : season.airDate,
              posterUrl: tmdbSeason.posterPath || season.posterUrl,
              episodeCount: tmdbSeason.episodeCount || season.episodeCount,
            })
            await season.save()
          }

          const { episodes: tmdbEpisodes } = await tmdbService.getTvShowSeason(
            tmdbId,
            tmdbSeason.seasonNumber
          )

          const existingEpisodes = season.episodes || []
          const existingEpisodeNumbers = new Set(existingEpisodes.map((e) => e.episodeNumber))

          for (const episode of existingEpisodes) {
            const tmdbEpisode = tmdbEpisodes.find((e) => e.episodeNumber === episode.episodeNumber)
            if (tmdbEpisode) {
              episode.merge({
                tmdbId: String(tmdbEpisode.id),
                title: tmdbEpisode.name || episode.title,
                overview: tmdbEpisode.overview || episode.overview,
                airDate: tmdbEpisode.airDate
                  ? DateTime.fromISO(tmdbEpisode.airDate)
                  : episode.airDate,
                runtime: tmdbEpisode.runtime || episode.runtime,
                stillUrl: tmdbEpisode.stillPath || episode.stillUrl,
                rating: tmdbEpisode.voteAverage || episode.rating,
                votes: tmdbEpisode.voteCount || episode.votes,
              })
              await episode.save()
            }
          }

          for (const tmdbEpisode of tmdbEpisodes) {
            if (!existingEpisodeNumbers.has(tmdbEpisode.episodeNumber)) {
              await Episode.create({
                tvShowId: show.id,
                seasonId: season.id,
                tmdbId: String(tmdbEpisode.id),
                seasonNumber: tmdbEpisode.seasonNumber,
                episodeNumber: tmdbEpisode.episodeNumber,
                title: tmdbEpisode.name,
                overview: tmdbEpisode.overview || null,
                airDate: tmdbEpisode.airDate ? DateTime.fromISO(tmdbEpisode.airDate) : null,
                runtime: tmdbEpisode.runtime || null,
                stillUrl: tmdbEpisode.stillPath || null,
                rating: tmdbEpisode.voteAverage || null,
                votes: tmdbEpisode.voteCount || null,
                requested: show.monitored,
                hasFile: false,
              })
            }
          }
        }

        console.log(`${LOG_PREFIX} Refreshed TV show: ${show.title}`)
        await delay(1000)
      } catch (error) {
        console.error(
          `${LOG_PREFIX} Failed to refresh TV show "${show.title}" (${show.id}):`,
          error
        )
      }
    }
  }

  private async refreshMovies(): Promise<void> {
    const movies = await Movie.query().whereNotNull('tmdbId')

    console.log(`${LOG_PREFIX} Refreshing ${movies.length} movies`)

    for (const movie of movies) {
      try {
        const tmdbId = Number.parseInt(movie.tmdbId!)

        const { cache } = await import('#services/cache/cache_service')
        cache.delete(`tmdb:movie:${tmdbId}`)

        const tmdbData = await tmdbService.getMovie(tmdbId)

        movie.merge({
          originalTitle: tmdbData.originalTitle || movie.originalTitle,
          overview: tmdbData.overview || movie.overview,
          status: tmdbData.status || movie.status,
          posterUrl: tmdbData.posterPath || movie.posterUrl,
          backdropUrl: tmdbData.backdropPath || movie.backdropUrl,
          rating: tmdbData.voteAverage || movie.rating,
          votes: tmdbData.voteCount || movie.votes,
          runtime: tmdbData.runtime || movie.runtime,
          imdbId: tmdbData.imdbId || movie.imdbId,
          genres: tmdbData.genres || movie.genres,
        })
        await movie.save()

        console.log(`${LOG_PREFIX} Refreshed movie: ${movie.title}`)
        await delay(1000)
      } catch (error) {
        console.error(
          `${LOG_PREFIX} Failed to refresh movie "${movie.title}" (${movie.id}):`,
          error
        )
      }
    }
  }

  private async refreshArtists(): Promise<void> {
    const artists = await Artist.query().whereNotNull('musicbrainzId')

    console.log(`${LOG_PREFIX} Refreshing ${artists.length} artists`)

    for (const artist of artists) {
      try {
        const mbArtist = await musicBrainzService.getArtist(artist.musicbrainzId!)
        if (!mbArtist) {
          console.warn(`${LOG_PREFIX} MusicBrainz returned no data for artist "${artist.name}"`)
          continue
        }

        artist.merge({
          name: mbArtist.name,
          sortName: mbArtist.sortName,
          disambiguation: mbArtist.disambiguation || null,
          status: mbArtist.endDate ? 'ended' : 'continuing',
          artistType: mbArtist.type || null,
          country: mbArtist.country || null,
          formedAt: mbArtist.beginDate ? DateTime.fromISO(mbArtist.beginDate) : null,
          endedAt: mbArtist.endDate ? DateTime.fromISO(mbArtist.endDate) : null,
        })
        await artist.save()

        // Fetch albums and add missing ones
        const mbAlbums = await musicBrainzService.getArtistAlbums(artist.musicbrainzId!)
        const existingAlbums = await Album.query().where('artistId', artist.id)
        const existingMbIds = new Set(
          existingAlbums
            .filter((a) => a.musicbrainzReleaseGroupId)
            .map((a) => a.musicbrainzReleaseGroupId)
        )

        for (const mbAlbum of mbAlbums) {
          if (existingMbIds.has(mbAlbum.id)) continue

          // Check by title match for albums without MusicBrainz ID
          const titleMatch = existingAlbums.find(
            (a) =>
              !a.musicbrainzReleaseGroupId && a.title.toLowerCase() === mbAlbum.title.toLowerCase()
          )

          if (titleMatch) {
            const albumType = this.mapAlbumType(mbAlbum.primaryType)
            const coverUrl = coverArtService.getFrontCoverUrl(mbAlbum.id, '500')
            titleMatch.merge({
              musicbrainzReleaseGroupId: mbAlbum.id,
              albumType,
              secondaryTypes: mbAlbum.secondaryTypes || [],
              releaseDate: mbAlbum.releaseDate
                ? DateTime.fromISO(mbAlbum.releaseDate)
                : titleMatch.releaseDate,
              imageUrl: coverUrl || titleMatch.imageUrl,
            })
            await titleMatch.save()
          } else {
            const albumType = this.mapAlbumType(mbAlbum.primaryType)
            const coverUrl = coverArtService.getFrontCoverUrl(mbAlbum.id, '500')
            await Album.create({
              artistId: artist.id,
              musicbrainzReleaseGroupId: mbAlbum.id,
              title: mbAlbum.title,
              albumType,
              secondaryTypes: mbAlbum.secondaryTypes || [],
              releaseDate: mbAlbum.releaseDate ? DateTime.fromISO(mbAlbum.releaseDate) : null,
              imageUrl: coverUrl,
              requested: artist.monitored,
              anyReleaseOk: true,
            })
          }
        }

        // Update artist image if missing
        if (!artist.imageUrl) {
          const albums = await Album.query()
            .where('artistId', artist.id)
            .where('albumType', 'album')
            .whereNotNull('musicbrainzReleaseGroupId')
            .orderBy('releaseDate', 'desc')

          for (const album of albums) {
            if (album.musicbrainzReleaseGroupId) {
              const verified = await coverArtService.getVerifiedCoverUrl(
                album.musicbrainzReleaseGroupId,
                '500'
              )
              if (verified) {
                artist.imageUrl = verified
                await artist.save()
                break
              }
            }
          }
        }

        console.log(`${LOG_PREFIX} Refreshed artist: ${artist.name}`)
        // MusicBrainz is strict about rate limits - wait 2s between artists
        await delay(2000)
      } catch (error) {
        console.error(
          `${LOG_PREFIX} Failed to refresh artist "${artist.name}" (${artist.id}):`,
          error
        )
        await delay(2000)
      }
    }
  }

  private async refreshAuthors(): Promise<void> {
    const authors = await Author.query().whereNotNull('openlibraryId')

    console.log(`${LOG_PREFIX} Refreshing ${authors.length} authors`)

    for (const author of authors) {
      try {
        const olData = await openLibraryService.getAuthor(author.openlibraryId!)
        if (olData) {
          author.merge({
            name: olData.name,
            sortName: olData.name.split(' ').reverse().join(', '),
            overview: olData.bio,
            imageUrl: openLibraryService.getAuthorPhotoUrl(olData.photoId, 'L'),
          })
          await author.save()
        }

        const works = await openLibraryService.getAuthorWorks(author.openlibraryId!, 100)
        const existingBooks = await Book.query()
          .where('authorId', author.id)
          .select('openlibraryId')
        const existingKeys = new Set(existingBooks.map((b) => b.openlibraryId))

        for (const work of works) {
          if (!existingKeys.has(work.key)) {
            await Book.create({
              authorId: author.id,
              openlibraryId: work.key,
              title: work.title,
              sortTitle: work.title.toLowerCase().replace(/^(the|a|an)\s+/i, ''),
              overview: work.description,
              coverUrl: openLibraryService.getCoverUrl(work.coverId, 'L'),
              genres: work.subjects || [],
              requested: author.monitored,
              hasFile: false,
            })
          }
        }

        console.log(`${LOG_PREFIX} Refreshed author: ${author.name}`)
        await delay(1000)
      } catch (error) {
        console.error(
          `${LOG_PREFIX} Failed to refresh author "${author.name}" (${author.id}):`,
          error
        )
      }
    }
  }

  private mapAlbumType(primaryType: string | undefined): AlbumType {
    switch (primaryType?.toLowerCase()) {
      case 'album':
        return 'album'
      case 'single':
        return 'single'
      case 'ep':
        return 'ep'
      case 'other':
        return 'other'
      default:
        return 'album'
    }
  }
}

export const refreshMetadataTask = new RefreshMetadataTask()
