import type {
  AppSettings,
  NamingPatternsData,
  PlaybackSettings,
  QualityProfile,
  RootFolder,
  StreamingProvider,
} from './library_catalog'
import type { HealthSummary } from '@/components/system/system_api'
import type { SubtitlePruningOptions } from '@/components/settings/subtitle-pruning-section'
import type { CustomFormat } from '@/components/settings/custom-formats-section'

/**
 * Canned API answers for Settings → Media, Quality and Discovery: the stories
 * and the tests share them. Movies, TV and music are on; the TV folder is short
 * on space, the music folder has gone missing, and books are off.
 */

export const SETTINGS_FIXTURE: AppSettings = {
  enabledMediaTypes: ['movies', 'tv', 'music'],
  hasTmdbApiKey: true,
  simklClientId: 'a1b2c3d4e5',
  accounts: [
    { id: 'simkl', label: 'Simkl', configured: true, account: { username: 'operator' } },
    { id: 'trakt', label: 'Trakt', configured: false, account: null },
  ],
  recommendationSettings: {
    simklEnabled: true,
    personalizedEnabled: true,
    maxPersonalizedLanes: 3,
    justwatchEnabled: true,
  },
  justwatchEnabled: true,
  justwatchLocale: 'de_DE',
  selectedStreamingProviders: [8, 337],
}

export const ROOT_FOLDERS_FIXTURE: RootFolder[] = [
  { id: 'rf-movies', path: '/media/movies', name: null, mediaType: 'movies', accessible: true },
  { id: 'rf-tv', path: '/media/tv', name: null, mediaType: 'tv', accessible: true },
  { id: 'rf-music', path: '/media/music', name: null, mediaType: 'music', accessible: false },
]

const GB = 1024 ** 3

export const HEALTH_SUMMARY_FIXTURE: HealthSummary = {
  level: 'warning',
  checkedAt: '2026-09-27T11:04:00.000Z',
  stale: false,
  checking: false,
  checks: [],
  downloadClients: [],
  rootFolders: [
    {
      id: 'rf-movies',
      path: '/media/movies',
      mediaType: 'movies',
      status: 'ok',
      message: 'Readable',
      freeBytes: 1.2 * 1024 * GB,
    },
    {
      id: 'rf-tv',
      path: '/media/tv',
      mediaType: 'tv',
      status: 'warning',
      message: 'Low space (6.1 GB free)',
      freeBytes: 6.1 * GB,
    },
    {
      id: 'rf-music',
      path: '/media/music',
      mediaType: 'music',
      status: 'error',
      message: 'ENOENT: no such file or directory',
      freeBytes: null,
    },
  ],
  freeBytes: 1.2 * 1024 * GB,
  failedTasks: [],
}

export const NAMING_FIXTURE: NamingPatternsData = {
  patterns: {
    movies: { movieFolder: '{title} ({year})', movieFile: '{title} ({year}) - {quality}' },
    tv: {
      showFolder: '{title} ({year})',
      seasonFolder: 'Season {season:00}',
      episodeFile: '{title} - S{season:00}E{episode:00} - {episodeTitle}',
    },
    music: {
      artistFolder: '{artist}',
      albumFolder: '{album} ({year})',
      trackFile: '{track:00} - {title}',
    },
    books: { authorFolder: '{author}', bookFile: '{title}' },
  },
  variables: {
    movies: {
      movieFolder: [
        { name: 'title', description: 'Movie title', example: 'Arrival' },
        { name: 'year', description: 'Release year', example: '2016' },
      ],
      movieFile: [
        { name: 'title', description: 'Movie title', example: 'Arrival' },
        { name: 'year', description: 'Release year', example: '2016' },
        { name: 'quality', description: 'Quality', example: 'Bluray-1080p' },
      ],
    },
    tv: {
      showFolder: [
        { name: 'title', description: 'Show title', example: 'Severance' },
        { name: 'year', description: 'First aired', example: '2022' },
      ],
      seasonFolder: [{ name: 'season:00', description: 'Season, padded', example: '02' }],
      episodeFile: [
        { name: 'title', description: 'Show title', example: 'Severance' },
        { name: 'season:00', description: 'Season, padded', example: '02' },
        { name: 'episode:00', description: 'Episode, padded', example: '03' },
        { name: 'episodeTitle', description: 'Episode title', example: 'Who Is Alive?' },
      ],
    },
    music: {
      artistFolder: [{ name: 'artist', description: 'Artist', example: 'Björk' }],
      albumFolder: [
        { name: 'album', description: 'Album', example: 'Homogenic' },
        { name: 'year', description: 'Year', example: '1997' },
      ],
      trackFile: [
        { name: 'track:00', description: 'Track, padded', example: '01' },
        { name: 'title', description: 'Track title', example: 'Hunter' },
      ],
    },
    books: {
      authorFolder: [{ name: 'author', description: 'Author', example: 'Ursula K. Le Guin' }],
      bookFile: [{ name: 'title', description: 'Title', example: 'The Dispossessed' }],
    },
  },
  examples: {
    movies: { movieFolder: 'Arrival (2016)', movieFile: 'Arrival (2016) - Bluray-1080p.mkv' },
    tv: {
      showFolder: 'Severance (2022)',
      seasonFolder: 'Season 02',
      episodeFile: 'Severance - S02E03 - Who Is Alive?.mkv',
    },
    music: {
      artistFolder: 'Björk',
      albumFolder: 'Homogenic (1997)',
      trackFile: '01 - Hunter.flac',
    },
    books: { authorFolder: 'Ursula K. Le Guin', bookFile: 'The Dispossessed.epub' },
  },
}

export const SUBTITLE_FIXTURE: { options: SubtitlePruningOptions; ffmpegAvailable: boolean } = {
  options: { enabled: true, maxTracks: 20, keepLanguages: ['en', 'de'] },
  ffmpegAvailable: true,
}

export const PLAYBACK_FIXTURE: PlaybackSettings = {
  transcoding: {
    useHardwareAcceleration: true,
    hardwareAccelType: 'auto',
    vaapiDevice: '/dev/dri/renderD128',
    useForVersions: true,
  },
  availableHardwareAccel: ['vaapi', 'qsv'],
  gpu: { qsv: true, vaapi: 'ICQ' },
  devices: ['/dev/dri/renderD128'],
}

const VIDEO_ITEMS = [
  { id: 1, name: 'Bluray 2160p', allowed: false },
  { id: 2, name: 'Bluray 1080p', allowed: true },
  { id: 3, name: 'Bluray 720p', allowed: true },
  { id: 4, name: 'Web 2160p', allowed: false },
  { id: 5, name: 'Web 1080p', allowed: true },
  { id: 6, name: 'Web 720p', allowed: true },
  { id: 7, name: 'HDTV 1080p', allowed: false },
  { id: 8, name: 'HDTV 720p', allowed: false },
  { id: 9, name: 'DVD', allowed: false },
]

export const PROFILES_FIXTURE: QualityProfile[] = [
  {
    id: 'qp-hd',
    name: 'HD 1080p',
    mediaType: 'movies',
    cutoff: 2,
    upgradeAllowed: true,
    minSizeMb: 2048,
    maxSizeMb: 15360,
    items: VIDEO_ITEMS,
    requirements: null,
  },
  {
    id: 'qp-any',
    name: 'Anything watchable',
    mediaType: 'movies',
    cutoff: 5,
    upgradeAllowed: false,
    minSizeMb: null,
    maxSizeMb: null,
    items: VIDEO_ITEMS.map((item) => ({ ...item, allowed: true })),
    requirements: null,
  },
  {
    id: 'qp-tv',
    name: 'TV 1080p',
    mediaType: 'tv',
    cutoff: 5,
    upgradeAllowed: true,
    minSizeMb: 700,
    maxSizeMb: 4096,
    items: VIDEO_ITEMS,
    requirements: null,
  },
  {
    id: 'qp-lossless',
    name: 'Lossless',
    mediaType: 'music',
    cutoff: 1,
    upgradeAllowed: true,
    minSizeMb: null,
    maxSizeMb: null,
    items: [
      { id: 1, name: 'FLAC', allowed: true },
      { id: 2, name: 'ALAC', allowed: true },
      { id: 3, name: 'WAV', allowed: false },
    ],
    requirements: null,
  },
]

export const CUSTOM_FORMATS_FIXTURE: CustomFormat[] = [
  {
    id: 'cf-atmos',
    name: 'Atmos audio',
    includeWhenRenaming: false,
    specifications: [
      { name: 'Atmos', implementation: 'contains', negate: false, required: true, value: 'Atmos' },
    ],
  },
  {
    id: 'cf-framestor',
    name: 'Trusted group',
    includeWhenRenaming: true,
    specifications: [
      {
        name: 'FraMeSToR',
        implementation: 'releaseGroup',
        negate: false,
        required: false,
        value: 'FraMeSToR',
      },
    ],
  },
]

const LOGO =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#71717a"/></svg>'
  )

export const PROVIDERS_FIXTURE: StreamingProvider[] = [
  { id: 8, name: 'Netflix', logoPath: LOGO },
  { id: 337, name: 'Disney Plus', logoPath: LOGO },
  { id: 9, name: 'Amazon Prime Video', logoPath: LOGO },
  { id: 350, name: 'Apple TV Plus', logoPath: LOGO },
  { id: 30, name: 'WOW', logoPath: LOGO },
  { id: 531, name: 'Paramount Plus', logoPath: LOGO },
]

export interface LibraryStubOptions {
  settings?: AppSettings
  rootFolders?: RootFolder[]
  profiles?: QualityProfile[]
  providers?: StreamingProvider[]
  /** Paths answered with HTTP 500. */
  failing?: string[]
}

function json(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : status === 204 ? 'No Content' : 'Internal Server Error',
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * A fetch that answers the library settings API from the fixtures, and
 * remembers writes so a later GET returns them. Unknown URLs get a 404.
 */
export function libraryFetchStub(options: LibraryStubOptions = {}) {
  let settings: AppSettings = structuredClone(options.settings ?? SETTINGS_FIXTURE)
  let profiles = structuredClone(options.profiles ?? PROFILES_FIXTURE)
  let subtitle = structuredClone(SUBTITLE_FIXTURE)
  let playback = structuredClone(PLAYBACK_FIXTURE)
  const naming = structuredClone(NAMING_FIXTURE)
  const rootFolders = structuredClone(options.rootFolders ?? ROOT_FOLDERS_FIXTURE)
  const formats = structuredClone(CUSTOM_FORMATS_FIXTURE)
  const failing = new Set(options.failing ?? [])

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const path = url.split('?')[0]
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    if (failing.has(path)) return json({ error: 'Something broke' }, 500)

    if (path === '/api/v1/settings') {
      if (method === 'PUT') {
        const { tmdbApiKey, ...rest } = body
        settings = { ...settings, ...rest }
        if (typeof tmdbApiKey === 'string') settings.hasTmdbApiKey = tmdbApiKey !== ''
      }
      return json(settings)
    }
    if (path === '/api/v1/settings/media-type' && method === 'POST') {
      const types = settings.enabledMediaTypes.filter((t) => t !== body.mediaType)
      settings = {
        ...settings,
        enabledMediaTypes: body.enabled ? [...types, body.mediaType] : types,
      }
      return json({ enabledMediaTypes: settings.enabledMediaTypes })
    }
    if (path === '/api/v1/rootfolders') return json(rootFolders)
    if (path === '/api/v1/system/health-summary') return json(HEALTH_SUMMARY_FIXTURE)
    if (path === '/api/v1/settings/naming-patterns') {
      if (method === 'PUT') {
        const bad = Object.entries(body.patterns as Record<string, string>).find(([, p]) =>
          p.includes('{nope}')
        )
        if (bad) {
          return json(
            { error: 'Invalid patterns', details: { [bad[0]]: ['Unknown variable: {nope}'] } },
            400
          )
        }
        naming.patterns[body.mediaType as keyof typeof naming.patterns] = body.patterns
        return json({ patterns: body.patterns, examples: naming.examples[body.mediaType as 'tv'] })
      }
      return json(naming)
    }
    if (path === '/api/v1/settings/subtitle-pruning') {
      if (method === 'PUT') subtitle = { ...subtitle, options: body }
      return json(method === 'PUT' ? { options: subtitle.options } : subtitle)
    }
    if (path === '/api/v1/settings/playback') {
      if (method === 'PUT') playback = { ...playback, transcoding: body.transcoding }
      return json(playback)
    }
    if (path === '/api/v1/qualityprofiles') {
      if (method === 'POST') {
        const created = { ...body, id: `qp-${profiles.length + 1}` } as QualityProfile
        profiles = [...profiles, created]
        return json(created)
      }
      return json(profiles)
    }
    const profileMatch = path.match(/^\/api\/v1\/qualityprofiles\/([^/]+)$/)
    if (profileMatch) {
      if (method === 'DELETE') {
        profiles = profiles.filter((p) => p.id !== profileMatch[1])
        return json(null, 204)
      }
      if (method === 'PUT') {
        const updated = { ...body, id: profileMatch[1] } as QualityProfile
        profiles = profiles.map((p) => (p.id === updated.id ? updated : p))
        return json(updated)
      }
    }
    if (path === '/api/v1/customformats') return json(formats)
    if (path.startsWith('/api/v1/customformats/')) return json({ qualityProfiles: [] })
    if (path === '/api/v1/settings/watch-providers') {
      return json({ providers: options.providers ?? PROVIDERS_FIXTURE })
    }
    return json({ error: `No stub for ${method} ${path}` }, 404)
  }
}
