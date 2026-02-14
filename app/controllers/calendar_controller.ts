import type { HttpContext } from '@adonisjs/core/http'
import Episode from '#models/episode'
import Movie from '#models/movie'
import Album from '#models/album'
import Book from '#models/book'
import { DateTime } from 'luxon'

interface CalendarEvent {
  uid: string
  title: string
  description?: string
  startDate: DateTime
  endDate?: DateTime
  mediaType: 'episode' | 'movie' | 'album' | 'book'
  hasFile: boolean
}

export default class CalendarController {
  /**
   * Get calendar events as JSON
   */
  async index({ request, response }: HttpContext) {
    const { start, end, unmonitored = 'false' } = request.qs()

    const startDate = start ? DateTime.fromISO(start) : DateTime.now().minus({ days: 7 })
    const endDate = end ? DateTime.fromISO(end) : DateTime.now().plus({ days: 30 })
    const includeUnmonitored = unmonitored === 'true'

    const events = await this.getCalendarEvents(startDate, endDate, includeUnmonitored)

    return response.json(events)
  }

  /**
   * Export calendar as iCal format
   */
  async ical({ request, response }: HttpContext) {
    const { futureDays = '30', pastDays = '7', unmonitored = 'false' } = request.qs()

    const startDate = DateTime.now().minus({ days: Number.parseInt(pastDays, 10) })
    const endDate = DateTime.now().plus({ days: Number.parseInt(futureDays, 10) })
    const includeUnmonitored = unmonitored === 'true'

    const events = await this.getCalendarEvents(startDate, endDate, includeUnmonitored)
    const ical = this.generateIcal(events)

    response.header('Content-Type', 'text/calendar; charset=utf-8')
    response.header('Content-Disposition', 'attachment; filename="hamster.ics"')
    return response.send(ical)
  }

  /**
   * Get calendar events from database
   */
  private async getCalendarEvents(
    startDate: DateTime,
    endDate: DateTime,
    includeUnmonitored: boolean
  ): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = []

    // Get episodes with air dates
    const episodeQuery = Episode.query()
      .whereNotNull('airDate')
      .where('airDate', '>=', startDate.toISODate()!)
      .where('airDate', '<=', endDate.toISODate()!)
      .preload('tvShow')

    if (!includeUnmonitored) {
      episodeQuery.where('requested', true)
    }

    const episodes = await episodeQuery

    for (const episode of episodes) {
      if (episode.airDate) {
        events.push({
          uid: `episode-${episode.id}@hamster`,
          title: `${episode.tvShow?.title || 'Unknown Show'} - S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}${episode.title ? ` - ${episode.title}` : ''}`,
          description: episode.overview || undefined,
          startDate: episode.airDate,
          mediaType: 'episode',
          hasFile: episode.hasFile,
        })
      }
    }

    // Get movies with release dates
    const movieQuery = Movie.query()
      .whereNotNull('releaseDate')
      .where('releaseDate', '>=', startDate.toISODate()!)
      .where('releaseDate', '<=', endDate.toISODate()!)

    if (!includeUnmonitored) {
      movieQuery.where('requested', true)
    }

    const movies = await movieQuery

    for (const movie of movies) {
      if (movie.releaseDate) {
        events.push({
          uid: `movie-${movie.id}@hamster`,
          title: `${movie.title}${movie.year ? ` (${movie.year})` : ''}`,
          description: movie.overview || undefined,
          startDate: movie.releaseDate,
          mediaType: 'movie',
          hasFile: movie.hasFile,
        })
      }
    }

    // Get albums with release dates
    const albumQuery = Album.query()
      .whereNotNull('releaseDate')
      .where('releaseDate', '>=', startDate.toISODate()!)
      .where('releaseDate', '<=', endDate.toISODate()!)
      .preload('artist')
      .preload('trackFiles')

    if (!includeUnmonitored) {
      albumQuery.where('requested', true)
    }

    const albums = await albumQuery

    for (const album of albums) {
      if (album.releaseDate) {
        // Check if album has any track files
        const hasFiles = album.trackFiles && album.trackFiles.length > 0
        events.push({
          uid: `album-${album.id}@hamster`,
          title: `${album.artist?.name || 'Unknown Artist'} - ${album.title}`,
          description: undefined,
          startDate: album.releaseDate,
          mediaType: 'album',
          hasFile: hasFiles,
        })
      }
    }

    // Get books with release dates
    const bookQuery = Book.query()
      .whereNotNull('releaseDate')
      .where('releaseDate', '>=', startDate.toISODate()!)
      .where('releaseDate', '<=', endDate.toISODate()!)
      .preload('author')

    if (!includeUnmonitored) {
      bookQuery.where('requested', true)
    }

    const books = await bookQuery

    for (const book of books) {
      if (book.releaseDate) {
        events.push({
          uid: `book-${book.id}@hamster`,
          title: `${book.author?.name || 'Unknown Author'} - ${book.title}`,
          description: book.overview || undefined,
          startDate: book.releaseDate,
          mediaType: 'book',
          hasFile: book.hasFile,
        })
      }
    }

    // Sort by date
    events.sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis())

    return events
  }

  /**
   * Generate iCal format from events
   */
  private generateIcal(events: CalendarEvent[]): string {
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Hamster//Media Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Hamster Media Calendar',
    ]

    for (const event of events) {
      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${event.uid}`)
      lines.push(`DTSTAMP:${this.formatIcalDate(DateTime.now())}`)
      lines.push(`DTSTART;VALUE=DATE:${event.startDate.toFormat('yyyyMMdd')}`)

      // All-day event (no end time specified)
      const endDate = event.endDate || event.startDate.plus({ days: 1 })
      lines.push(`DTEND;VALUE=DATE:${endDate.toFormat('yyyyMMdd')}`)

      lines.push(`SUMMARY:${this.escapeIcalText(event.title)}`)

      if (event.description) {
        lines.push(`DESCRIPTION:${this.escapeIcalText(event.description)}`)
      }

      // Add category
      const category = this.getCategoryName(event.mediaType)
      lines.push(`CATEGORIES:${category}`)

      // Add status
      const status = event.hasFile ? 'CONFIRMED' : 'TENTATIVE'
      lines.push(`STATUS:${status}`)

      lines.push('END:VEVENT')
    }

    lines.push('END:VCALENDAR')

    return lines.join('\r\n')
  }

  /**
   * Format date for iCal
   */
  private formatIcalDate(date: DateTime): string {
    return date.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")
  }

  /**
   * Escape text for iCal format
   */
  private escapeIcalText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
  }

  /**
   * Get category name for media type
   */
  private getCategoryName(mediaType: string): string {
    switch (mediaType) {
      case 'episode':
        return 'TV Shows'
      case 'movie':
        return 'Movies'
      case 'album':
        return 'Music'
      case 'book':
        return 'Books'
      default:
        return 'Media'
    }
  }
}
