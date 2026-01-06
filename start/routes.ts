/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

const AuthController = () => import('#controllers/auth_controller')
const RootFoldersController = () => import('#controllers/root_folders_controller')
const QualityProfilesController = () => import('#controllers/quality_profiles_controller')
const IndexersController = () => import('#controllers/indexers_controller')
const ProwlarrController = () => import('#controllers/prowlarr_controller')
const ArtistsController = () => import('#controllers/artists_controller')
const AlbumsController = () => import('#controllers/albums_controller')
const TracksController = () => import('#controllers/tracks_controller')
const MoviesController = () => import('#controllers/movies_controller')
const TvShowsController = () => import('#controllers/tv_shows_controller')
const AuthorsController = () => import('#controllers/authors_controller')
const BooksController = () => import('#controllers/books_controller')
const DownloadClientsController = () => import('#controllers/download_clients_controller')
const QueueController = () => import('#controllers/queue_controller')
const PlaybackController = () => import('#controllers/playback_controller')
const AppSettingsController = () => import('#controllers/app_settings_controller')
const FilesystemController = () => import('#controllers/filesystem_controller')
const FilesController = () => import('#controllers/files_controller')
const UnmatchedFilesController = () => import('#controllers/unmatched_files_controller')

// Health check endpoint (for Docker/load balancers)
router.get('/health', async ({ response }) => {
  return response.ok({ status: 'ok', timestamp: new Date().toISOString() })
})

// Public routes (with silent auth to check if user is logged in)
router
  .group(() => {
    router.on('/').renderInertia('home')
    router.on('/getting-started').renderInertia('getting-started')
  })
  .use(middleware.silentAuth())

// Guest routes (only accessible when not logged in)
router
  .group(() => {
    router.get('/login', [AuthController, 'showLogin']).as('login')
    router.post('/login', [AuthController, 'login'])
    router.get('/register', [AuthController, 'showRegister']).as('register')
    router.post('/register', [AuthController, 'register'])
  })
  .use(middleware.guest())

// Auth routes (only accessible when logged in)
router
  .group(() => {
    router.post('/logout', [AuthController, 'logout']).as('logout')
  })
  .use(middleware.auth())

// Protected app routes
router
  .group(() => {
    // Library
    router.on('/library').renderInertia('library/index').as('library')
    router.on('/library/add').renderInertia('library/add').as('library.add')
    // Music
    router.on('/artist/:id').renderInertia('library/artist/[id]').as('artist')
    router.on('/album/:id').renderInertia('library/album/[id]').as('album')
    // Movies
    router.on('/movie/:id').renderInertia('library/movie/[id]').as('movie')
    // TV
    router.on('/tvshow/:id').renderInertia('library/tvshow/[id]').as('tvshow')
    // Books
    router.on('/author/:id').renderInertia('library/author/[id]').as('author')
    router.on('/book/:id').renderInertia('library/book/[id]').as('book')

    // Search
    router.on('/search').renderInertia('search/index').as('search')

    // Requests - redirect to library missing tab
    router.get('/requests', async ({ response }) => response.redirect('/library?tab=missing'))
    router.get('/requests/search/:id', async ({ response }) => response.redirect('/library?tab=missing'))

    // Activity
    router.on('/activity/queue').renderInertia('activity/queue').as('activity.queue')
    router.on('/activity/history').renderInertia('activity/history').as('activity.history')

    // Settings
    router.get('/settings', async ({ response }) => response.redirect('/settings/media-management'))
    router.on('/settings/media-management').renderInertia('settings/media-management').as('settings.media-management')
    router.on('/settings/indexers').renderInertia('settings/indexers').as('settings.indexers')
    router.on('/settings/download-clients').renderInertia('settings/download-clients').as('settings.download-clients')
    router.on('/settings/ui').renderInertia('settings/ui').as('settings.ui')
  })
  .use(middleware.auth())

// API routes
router
  .group(() => {
    // Root folders
    router.get('/rootfolders', [RootFoldersController, 'index'])
    router.post('/rootfolders', [RootFoldersController, 'store'])
    router.post('/rootfolders/scan-all', [RootFoldersController, 'scanAll'])
    router.get('/rootfolders/:id', [RootFoldersController, 'show'])
    router.put('/rootfolders/:id', [RootFoldersController, 'update'])
    router.delete('/rootfolders/:id', [RootFoldersController, 'destroy'])
    router.post('/rootfolders/:id/scan', [RootFoldersController, 'scan'])
    router.get('/rootfolders/:id/scan-status', [RootFoldersController, 'scanStatus'])

    // Quality profiles
    router.get('/qualityprofiles', [QualityProfilesController, 'index'])
    router.post('/qualityprofiles', [QualityProfilesController, 'store'])
    router.get('/qualityprofiles/:id', [QualityProfilesController, 'show'])
    router.put('/qualityprofiles/:id', [QualityProfilesController, 'update'])
    router.delete('/qualityprofiles/:id', [QualityProfilesController, 'destroy'])

    // Indexers
    router.get('/indexers', [IndexersController, 'index'])
    router.post('/indexers', [IndexersController, 'store'])
    router.post('/indexers/test', [IndexersController, 'test'])
    router.get('/indexers/search', [IndexersController, 'search'])
    router.get('/indexers/:id', [IndexersController, 'show'])
    router.put('/indexers/:id', [IndexersController, 'update'])
    router.delete('/indexers/:id', [IndexersController, 'destroy'])

    // Prowlarr
    router.get('/prowlarr', [ProwlarrController, 'show'])
    router.put('/prowlarr', [ProwlarrController, 'update'])
    router.post('/prowlarr/test', [ProwlarrController, 'test'])
    router.post('/prowlarr/sync', [ProwlarrController, 'sync'])
    router.get('/prowlarr/indexers', [ProwlarrController, 'indexers'])

    // Artists
    router.get('/artists', [ArtistsController, 'index'])
    router.post('/artists', [ArtistsController, 'store'])
    router.get('/artists/search', [ArtistsController, 'search'])
    router.get('/artists/:id', [ArtistsController, 'show'])
    router.get('/artists/:mbid/albums', [ArtistsController, 'albumsByMbid'])
    router.put('/artists/:id', [ArtistsController, 'update'])
    router.delete('/artists/:id', [ArtistsController, 'destroy'])
    router.post('/artists/:id/refresh', [ArtistsController, 'refresh'])
    router.post('/artists/:id/enrich', [ArtistsController, 'enrich'])

    // Albums
    router.get('/albums', [AlbumsController, 'index'])
    router.post('/albums', [AlbumsController, 'store'])
    router.get('/albums/search', [AlbumsController, 'search'])
    router.get('/albums/requested', [AlbumsController, 'requested'])
    router.get('/albums/wanted', [AlbumsController, 'requested']) // Alias for backwards compatibility
    router.get('/albums/:id', [AlbumsController, 'show'])
    router.get('/albums/:mbid/tracks', [AlbumsController, 'tracksByMbid'])
    router.put('/albums/:id', [AlbumsController, 'update'])
    router.get('/albums/:id/releases', [AlbumsController, 'searchReleases'])
    router.post('/albums/:id/download', [AlbumsController, 'searchAndDownload'])
    router.post('/albums/:id/search', [AlbumsController, 'searchNow'])
    router.post('/albums/:id/enrich', [AlbumsController, 'enrich'])
    router.get('/albums/:id/files', [AlbumsController, 'files'])

    // Tracks
    router.get('/tracks/search', [TracksController, 'search'])

    // Movies
    router.get('/movies', [MoviesController, 'index'])
    router.post('/movies', [MoviesController, 'store'])
    router.get('/movies/search', [MoviesController, 'search'])
    router.get('/movies/discover', [MoviesController, 'discover'])
    router.get('/movies/requested', [MoviesController, 'requested'])
    router.get('/movies/:id', [MoviesController, 'show'])
    router.put('/movies/:id', [MoviesController, 'update'])
    router.delete('/movies/:id', [MoviesController, 'destroy'])
    router.delete('/movies/:id/file', [MoviesController, 'deleteFile'])
    router.post('/movies/:id/request', [MoviesController, 'setWanted'])
    router.post('/movies/:id/download', [MoviesController, 'download'])
    router.post('/movies/:id/search', [MoviesController, 'searchNow'])
    router.post('/movies/:id/enrich', [MoviesController, 'enrich'])

    // TV Shows
    router.get('/tvshows', [TvShowsController, 'index'])
    router.post('/tvshows', [TvShowsController, 'store'])
    router.get('/tvshows/search', [TvShowsController, 'search'])
    router.get('/tvshows/discover', [TvShowsController, 'discover'])
    router.get('/tvshows/requested', [TvShowsController, 'requested'])
    router.get('/tvshows/preview-seasons', [TvShowsController, 'previewSeasons'])
    router.get('/tvshows/preview-episodes', [TvShowsController, 'previewEpisodes'])
    router.get('/tvshows/:id', [TvShowsController, 'show'])
    router.put('/tvshows/:id', [TvShowsController, 'update'])
    router.delete('/tvshows/:id', [TvShowsController, 'destroy'])
    router.get('/tvshows/:id/season/:seasonNumber', [TvShowsController, 'showSeason'])
    router.post('/tvshows/:id/season/:seasonNumber/request', [TvShowsController, 'setSeasonWanted'])
    router.post('/tvshows/:id/episodes/:episodeId/request', [TvShowsController, 'setEpisodeWanted'])
    router.delete('/tvshows/:id/episodes/:episodeId/file', [TvShowsController, 'deleteEpisodeFile'])
    router.post('/tvshows/:id/search', [TvShowsController, 'searchNow'])
    router.post('/tvshows/:id/episodes/:episodeId/search', [TvShowsController, 'searchEpisodeNow'])
    router.post('/tvshows/:id/enrich', [TvShowsController, 'enrich'])

    // Authors
    router.get('/authors', [AuthorsController, 'index'])
    router.post('/authors', [AuthorsController, 'store'])
    router.get('/authors/search', [AuthorsController, 'search'])
    router.get('/authors/:id', [AuthorsController, 'show'])
    router.get('/authors/:openlibraryId/works', [AuthorsController, 'worksByOpenlibraryId'])
    router.put('/authors/:id', [AuthorsController, 'update'])
    router.delete('/authors/:id', [AuthorsController, 'destroy'])
    router.post('/authors/:id/refresh', [AuthorsController, 'refresh'])

    // Books
    router.get('/books', [BooksController, 'index'])
    router.post('/books', [BooksController, 'store'])
    router.get('/books/search', [BooksController, 'search'])
    router.get('/books/requested', [BooksController, 'requested'])
    router.get('/books/:id', [BooksController, 'show'])
    router.put('/books/:id', [BooksController, 'update'])
    router.delete('/books/:id', [BooksController, 'destroy'])
    router.delete('/books/:id/file', [BooksController, 'deleteFile'])
    router.post('/books/:id/request', [BooksController, 'setWanted'])
    router.post('/books/:id/download', [BooksController, 'download'])
    router.post('/books/:id/search', [BooksController, 'searchNow'])

    // Download clients
    router.get('/downloadclients', [DownloadClientsController, 'index'])
    router.post('/downloadclients', [DownloadClientsController, 'store'])
    router.get('/downloadclients/:id', [DownloadClientsController, 'show'])
    router.put('/downloadclients/:id', [DownloadClientsController, 'update'])
    router.delete('/downloadclients/:id', [DownloadClientsController, 'destroy'])
    router.post('/downloadclients/test', [DownloadClientsController, 'test'])
    router.get('/downloadclients/:id/browse', [DownloadClientsController, 'browseDownloads'])
    router.post('/downloadclients/:id/import', [DownloadClientsController, 'importFromPath'])
    router.get('/downloadclients/:id/download', [DownloadClientsController, 'downloadFile'])

    // Queue
    router.get('/queue', [QueueController, 'index'])
    router.get('/queue/debug', [QueueController, 'debug'])
    router.get('/queue/failed', [QueueController, 'failed'])
    router.post('/queue/refresh', [QueueController, 'refresh'])
    router.post('/queue/scan-completed', [QueueController, 'scanCompleted'])
    router.post('/queue/clear-failed', [QueueController, 'clearFailed'])
    router.post('/queue/:id/import', [QueueController, 'import'])
    router.post('/queue/:id/retry', [QueueController, 'retryImport'])
    router.delete('/queue/:id', [QueueController, 'destroy'])
    router.get('/queue/history', [QueueController, 'history'])
    router.post('/queue/grab', [QueueController, 'grab'])
    router.post('/queue/search-requested', [QueueController, 'searchRequested'])
    router.get('/queue/requested-status', [QueueController, 'requestedStatus'])

    // Playback
    router.get('/playback/stream/:id', [PlaybackController, 'stream'])
    router.get('/playback/info/:id', [PlaybackController, 'info'])
    router.get('/playback/artwork/:id', [PlaybackController, 'artwork'])
    router.get('/playback/album/:id/playlist', [PlaybackController, 'albumPlaylist'])
    router.get('/playback/movie/:id', [PlaybackController, 'streamMovie'])
    router.get('/playback/episode/:id', [PlaybackController, 'streamEpisode'])

    // App Settings
    router.get('/settings', [AppSettingsController, 'index'])
    router.put('/settings', [AppSettingsController, 'update'])
    router.post('/settings/media-type', [AppSettingsController, 'toggleMediaType'])
    router.get('/settings/naming-patterns', [AppSettingsController, 'getNamingPatterns'])
    router.put('/settings/naming-patterns', [AppSettingsController, 'updateNamingPatterns'])

    // Filesystem browser
    router.get('/filesystem/browse', [FilesystemController, 'browse'])
    router.get('/filesystem/quick-paths', [FilesystemController, 'quickPaths'])
    router.get('/filesystem/check', [FilesystemController, 'checkPath'])

    // File downloads
    router.get('/files/movies/:id/download', [FilesController, 'downloadMovie'])
    router.get('/files/episodes/:id/download', [FilesController, 'downloadEpisode'])
    router.get('/files/books/:id/download', [FilesController, 'downloadBook'])
    router.get('/files/tracks/:id/download', [FilesController, 'downloadTrack'])
    router.post('/files/sync-status', [FilesController, 'syncFileStatus'])
    router.post('/files/scan-completed', [FilesController, 'scanCompletedDownloads'])
    router.post('/files/scan-folders', [FilesController, 'scanFolders'])
    router.post('/files/scan-all', [FilesController, 'scanAll'])

    // Unmatched files (library scanner results)
    router.get('/unmatched', [UnmatchedFilesController, 'index'])
    router.get('/unmatched/stats', [UnmatchedFilesController, 'stats'])
    router.get('/unmatched/:id', [UnmatchedFilesController, 'show'])
    router.put('/unmatched/:id', [UnmatchedFilesController, 'update'])
    router.post('/unmatched/:id/ignore', [UnmatchedFilesController, 'ignore'])
    router.delete('/unmatched/:id', [UnmatchedFilesController, 'destroy'])
    router.post('/unmatched/bulk-update', [UnmatchedFilesController, 'bulkUpdate'])
    router.post('/unmatched/bulk-delete', [UnmatchedFilesController, 'bulkDestroy'])
  })
  .prefix('/api/v1')
  .use(middleware.auth())

