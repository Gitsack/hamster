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
const MetadataProfilesController = () => import('#controllers/metadata_profiles_controller')
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

// Public routes
router.on('/').renderInertia('home')

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

    // Requests
    router.on('/requests').renderInertia('requests/index').as('requests')
    router.on('/requests/search/:id').renderInertia('requests/search/[id]').as('requests.search')

    // Activity
    router.on('/activity/queue').renderInertia('activity/queue').as('activity.queue')
    router.on('/activity/history').renderInertia('activity/history').as('activity.history')

    // Settings
    router.get('/settings', async ({ response }) => response.redirect('/settings/media-management'))
    router.on('/settings/media-management').renderInertia('settings/media-management').as('settings.media-management')
    router.on('/settings/indexers').renderInertia('settings/indexers').as('settings.indexers')
    router.on('/settings/download-clients').renderInertia('settings/download-clients').as('settings.download-clients')
    router.on('/settings/general').renderInertia('settings/general').as('settings.general')
    router.on('/settings/ui').renderInertia('settings/ui').as('settings.ui')
  })
  .use(middleware.auth())

// API routes
router
  .group(() => {
    // Root folders
    router.get('/rootfolders', [RootFoldersController, 'index'])
    router.post('/rootfolders', [RootFoldersController, 'store'])
    router.get('/rootfolders/:id', [RootFoldersController, 'show'])
    router.put('/rootfolders/:id', [RootFoldersController, 'update'])
    router.delete('/rootfolders/:id', [RootFoldersController, 'destroy'])

    // Quality profiles
    router.get('/qualityprofiles', [QualityProfilesController, 'index'])
    router.post('/qualityprofiles', [QualityProfilesController, 'store'])
    router.get('/qualityprofiles/:id', [QualityProfilesController, 'show'])
    router.put('/qualityprofiles/:id', [QualityProfilesController, 'update'])
    router.delete('/qualityprofiles/:id', [QualityProfilesController, 'destroy'])

    // Metadata profiles
    router.get('/metadataprofiles', [MetadataProfilesController, 'index'])
    router.post('/metadataprofiles', [MetadataProfilesController, 'store'])
    router.get('/metadataprofiles/:id', [MetadataProfilesController, 'show'])
    router.put('/metadataprofiles/:id', [MetadataProfilesController, 'update'])
    router.delete('/metadataprofiles/:id', [MetadataProfilesController, 'destroy'])

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
    router.put('/artists/:id', [ArtistsController, 'update'])
    router.delete('/artists/:id', [ArtistsController, 'destroy'])
    router.post('/artists/:id/refresh', [ArtistsController, 'refresh'])

    // Albums
    router.get('/albums', [AlbumsController, 'index'])
    router.post('/albums', [AlbumsController, 'store'])
    router.get('/albums/search', [AlbumsController, 'search'])
    router.get('/albums/wanted', [AlbumsController, 'wanted'])
    router.get('/albums/:id', [AlbumsController, 'show'])
    router.put('/albums/:id', [AlbumsController, 'update'])
    router.get('/albums/:id/releases', [AlbumsController, 'searchReleases'])
    router.post('/albums/:id/download', [AlbumsController, 'searchAndDownload'])
    router.get('/albums/:id/files', [AlbumsController, 'files'])

    // Tracks
    router.get('/tracks/search', [TracksController, 'search'])

    // Movies
    router.get('/movies', [MoviesController, 'index'])
    router.post('/movies', [MoviesController, 'store'])
    router.get('/movies/search', [MoviesController, 'search'])
    router.get('/movies/:id', [MoviesController, 'show'])
    router.put('/movies/:id', [MoviesController, 'update'])
    router.delete('/movies/:id', [MoviesController, 'destroy'])
    router.post('/movies/:id/wanted', [MoviesController, 'setWanted'])
    router.post('/movies/:id/download', [MoviesController, 'download'])

    // TV Shows
    router.get('/tvshows', [TvShowsController, 'index'])
    router.post('/tvshows', [TvShowsController, 'store'])
    router.get('/tvshows/search', [TvShowsController, 'search'])
    router.get('/tvshows/:id', [TvShowsController, 'show'])
    router.put('/tvshows/:id', [TvShowsController, 'update'])
    router.delete('/tvshows/:id', [TvShowsController, 'destroy'])
    router.get('/tvshows/:id/season/:seasonNumber', [TvShowsController, 'showSeason'])
    router.post('/tvshows/:id/episodes/:episodeId/wanted', [TvShowsController, 'setEpisodeWanted'])

    // Authors
    router.get('/authors', [AuthorsController, 'index'])
    router.post('/authors', [AuthorsController, 'store'])
    router.get('/authors/search', [AuthorsController, 'search'])
    router.get('/authors/:id', [AuthorsController, 'show'])
    router.put('/authors/:id', [AuthorsController, 'update'])
    router.delete('/authors/:id', [AuthorsController, 'destroy'])

    // Books
    router.get('/books', [BooksController, 'index'])
    router.post('/books', [BooksController, 'store'])
    router.get('/books/search', [BooksController, 'search'])
    router.get('/books/:id', [BooksController, 'show'])
    router.put('/books/:id', [BooksController, 'update'])
    router.delete('/books/:id', [BooksController, 'destroy'])
    router.post('/books/:id/wanted', [BooksController, 'setWanted'])
    router.post('/books/:id/download', [BooksController, 'download'])

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
    router.post('/queue/refresh', [QueueController, 'refresh'])
    router.post('/queue/scan-completed', [QueueController, 'scanCompleted'])
    router.post('/queue/:id/import', [QueueController, 'import'])
    router.delete('/queue/:id', [QueueController, 'destroy'])
    router.get('/queue/history', [QueueController, 'history'])
    router.post('/queue/grab', [QueueController, 'grab'])
    router.post('/queue/search-wanted', [QueueController, 'searchWanted'])
    router.get('/queue/wanted-status', [QueueController, 'wantedStatus'])

    // Playback
    router.get('/playback/stream/:id', [PlaybackController, 'stream'])
    router.get('/playback/info/:id', [PlaybackController, 'info'])
    router.get('/playback/artwork/:id', [PlaybackController, 'artwork'])
    router.get('/playback/album/:id/playlist', [PlaybackController, 'albumPlaylist'])

    // App Settings
    router.get('/settings', [AppSettingsController, 'index'])
    router.put('/settings', [AppSettingsController, 'update'])
    router.post('/settings/media-type', [AppSettingsController, 'toggleMediaType'])

    // Filesystem browser
    router.get('/filesystem/browse', [FilesystemController, 'browse'])
    router.get('/filesystem/quick-paths', [FilesystemController, 'quickPaths'])
    router.get('/filesystem/check', [FilesystemController, 'checkPath'])
  })
  .prefix('/api/v1')
  .use(middleware.auth())

