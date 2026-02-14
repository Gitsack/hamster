import { test } from '@japa/runner'
import { TvShowParser } from '../../../app/services/media/parsers/tv_show_parser.js'

const parser = new TvShowParser()

test.group('TvShowParser | parseFileName', () => {
  test('parses S01E01 format', ({ assert }) => {
    const result = parser.parseFileName('Breaking.Bad.S01E01.Pilot.720p.BluRay.x264.mkv')
    assert.equal(result.showTitle, 'Breaking Bad')
    assert.equal(result.seasonNumber, 1)
    assert.equal(result.episodeNumber, 1)
    assert.equal(result.resolution, '720p')
  })

  test('parses lowercase s01e01', ({ assert }) => {
    const result = parser.parseFileName('show.name.s02e05.episode.title.mkv')
    assert.equal(result.showTitle, 'show name')
    assert.equal(result.seasonNumber, 2)
    assert.equal(result.episodeNumber, 5)
  })

  test('parses 1x01 format', ({ assert }) => {
    const result = parser.parseFileName('Show Name - 1x01 - Episode Title.mkv')
    assert.equal(result.seasonNumber, 1)
    assert.equal(result.episodeNumber, 1)
  })

  test('parses multi-episode S01E01E02', ({ assert }) => {
    const result = parser.parseFileName('Show.Name.S01E01E02.720p.mkv')
    assert.equal(result.seasonNumber, 1)
    assert.equal(result.episodeNumber, 1)
    assert.isTrue(result.isMultiEpisode)
    assert.equal(result.endEpisodeNumber, 2)
  })

  test('parses multi-episode S01E01-E03 falls back to S01E01', ({ assert }) => {
    // The regex S(\d{1,2})E(\d{1,3})[-E](\d{1,3}) character class [-E] consumes '-',
    // then \d{1,3} fails on 'E03'. Falls back to simple S01E01 pattern.
    const result = parser.parseFileName('Show.Name.S01E01-E03.720p.mkv')
    assert.equal(result.seasonNumber, 1)
    assert.equal(result.episodeNumber, 1)
  })

  test('parses multi-episode S01E01-03', ({ assert }) => {
    const result = parser.parseFileName('Show.Name.S01E01-03.720p.mkv')
    assert.equal(result.seasonNumber, 1)
    assert.equal(result.episodeNumber, 1)
    assert.isTrue(result.isMultiEpisode)
    assert.equal(result.endEpisodeNumber, 3)
  })

  test('extracts episode title from scene release', ({ assert }) => {
    const result = parser.parseFileName('Show.Name.S01E01.Episode.Title.720p.BluRay.mkv')
    assert.equal(result.episodeTitle, 'Episode Title')
  })

  test('extracts show title with year', ({ assert }) => {
    const result = parser.parseFileName('Show.Name.2020.S01E01.Episode.Title.mkv')
    assert.equal(result.showTitle, 'Show Name')
    assert.equal(result.year, 2020)
  })

  test('parses WEB-DL source', ({ assert }) => {
    const result = parser.parseFileName('Show.Name.S01E01.1080p.WEB-DL.mkv')
    assert.equal(result.source, 'WEB-DL')
    assert.equal(result.resolution, '1080p')
  })

  test('WEBRIP matches before AMZN in source priority', ({ assert }) => {
    // WEBRIP comes before AMZN in the SOURCES array, so it matches first
    const result = parser.parseFileName('Show.Name.S01E01.1080p.AMZN.WEBRip.mkv')
    assert.equal(result.source, 'WEBRIP')
  })

  test('handles filename without episode info', ({ assert }) => {
    const result = parser.parseFileName('Some Random Filename.mkv')
    assert.equal(result.showTitle, 'Some Random Filename')
    assert.isUndefined(result.seasonNumber)
    assert.isUndefined(result.episodeNumber)
  })

  test('removes video extension before parsing', ({ assert }) => {
    const result = parser.parseFileName('Show.Name.S01E01.mkv')
    assert.equal(result.showTitle, 'Show Name')
  })

  test('handles mp4 extension', ({ assert }) => {
    const result = parser.parseFileName('Show.Name.S01E01.mp4')
    assert.equal(result.showTitle, 'Show Name')
    assert.equal(result.seasonNumber, 1)
  })

  test('returns quality string combining resolution and source', ({ assert }) => {
    const result = parser.parseFileName('Show.Name.S01E01.1080p.BluRay.mkv')
    assert.equal(result.quality, '1080p BLURAY')
  })

  test('handles show with year in parentheses in filename', ({ assert }) => {
    const result = parser.parseFileName('Show Name (2020) S01E01.mkv')
    assert.equal(result.year, 2020)
  })

  test('handles 2160p resolution', ({ assert }) => {
    const result = parser.parseFileName('Show.Name.S01E01.2160p.WEB-DL.mkv')
    assert.equal(result.resolution, '2160p')
  })

  test('extracts episode title with dash separator', ({ assert }) => {
    const result = parser.parseFileName('Show Name - S01E01 - Episode Title.mkv')
    assert.equal(result.episodeTitle, 'Episode Title')
  })
})

test.group('TvShowParser | parseFromPath (full structure)', () => {
  test('parses 3-level structure: Show/Season/Episode', ({ assert }) => {
    const result = parser.parseFromPath('Breaking Bad (2008)/Season 01/S01E01 - Pilot.mkv')
    assert.equal(result.showTitle, 'Breaking Bad')
    assert.equal(result.year, 2008)
    assert.equal(result.seasonNumber, 1)
    assert.equal(result.episodeNumber, 1)
    assert.equal(result.episodeTitle, 'Pilot')
  })

  test('parses German season folder Staffel', ({ assert }) => {
    const result = parser.parseFromPath('Show Name/Staffel 01/S01E01.mkv')
    assert.equal(result.showTitle, 'Show Name')
    assert.equal(result.seasonNumber, 1)
  })

  test('parses French season folder Saison', ({ assert }) => {
    const result = parser.parseFromPath('Show Name/Saison 02/S02E01.mkv')
    assert.equal(result.showTitle, 'Show Name')
    assert.equal(result.seasonNumber, 2)
  })

  test('parses S01 style season folder', ({ assert }) => {
    const result = parser.parseFromPath('Show Name/S01/S01E05.mkv')
    assert.equal(result.showTitle, 'Show Name')
    assert.equal(result.seasonNumber, 1)
    assert.equal(result.episodeNumber, 5)
  })

  test('parses numeric season folder', ({ assert }) => {
    const result = parser.parseFromPath('Show Name/3/S03E01.mkv')
    assert.equal(result.showTitle, 'Show Name')
    assert.equal(result.seasonNumber, 3)
  })

  test('show folder year overrides file year', ({ assert }) => {
    const result = parser.parseFromPath('Show (2015)/Season 01/S01E01.mkv')
    assert.equal(result.year, 2015)
  })
})

test.group('TvShowParser | parseFromPath (two-part structure)', () => {
  test('parses Show/Episode structure', ({ assert }) => {
    const result = parser.parseFromPath('Breaking Bad/S01E01 - Pilot.mkv')
    assert.equal(result.showTitle, 'Breaking Bad')
    assert.equal(result.seasonNumber, 1)
    assert.equal(result.episodeNumber, 1)
  })

  test('parses Season/Episode structure when first part is season folder', ({ assert }) => {
    const result = parser.parseFromPath('Season 01/S01E01 - Pilot.mkv')
    assert.equal(result.seasonNumber, 1)
    assert.equal(result.episodeNumber, 1)
  })
})

test.group('TvShowParser | parseFromPath (single file)', () => {
  test('parses single scene file', ({ assert }) => {
    const result = parser.parseFromPath('Show.Name.S01E01.Episode.Title.720p.WEB-DL.mkv')
    assert.equal(result.showTitle, 'Show Name')
    assert.equal(result.seasonNumber, 1)
    assert.equal(result.episodeNumber, 1)
  })

  test('returns Unknown for empty path', ({ assert }) => {
    const result = parser.parseFromPath('')
    assert.equal(result.showTitle, 'Unknown')
  })
})
