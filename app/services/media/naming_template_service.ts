import type { MediaType } from '#models/app_setting'

export interface TemplateVariable {
  name: string
  description: string
  example: string
}

export interface NamingPatterns {
  music: {
    artistFolder: string
    albumFolder: string
    trackFile: string
  }
  movies: {
    movieFolder: string
    movieFile: string
  }
  tv: {
    showFolder: string
    seasonFolder: string
    episodeFile: string
  }
  books: {
    authorFolder: string
    bookFile: string
  }
}

// Default patterns for each media type
export const defaultNamingPatterns: NamingPatterns = {
  music: {
    artistFolder: '{artist_name}',
    albumFolder: '[{year}] {album_title}',
    trackFile: '{track_number} - {track_title}',
  },
  movies: {
    movieFolder: '{movie_title} ({year})',
    movieFile: '{movie_title} ({year})',
  },
  tv: {
    showFolder: '{show_title} ({year})',
    seasonFolder: 'Season {season_number}',
    episodeFile: '{show_title} - S{season_number}E{episode_number} - {episode_title}',
  },
  books: {
    authorFolder: '{author_name}',
    bookFile: '{book_title} ({year})',
  },
}

// Available variables per media type
export const templateVariables: Record<MediaType, Record<string, TemplateVariable[]>> = {
  music: {
    artistFolder: [{ name: 'artist_name', description: 'Artist name', example: 'Michael Jackson' }],
    albumFolder: [
      { name: 'album_title', description: 'Album title', example: 'Thriller' },
      { name: 'year', description: 'Release year', example: '1982' },
    ],
    trackFile: [
      { name: 'track_number', description: 'Track number (zero-padded)', example: '01' },
      { name: 'track_title', description: 'Track title', example: 'Beat It' },
      { name: 'disc_number', description: 'Disc number', example: '1' },
    ],
  },
  movies: {
    movieFolder: [
      { name: 'movie_title', description: 'Movie title', example: 'The Matrix' },
      { name: 'year', description: 'Release year', example: '1999' },
    ],
    movieFile: [
      { name: 'movie_title', description: 'Movie title', example: 'The Matrix' },
      { name: 'year', description: 'Release year', example: '1999' },
      { name: 'quality', description: 'Video quality', example: '1080p' },
    ],
  },
  tv: {
    showFolder: [
      { name: 'show_title', description: 'Show title', example: 'Breaking Bad' },
      { name: 'year', description: 'First air year', example: '2008' },
    ],
    seasonFolder: [
      { name: 'season_number', description: 'Season number (zero-padded)', example: '01' },
    ],
    episodeFile: [
      { name: 'show_title', description: 'Show title', example: 'Breaking Bad' },
      { name: 'season_number', description: 'Season number (zero-padded)', example: '01' },
      { name: 'episode_number', description: 'Episode number (zero-padded)', example: '01' },
      { name: 'episode_title', description: 'Episode title', example: 'Pilot' },
    ],
  },
  books: {
    authorFolder: [{ name: 'author_name', description: 'Author name', example: 'Stephen King' }],
    bookFile: [
      { name: 'book_title', description: 'Book title', example: 'The Shining' },
      { name: 'year', description: 'Publication year', example: '1977' },
    ],
  },
}

export class NamingTemplateService {
  /**
   * Parse a template pattern and replace variables with actual values
   * Variables are in the format {variable_name}
   */
  parseTemplate(pattern: string, variables: Record<string, string | number | undefined>): string {
    return (
      pattern
        .replace(/\{(\w+)\}/g, (_match, varName) => {
          const value = variables[varName]
          if (value === undefined || value === null || value === '') {
            // Remove the placeholder and any surrounding brackets/parentheses if value is missing
            return ''
          }
          return String(value)
        })
        // Clean up empty brackets/parentheses left by missing values
        .replace(/\s*\(\s*\)/g, '')
        .replace(/\s*\[\s*\]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
  }

  /**
   * Get available variables for a specific media type and field
   */
  getVariables(mediaType: MediaType, field: string): TemplateVariable[] {
    return templateVariables[mediaType]?.[field] || []
  }

  /**
   * Get all variables for a media type
   */
  getAllVariables(mediaType: MediaType): Record<string, TemplateVariable[]> {
    return templateVariables[mediaType] || {}
  }

  /**
   * Generate example output for a pattern
   */
  generateExample(mediaType: MediaType, field: string, pattern: string): string {
    const vars = this.getVariables(mediaType, field)
    const exampleValues: Record<string, string> = {}

    for (const v of vars) {
      exampleValues[v.name] = v.example
    }

    return this.parseTemplate(pattern, exampleValues)
  }

  /**
   * Validate a pattern - check if all variables are valid for the field
   */
  validatePattern(
    mediaType: MediaType,
    field: string,
    pattern: string
  ): { valid: boolean; invalidVars: string[] } {
    const validVars = this.getVariables(mediaType, field).map((v) => v.name)
    const usedVars = pattern.match(/\{(\w+)\}/g)?.map((m) => m.slice(1, -1)) || []
    const invalidVars = usedVars.filter((v) => !validVars.includes(v))

    return {
      valid: invalidVars.length === 0,
      invalidVars,
    }
  }
}

export const namingTemplateService = new NamingTemplateService()
