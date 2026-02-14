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
const PlaybackSettingsController = () => import('#controllers/playback_settings_controller')
const AppSettingsController = () => import('#controllers/app_settings_controller')
const FilesystemController = () => import('#controllers/filesystem_controller')
const FilesController = () => import('#controllers/files_controller')
const UnmatchedFilesController = () => import('#controllers/unmatched_files_controller')
const BlacklistController = () => import('#controllers/blacklist_controller')
const WebhooksController = () => import('#controllers/webhooks_controller')
const NotificationsController = () => import('#controllers/notifications_controller')
const SystemController = () => import('#controllers/system_controller')
const BackupController = () => import('#controllers/backup_controller')
const ScheduledTasksController = () => import('#controllers/scheduled_tasks_controller')
const CalendarController = () => import('#controllers/calendar_controller')
const RecommendationsController = () => import('#controllers/recommendations_controller')
const JustWatchController = () => import('#controllers/justwatch_controller')
const ApiKeysController = () => import('#controllers/api_keys_controller')
const UserController = () => import('#controllers/user_controller')
const TagsController = () => import('#controllers/tags_controller')
const MediaServersController = () => import('#controllers/media_servers_controller')
const CustomFormatsController = () => import('#controllers/custom_formats_controller')
const ImportListsController = () => import('#controllers/import_lists_controller')
const BulkController = () => import('#controllers/bulk_controller')
const RenameController = () => import('#controllers/rename_controller')
const AdminUsersController = () => import('#controllers/admin/users_controller')

// Health check endpoint (enhanced for Docker/load balancers)
router.get('/health', [SystemController, 'health'])

// Public routes (with silent auth to check if user is logged in)
router
  .group(() => {
    router.on('/').renderInertia('home')
    router.on('/getting-started').renderInertia('getting-started')
  })
  .use(middleware.silentAuth())

// Guest routes (only accessible when not logged in)
// Auth POST routes have strict rate limiting: 5 attempts per minute per IP
router
  .group(() => {
    router.get('/login', [AuthController, 'showLogin']).as('login')
    router
      .post('/login', [AuthController, 'login'])
      .use(middleware.rateLimit({ store: 'auth', maxAttempts: 5, windowSeconds: 60 }))
    router.get('/register', [AuthController, 'showRegister']).as('register')
    router
      .post('/register', [AuthController, 'register'])
      .use(middleware.rateLimit({ store: 'auth', maxAttempts: 5, windowSeconds: 60 }))
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
    router.get('/requests/search/:id', async ({ response }) =>
      response.redirect('/library?tab=missing')
    )

    // Calendar
    router.on('/calendar').renderInertia('calendar/index').as('calendar')

    // Activity
    router.on('/activity/queue').renderInertia('activity/queue').as('activity.queue')
    router.on('/activity/history').renderInertia('activity/history').as('activity.history')

    // System
    router.on('/system/status').renderInertia('system/status').as('system.status')
    router.on('/system/events').renderInertia('system/events').as('system.events')

    // Profile settings (accessible to all authenticated users)
    router.on('/settings/profile').renderInertia('settings/ui').as('settings.profile')
    router.get('/settings/ui', async ({ response }) => response.redirect('/settings/profile'))

    // Settings pages (admin only)
    router
      .group(() => {
        router.get('/settings', async ({ response }) =>
          response.redirect('/settings/media-management')
        )
        router
          .on('/settings/media-management')
          .renderInertia('settings/media-management')
          .as('settings.media-management')
        router.on('/settings/indexers').renderInertia('settings/indexers').as('settings.indexers')
        router
          .on('/settings/download-clients')
          .renderInertia('settings/download-clients')
          .as('settings.download-clients')
        router.on('/settings/playback').renderInertia('settings/playback').as('settings.playback')
        router
          .on('/settings/notifications')
          .renderInertia('settings/notifications')
          .as('settings.notifications')
        router.on('/settings/webhooks').renderInertia('settings/webhooks').as('settings.webhooks')
        router.on('/settings/users').renderInertia('settings/users').as('settings.users')
      })
      .use(middleware.admin())
  })
  .use(middleware.auth())

// API routes
router
  .group(() => {
    // Root folders (read-only for all users)
    router.get('/rootfolders', [RootFoldersController, 'index'])
    router.get('/rootfolders/:id', [RootFoldersController, 'show'])
    router.get('/rootfolders/:id/scan-status', [RootFoldersController, 'scanStatus'])

    // Quality profiles (read-only for all users)
    router.get('/qualityprofiles', [QualityProfilesController, 'index'])
    router.get('/qualityprofiles/:id', [QualityProfilesController, 'show'])

    // Indexers (read-only for all users)
    router.get('/indexers', [IndexersController, 'index'])
    router.get('/indexers/search', [IndexersController, 'search'])
    router.get('/indexers/:id', [IndexersController, 'show'])

    // Download clients (read-only for all users)
    router.get('/downloadclients', [DownloadClientsController, 'index'])
    router.get('/downloadclients/:id', [DownloadClientsController, 'show'])
    router.get('/downloadclients/:id/browse', [DownloadClientsController, 'browseDownloads'])
    router.get('/downloadclients/:id/download', [DownloadClientsController, 'downloadFile'])

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
    router.get('/movies/preview', [MoviesController, 'preview'])
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
    router.get('/tvshows/preview', [TvShowsController, 'preview'])
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
    router.delete('/tvshows/:id/episodes/:episodeId', [TvShowsController, 'destroyEpisode'])
    router.post('/tvshows/:id/search', [TvShowsController, 'searchNow'])
    router.post('/tvshows/:id/episodes/:episodeId/search', [TvShowsController, 'searchEpisodeNow'])
    router.post('/tvshows/:id/enrich', [TvShowsController, 'enrich'])
    router.post('/tvshows/:id/refresh', [TvShowsController, 'refresh'])

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

    // Blacklist
    router.get('/blacklist', [BlacklistController, 'index'])
    router.delete('/blacklist/:id', [BlacklistController, 'destroy'])
    router.delete('/blacklist/media/:type/:id', [BlacklistController, 'clearMedia'])
    router.post('/blacklist/cleanup', [BlacklistController, 'cleanup'])

    // Playback
    router.get('/playback/stream/:id', [PlaybackController, 'stream'])
    router.get('/playback/info/:id', [PlaybackController, 'info'])
    router.get('/playback/artwork/:id', [PlaybackController, 'artwork'])
    router.get('/playback/album/:id/playlist', [PlaybackController, 'albumPlaylist'])
    router.get('/playback/movie/:id', [PlaybackController, 'streamMovie'])
    router.get('/playback/movie/:id/info', [PlaybackController, 'moviePlaybackInfo'])
    router.get('/playback/episode/:id', [PlaybackController, 'streamEpisode'])
    router.get('/playback/episode/:id/info', [PlaybackController, 'episodePlaybackInfo'])
    // HLS transcoding endpoints
    router.get('/playback/hls/:sessionId/master.m3u8', [PlaybackController, 'hlsManifest'])
    router.get('/playback/hls/:sessionId/:index.ts', [PlaybackController, 'hlsSegment'])
    router.delete('/playback/hls/:sessionId', [PlaybackController, 'hlsCleanup'])

    // Playback settings (read-only for all users)
    router.get('/settings/playback', [PlaybackSettingsController, 'index'])

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

    // Recommendations
    router.get('/recommendations/movies', [RecommendationsController, 'movies'])
    router.get('/recommendations/tv', [RecommendationsController, 'tv'])

    // JustWatch
    router.get('/justwatch/streaming', [JustWatchController, 'streamingAvailability'])

    // Calendar
    router.get('/calendar', [CalendarController, 'index'])
    router.get('/calendar.ics', [CalendarController, 'ical'])

    // Tags
    router.get('/tags', [TagsController, 'index'])
    router.post('/tags', [TagsController, 'store'])
    router.get('/tags/media', [TagsController, 'forMedia'])
    router.get('/tags/:id', [TagsController, 'show'])
    router.put('/tags/:id', [TagsController, 'update'])
    router.delete('/tags/:id', [TagsController, 'destroy'])
    router.post('/tags/:id/assign', [TagsController, 'assign'])
    router.post('/tags/:id/unassign', [TagsController, 'unassign'])
    router.post('/tags/:id/bulk-assign', [TagsController, 'bulkAssign'])
    router.get('/tags/:id/media', [TagsController, 'media'])

    // Custom Formats
    router.get('/customformats', [CustomFormatsController, 'index'])
    router.post('/customformats', [CustomFormatsController, 'store'])
    router.post('/customformats/test', [CustomFormatsController, 'test'])
    router.get('/customformats/:id', [CustomFormatsController, 'show'])
    router.put('/customformats/:id', [CustomFormatsController, 'update'])
    router.delete('/customformats/:id', [CustomFormatsController, 'destroy'])
    router.post('/customformats/:id/profile', [CustomFormatsController, 'assignToProfile'])
    router.delete('/customformats/:id/profile/:profileId', [
      CustomFormatsController,
      'removeFromProfile',
    ])

    // User profile
    router.put('/user/profile', [UserController, 'updateProfile'])
    router.put('/user/password', [UserController, 'changePassword'])

    // Import Lists
    router.get('/import-lists', [ImportListsController, 'index'])
    router.post('/import-lists', [ImportListsController, 'store'])
    router.get('/import-lists/:id', [ImportListsController, 'show'])
    router.put('/import-lists/:id', [ImportListsController, 'update'])
    router.delete('/import-lists/:id', [ImportListsController, 'destroy'])
    router.post('/import-lists/:id/sync', [ImportListsController, 'sync'])
    router.post('/import-lists/sync-all', [ImportListsController, 'syncAll'])

    // Bulk Operations
    router.post('/movies/bulk', [BulkController, 'movies'])
    router.post('/tvshows/bulk', [BulkController, 'tvshows'])
    router.post('/artists/bulk', [BulkController, 'artists'])
    router.post('/books/bulk', [BulkController, 'books'])

    // Rename/Organize
    router.post('/movies/:id/rename', [RenameController, 'renameMovie'])
    router.post('/tvshows/:id/rename', [RenameController, 'renameTvShow'])
    router.post('/artists/:id/rename', [RenameController, 'renameArtist'])
    router.post('/authors/:id/rename', [RenameController, 'renameAuthor'])

    // Read-only endpoints available to all authenticated users
    router.get('/notifications/history', [NotificationsController, 'history'])
    router.get('/system/info', [SystemController, 'info'])

    // Admin-only API routes
    router
      .group(() => {
        // Root folders (write operations)
        router.post('/rootfolders', [RootFoldersController, 'store'])
        router.post('/rootfolders/scan-all', [RootFoldersController, 'scanAll'])
        router.put('/rootfolders/:id', [RootFoldersController, 'update'])
        router.delete('/rootfolders/:id', [RootFoldersController, 'destroy'])
        router.post('/rootfolders/:id/scan', [RootFoldersController, 'scan'])

        // Quality profiles (write operations)
        router.post('/qualityprofiles', [QualityProfilesController, 'store'])
        router.put('/qualityprofiles/:id', [QualityProfilesController, 'update'])
        router.delete('/qualityprofiles/:id', [QualityProfilesController, 'destroy'])

        // Indexers (write operations)
        router.post('/indexers', [IndexersController, 'store'])
        router.post('/indexers/test', [IndexersController, 'test'])
        router.put('/indexers/:id', [IndexersController, 'update'])
        router.delete('/indexers/:id', [IndexersController, 'destroy'])

        // Prowlarr
        router.get('/prowlarr', [ProwlarrController, 'show'])
        router.put('/prowlarr', [ProwlarrController, 'update'])
        router.post('/prowlarr/test', [ProwlarrController, 'test'])
        router.post('/prowlarr/sync', [ProwlarrController, 'sync'])
        router.get('/prowlarr/indexers', [ProwlarrController, 'indexers'])

        // Download clients (write operations)
        router.post('/downloadclients', [DownloadClientsController, 'store'])
        router.put('/downloadclients/:id', [DownloadClientsController, 'update'])
        router.delete('/downloadclients/:id', [DownloadClientsController, 'destroy'])
        router.post('/downloadclients/test', [DownloadClientsController, 'test'])
        router.post('/downloadclients/:id/import', [DownloadClientsController, 'importFromPath'])

        // App Settings
        router.get('/settings', [AppSettingsController, 'index'])
        router.put('/settings', [AppSettingsController, 'update'])
        router.post('/settings/media-type', [AppSettingsController, 'toggleMediaType'])
        router.get('/settings/naming-patterns', [AppSettingsController, 'getNamingPatterns'])
        router.put('/settings/naming-patterns', [AppSettingsController, 'updateNamingPatterns'])

        // Media servers
        router.get('/mediaservers', [MediaServersController, 'index'])
        router.post('/mediaservers', [MediaServersController, 'store'])
        router.get('/mediaservers/:id', [MediaServersController, 'show'])
        router.put('/mediaservers/:id', [MediaServersController, 'update'])
        router.delete('/mediaservers/:id', [MediaServersController, 'destroy'])
        router.post('/mediaservers/:id/test', [MediaServersController, 'test'])
        router.post('/mediaservers/:id/refresh', [MediaServersController, 'refresh'])

        // Playback settings (write)
        router.put('/settings/playback', [PlaybackSettingsController, 'update'])

        // Filesystem browser (admin only - exposes server filesystem)
        router.get('/filesystem/browse', [FilesystemController, 'browse'])
        router.get('/filesystem/quick-paths', [FilesystemController, 'quickPaths'])
        router.get('/filesystem/check', [FilesystemController, 'checkPath'])

        // Webhooks
        router.get('/webhooks', [WebhooksController, 'index'])
        router.post('/webhooks', [WebhooksController, 'store'])
        router.get('/webhooks/:id', [WebhooksController, 'show'])
        router.put('/webhooks/:id', [WebhooksController, 'update'])
        router.delete('/webhooks/:id', [WebhooksController, 'destroy'])
        router.post('/webhooks/:id/test', [WebhooksController, 'test'])
        router.get('/webhooks/:id/history', [WebhooksController, 'history'])
        router.delete('/webhooks/:id/history', [WebhooksController, 'clearHistory'])

        // Notifications (management - admin only)
        router.get('/notifications', [NotificationsController, 'index'])
        router.post('/notifications', [NotificationsController, 'store'])
        router.get('/notifications/types', [NotificationsController, 'types'])
        router.get('/notifications/:id', [NotificationsController, 'show'])
        router.put('/notifications/:id', [NotificationsController, 'update'])
        router.delete('/notifications/:id', [NotificationsController, 'destroy'])
        router.post('/notifications/:id/test', [NotificationsController, 'test'])

        // Backup
        router.get('/system/backup', [BackupController, 'index'])
        router.post('/system/backup', [BackupController, 'create'])
        router.get('/system/backup/:name/download', [BackupController, 'download'])
        router.post('/system/backup/:name/restore', [BackupController, 'restore'])
        router.delete('/system/backup/:name', [BackupController, 'destroy'])

        // Scheduled Tasks
        router.get('/system/tasks', [ScheduledTasksController, 'index'])
        router.put('/system/tasks/:id', [ScheduledTasksController, 'update'])
        router.post('/system/tasks/:id/run', [ScheduledTasksController, 'run'])

        // API Keys management
        router.get('/apikeys', [ApiKeysController, 'index'])
        router.post('/apikeys', [ApiKeysController, 'store'])
        router.delete('/apikeys/:id', [ApiKeysController, 'destroy'])

        // User management (admin only)
        router.get('/users', [AdminUsersController, 'index'])
        router.get('/users/:id', [AdminUsersController, 'show'])
        router.post('/users', [AdminUsersController, 'store'])
        router.put('/users/:id', [AdminUsersController, 'update'])
        router.delete('/users/:id', [AdminUsersController, 'destroy'])
        router.post('/users/:id/reset-password', [AdminUsersController, 'resetPassword'])
      })
      .use(middleware.admin())
  })
  .prefix('/api/v1')
  .use(middleware.apiKeyAuth())
  .use(middleware.rateLimit({ store: 'api', maxAttempts: 100, windowSeconds: 60 }))
