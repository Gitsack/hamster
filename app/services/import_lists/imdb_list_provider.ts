import type { ImportListSettings } from '#models/import_list'
import type { ImportListItem } from './trakt_list_provider.js'

export class ImdbListProvider {
  /**
   * Fetch items from an IMDb list by list ID.
   * IMDb list URLs look like: https://www.imdb.com/list/ls012345678/
   * We extract titles by parsing the list export CSV endpoint.
   */
  async fetchList(settings: ImportListSettings): Promise<ImportListItem[]> {
    const listId = this.extractListId(settings.imdbListId || '')
    if (!listId) {
      throw new Error('Invalid IMDb list ID. Expected format: ls012345678')
    }

    const csvUrl = `https://www.imdb.com/list/${encodeURIComponent(listId)}/export`

    const response = await fetch(csvUrl, {
      headers: {
        'User-Agent': 'Hamster Media Manager',
      },
    })

    if (!response.ok) {
      throw new Error(
        `Failed to fetch IMDb list: ${response.status}. The list may be private or invalid.`
      )
    }

    const csvText = await response.text()
    return this.parseCsv(csvText)
  }

  /**
   * Parse IMDb CSV export data into import list items.
   * CSV columns: Position,Const,Created,Modified,Description,Title,URL,Title Type,IMDb Rating,
   * Runtime (mins),Year,Genres,Num Votes,Release Date,Directors
   */
  private parseCsv(csvText: string): ImportListItem[] {
    const lines = csvText.split('\n')
    if (lines.length < 2) return []

    // Parse header row to find column indices
    const header = this.parseCsvLine(lines[0])
    const constIdx = header.findIndex((h) => h === 'Const')
    const titleIdx = header.findIndex((h) => h === 'Title')
    const yearIdx = header.findIndex((h) => h === 'Year')
    const typeIdx = header.findIndex((h) => h === 'Title Type')

    if (constIdx === -1 || titleIdx === -1) {
      throw new Error('Unexpected CSV format from IMDb')
    }

    const items: ImportListItem[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const fields = this.parseCsvLine(line)
      const imdbId = fields[constIdx] || null
      const title = fields[titleIdx]
      const year = yearIdx >= 0 ? Number.parseInt(fields[yearIdx]) || null : null
      const titleType = typeIdx >= 0 ? fields[typeIdx]?.toLowerCase() || '' : ''

      if (!title) continue

      // Determine media type from IMDb title type
      const isShow =
        titleType.includes('series') || titleType.includes('mini') || titleType.includes('episode')
      const mediaType = isShow ? 'show' : 'movie'

      items.push({
        title,
        year,
        imdbId,
        tmdbId: null,
        mediaType: mediaType as 'movie' | 'show',
      })
    }

    return items
  }

  /**
   * Parse a single CSV line handling quoted fields
   */
  private parseCsvLine(line: string): string[] {
    const fields: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }

    fields.push(current.trim())
    return fields
  }

  /**
   * Extract list ID from various formats:
   * - ls012345678
   * - https://www.imdb.com/list/ls012345678/
   * - https://www.imdb.com/list/ls012345678
   */
  private extractListId(input: string): string | null {
    if (!input) return null

    // Direct list ID
    const directMatch = input.match(/^(ls\d+)$/)
    if (directMatch) return directMatch[1]

    // URL format
    const urlMatch = input.match(/imdb\.com\/list\/(ls\d+)/)
    if (urlMatch) return urlMatch[1]

    return null
  }
}

export const imdbListProvider = new ImdbListProvider()
