# Changelog

## [1.24.3](https://github.com/Gitsack/hamster/compare/hamster-v1.24.2...hamster-v1.24.3) (2026-04-11)


### Bug Fixes

* ts error on github ([7b94802](https://github.com/Gitsack/hamster/commit/7b94802001990a8fc7aedb89e52c168f76afc0de))

## [1.24.2](https://github.com/Gitsack/hamster/compare/hamster-v1.24.1...hamster-v1.24.2) (2026-04-11)


### Bug Fixes

* ts errors ([77f555c](https://github.com/Gitsack/hamster/commit/77f555c80e051a0a547a8c7cf4d35b6d312ab14b))

## [1.24.1](https://github.com/Gitsack/hamster/compare/hamster-v1.24.0...hamster-v1.24.1) (2026-04-11)


### Bug Fixes

* lint fixes ([ffb76df](https://github.com/Gitsack/hamster/commit/ffb76df3f96980ffa76316a0cf074c0c1f2542b2))

## [1.24.0](https://github.com/Gitsack/hamster/compare/hamster-v1.23.0...hamster-v1.24.0) (2026-04-11)


### Features

* add database indexes for high-frequency query columns ([9bbf28c](https://github.com/Gitsack/hamster/commit/9bbf28c5c9d3583862178a3e2613e6d80e2cb0da))
* shared download status polling via ActiveDownloadsProvider context ([46834fc](https://github.com/Gitsack/hamster/commit/46834fc082dbfbd1f826bb6cab5e886a21c325d6))
* shared download status polling via context provider ([037d9c9](https://github.com/Gitsack/hamster/commit/037d9c94dd8a57acd12182922ecd7c1fe43c2505))
* show rate-limit and indexer skip feedback in search UI ([2cd55f7](https://github.com/Gitsack/hamster/commit/2cd55f7fa404b326faa6224b896c19e5d16bd579))
* standardize button patterns, labels, and empty states in search results ([fdfa9e1](https://github.com/Gitsack/hamster/commit/fdfa9e1d5298a0001f5da127398e0761bbe19094))
* standardize search page button patterns and empty states ([1d54891](https://github.com/Gitsack/hamster/commit/1d548915fcd6b31e77e693e239a4670ad02268d6))
* streamline discover-to-download flow with improved toast feedback ([b9ddbca](https://github.com/Gitsack/hamster/commit/b9ddbca842961d98f98bba9c1df4ad25ae4d64e9))
* streamline discover-to-download flow with toast feedback ([d274238](https://github.com/Gitsack/hamster/commit/d274238e764d7321655ea679b160cbb611497c18))


### Bug Fixes

* add error handling to dashboard and password reset ([d8ed5c0](https://github.com/Gitsack/hamster/commit/d8ed5c096b578b38898f49d767481adf2e8fac4e))
* add error handling to dashboard controller and password reset flow ([0f88d20](https://github.com/Gitsack/hamster/commit/0f88d20dc895f3c10f8670f727d0a3f2cedbb782))
* add missing EmptyState UI component ([2901869](https://github.com/Gitsack/hamster/commit/2901869348af6bcbabf37231e0dddc1e3b36b417))
* add missing providers to SSR entry point to prevent Library page crash ([f225297](https://github.com/Gitsack/hamster/commit/f225297c04f0e4cff574b3d2bf0da14a75ddedce))
* add missing SSR providers to prevent Library page Error 500 ([cef286b](https://github.com/Gitsack/hamster/commit/cef286bf3df4973db2dd7b54c841ba9c007446f7))
* blacklist and retry settings ([f850e76](https://github.com/Gitsack/hamster/commit/f850e76d5a28ede521c9b0dafda371a8b5a2684a))
* create shared EmptyState UI component to resolve missing module error ([4c5798a](https://github.com/Gitsack/hamster/commit/4c5798aa1930656c3d44f4d68f5643a49d8792ec))
* migration ([d2d803d](https://github.com/Gitsack/hamster/commit/d2d803d0d9c0673fbbe36c89b3ff6ce4acefbc9a))
* remove dead inline episode search code in tvshow page ([2a55f96](https://github.com/Gitsack/hamster/commit/2a55f962b67c88df80506162c1e55aca938926ac))
* remove dead inline episode search results code referencing undefined grabEpisodeRelease ([c45a2f4](https://github.com/Gitsack/hamster/commit/c45a2f45340d34f3ef5fcea12f365b8b615a5d50))
* remove duplicate function declarations in movie detail page ([e2514cf](https://github.com/Gitsack/hamster/commit/e2514cf7cc8244229b183a0404389f5eef6fae21))
* remove duplicate searchEpisodeReleases declaration in tvshow page ([8ae8ba1](https://github.com/Gitsack/hamster/commit/8ae8ba15e8f89d35bba0b71fbed9197f38e27985))
* remove duplicate searchEpisodeReleases in tvshow page ([91ed9ed](https://github.com/Gitsack/hamster/commit/91ed9ed12b5e4fcac8628d4132abd4463aa3f77c))
* remove duplicate searchEpisodeReleases route causing server startup crash ([abbef8d](https://github.com/Gitsack/hamster/commit/abbef8daabfb2df4ee808f981965d02a92cad5d8))
* remove duplicate searchReleases and grabRelease function declarations in movie page ([445d79f](https://github.com/Gitsack/hamster/commit/445d79f845bd437041d271348405c45914fbb384))
* remove duplicate state declarations in movie detail page ([bc4fb81](https://github.com/Gitsack/hamster/commit/bc4fb81d4f14516b3fc448af2b5217e632d74ae1))
* remove duplicate state declarations in movie detail page causing transform errors ([12c312f](https://github.com/Gitsack/hamster/commit/12c312f080070f99dfcd9154e00d584c71e87780))
* remove orphaned closing div in tvshow page ([8c6b1d4](https://github.com/Gitsack/hamster/commit/8c6b1d4248dd38aeb010b601d75412a528f4355b))
* remove orphaned closing div tag left from dead code removal in tvshow page ([1f9cfd2](https://github.com/Gitsack/hamster/commit/1f9cfd2a703293a4ef6dd1d1db9bc43fff7a249b))
* replace negative margin scroll containers with proper overflow in search page ([0c621e8](https://github.com/Gitsack/hamster/commit/0c621e8674f1c97a4e003f6d836cd197c3cfc998))
* setup:worktree command ([414a83a](https://github.com/Gitsack/hamster/commit/414a83ac3402e4c00828a6b3528810051be1bc56))
* standardize TVShow detail page to match Movie/Album patterns ([f51adc3](https://github.com/Gitsack/hamster/commit/f51adc32063fb9f9158ecd20232f390c038c4478))

## [1.23.0](https://github.com/Gitsack/hamster/compare/hamster-v1.22.0...hamster-v1.23.0) (2026-04-04)


### Features

* add action buttons and bulk search to Missing Items tab ([ac3ee71](https://github.com/Gitsack/hamster/commit/ac3ee71351fb0563e7cf8691f225d12e87c60ede))
* add action buttons to Missing Items tab ([e937e62](https://github.com/Gitsack/hamster/commit/e937e62e9dfc570dd3c2cf20527a9c069a2dd991))
* add consistent empty state messaging across views ([4b51499](https://github.com/Gitsack/hamster/commit/4b51499cb84fce2f4b79c96d437fe7f86f65d768))
* add consistent empty state messaging across views ([24ae038](https://github.com/Gitsack/hamster/commit/24ae03878bd05ccc1d6c3e39c2b2b60ebef14bde))
* add global progress/toast feedback for bulk operations ([#67](https://github.com/Gitsack/hamster/issues/67)) ([c368ef1](https://github.com/Gitsack/hamster/commit/c368ef16bb60d83619950cdf7b41170161018c07))
* add media-type grouping and filtering to direct indexer search results ([672bd8f](https://github.com/Gitsack/hamster/commit/672bd8f84be1909ab7c5a37ffa27437b8d2fdc8c))
* add post-login dashboard with library stats and recent activity ([028b770](https://github.com/Gitsack/hamster/commit/028b770892d6c6313dc049049b3a5b2216dfb519))
* add React error boundary for graceful error recovery ([6452bf0](https://github.com/Gitsack/hamster/commit/6452bf01ee3e1a80fd0191e39d1e910d7d8a6b4e))
* add React error boundary for graceful error recovery ([6e780b2](https://github.com/Gitsack/hamster/commit/6e780b287d015dc1065b1c90e4aa3d1f134a1e77))
* add search and status filter bar to library index page ([c63fa9b](https://github.com/Gitsack/hamster/commit/c63fa9b01ee74c84097fa12556bc3b4793dd7ff8))
* add self-service password reset flow ([1543cd7](https://github.com/Gitsack/hamster/commit/1543cd76301f197958d8199a2c7a8640aa5f82f7))
* add self-service password reset flow ([677ebf4](https://github.com/Gitsack/hamster/commit/677ebf4daf80f9effa24f36b625241074923fee3))
* add SERVICE_HOST_MAP for Docker hostname resolution in local dev ([1579975](https://github.com/Gitsack/hamster/commit/1579975a4c3f8e0ba38c8696a849aa8b8c52a97d))
* add show-more pagination for long lists on detail pages ([865c110](https://github.com/Gitsack/hamster/commit/865c110c4aca9b9ec4b0844b9cf79e7850fc2da8))
* add show-more pagination for long lists on detail pages ([#63](https://github.com/Gitsack/hamster/issues/63)) ([865c110](https://github.com/Gitsack/hamster/commit/865c110c4aca9b9ec4b0844b9cf79e7850fc2da8))
* add status filter bar to library index page ([1db09e8](https://github.com/Gitsack/hamster/commit/1db09e81f32dc5695ec4d5b1312b122ae3998fd9))
* add tooltips to icon-only buttons on detail pages ([0d9b762](https://github.com/Gitsack/hamster/commit/0d9b7627c231e27bbd04cfa3733f797ae169b5e9))
* add tooltips to icon-only buttons on detail pages ([09ef324](https://github.com/Gitsack/hamster/commit/09ef324331c7b8fada73e628b5cee99c0a485f41))
* compact search result cards for better information density ([a4b0478](https://github.com/Gitsack/hamster/commit/a4b0478fa26b45abc1b5b17b9f97b8ad413833a4))
* harmonize navigation with breadcrumbs across detail pages ([f3645ca](https://github.com/Gitsack/hamster/commit/f3645ca25ff6e0d433f01941ea5c6fe92a066227))
* harmonize navigation with breadcrumbs across detail pages ([5013232](https://github.com/Gitsack/hamster/commit/5013232382e7ee644cdf18167dc4f8511df56fbd))
* improve error messages for auto-download failures ([f18d0fb](https://github.com/Gitsack/hamster/commit/f18d0fb8690627c30c3c8051db7dc35cc3cbabd2))
* improve search UX with debounced input, keyboard nav, and empty states ([2589314](https://github.com/Gitsack/hamster/commit/258931428dbe1939599100ca8dc425c36ae2abc6))
* improve search UX with debounced input, keyboard nav, and empty states ([f85f138](https://github.com/Gitsack/hamster/commit/f85f138c4b16f924edeea0f276e50f0521b8f986))
* show quality profile and root folder badges on album and book detail pages ([2b69cdd](https://github.com/Gitsack/hamster/commit/2b69cdd959638f9973fe66abfee81bea5408f83a))
* show quality profile and root folder badges on album and book pages ([bf45fc6](https://github.com/Gitsack/hamster/commit/bf45fc6a786c091bacdfaf4cd3af96570a93aec1))
* standardize deletion dialogs across all media types ([c00e57d](https://github.com/Gitsack/hamster/commit/c00e57d9ef90fddcc76df52e8cdda6c83fe02a11))
* standardize deletion dialogs across all media types ([a347531](https://github.com/Gitsack/hamster/commit/a34753154d4eef6167a3b973a695a7498f5450de))
* standardize metadata enrichment actions across all media types ([4bf2fa6](https://github.com/Gitsack/hamster/commit/4bf2fa6b28f1e298fc1786ebfcd709ad1a89cd63))
* standardize metadata enrichment actions across all media types ([3912d61](https://github.com/Gitsack/hamster/commit/3912d61db412576f04aa43760530ad8f4e17ae59))
* unify download button labels and promote browse releases across media types ([5935095](https://github.com/Gitsack/hamster/commit/59350954ffbd69a35120e3687bc7bc39ffe9a919))
* unify download initiation UX across media types ([a3cafa1](https://github.com/Gitsack/hamster/commit/a3cafa1135382268708f852239024c7e372ef57e))
* unify download initiation UX with manual search across all media types ([b0ee3cb](https://github.com/Gitsack/hamster/commit/b0ee3cbbc13e4b5ca2e412223b315a22d1b237a2))
* unify download progress display across all detail pages ([93e6008](https://github.com/Gitsack/hamster/commit/93e60088726a85fdddaefdad6fce6c5f11b2b687))
* unify download progress display across all detail pages ([93e6008](https://github.com/Gitsack/hamster/commit/93e60088726a85fdddaefdad6fce6c5f11b2b687))
* unify download progress display across all detail pages ([1272e7d](https://github.com/Gitsack/hamster/commit/1272e7dea6cc2c3e4e5fd9c84feb7b575320f327))


### Bug Fixes

* add a11y improvements to search results tables ([3884915](https://github.com/Gitsack/hamster/commit/3884915bc75f970d9a5ee7957cb0c7d696698407))
* add missing aria-labels to icon-only buttons ([52fde77](https://github.com/Gitsack/hamster/commit/52fde770d7ea21cd9d96051523ff4348adcea3ea))
* add missing aria-labels to icon-only buttons across pages ([8b2e43d](https://github.com/Gitsack/hamster/commit/8b2e43d72f81fd721d96cfc3bd52035101354129))
* clear stale search results, cap limit param, and use CardHeader for search results ([1c514a6](https://github.com/Gitsack/hamster/commit/1c514a68e259b922acec5e47f91316259fd6d98f))
* create test user command ([325c39c](https://github.com/Gitsack/hamster/commit/325c39c8ca2258368666d910932a5e65dec8101d))
* exclude test files from Inertia page globs ([78ca3f4](https://github.com/Gitsack/hamster/commit/78ca3f46a54e2ae8c758c1210bf1de9eb04528e0))
* exclude test files from Inertia page globs to prevent runtime errors ([6a47829](https://github.com/Gitsack/hamster/commit/6a47829066b839d1d2ea43f04b59c80629c4c04a))
* hide status filter on Music tab where artists lack status fields ([38f5e44](https://github.com/Gitsack/hamster/commit/38f5e4438a7e8274aca11bf33323f29aec029eb3))
* resolve N+1 queries in controllers and add missing database indexes ([ce8ffe0](https://github.com/Gitsack/hamster/commit/ce8ffe0ef0eec1ace5eb70600378c8b87ad5c389))
* use MediaStatusBadge consistently across all library views ([6d147b8](https://github.com/Gitsack/hamster/commit/6d147b8e2e2d086762bc910773934c6499819733))
* use MediaStatusBadge consistently across all library views ([78cdaff](https://github.com/Gitsack/hamster/commit/78cdaff477c459d75406c5768003fa1170779c6b))

## [1.22.0](https://github.com/Gitsack/hamster/compare/hamster-v1.21.2...hamster-v1.22.0) (2026-03-28)


### Features

* add license and contributing ([f04255b](https://github.com/Gitsack/hamster/commit/f04255b5aea900affd9a48d13c0c4f37076899b6))
* added different downloaders to UI ([4c89c8c](https://github.com/Gitsack/hamster/commit/4c89c8c4a9c22b27bdcd1eb53208509fd53d1566))
* added genre tags for movie/show search ([4188a37](https://github.com/Gitsack/hamster/commit/4188a37e5e408531230167ab5a9bbfe9a2b61afb))
* added gh actions for release and image push ([453ca8a](https://github.com/Gitsack/hamster/commit/453ca8a1a2a90d7b05a9bad43fe62d60d1b5854c))
* added pgid puid ([d8dc7c1](https://github.com/Gitsack/hamster/commit/d8dc7c194071301a8a9f3ea7ceb4f3e41811537b))
* added secure_cookies env ([6cf76d1](https://github.com/Gitsack/hamster/commit/6cf76d1c6d1ad2016135df5f9f1f8a60eda61588))
* added shadcn ([b385ca4](https://github.com/Gitsack/hamster/commit/b385ca4a5a5746de9d00f412d8fb200ffa40b70a))
* added trailers and more pictures to entry details ([7c110d7](https://github.com/Gitsack/hamster/commit/7c110d791dc2341b86f4262c42385cf5cb1b39cc))
* added unified spinner component ([99ad097](https://github.com/Gitsack/hamster/commit/99ad097ca3caf98eb35558a766896e8de4ce49da))
* added version to sidebar ([c96e2df](https://github.com/Gitsack/hamster/commit/c96e2dfff6e455ce5ad22d41d8a1274a19bbe2da))
* added webhooks and other dl options ([9570aa6](https://github.com/Gitsack/hamster/commit/9570aa6cc9ed51f97c89d45918608d9a44dbc2e1))
* album artist search ([ce46162](https://github.com/Gitsack/hamster/commit/ce46162e63655255e25116a56b759215cd22ccef))
* better retries and blacklistings for failed downloads ([c4a2af1](https://github.com/Gitsack/hamster/commit/c4a2af1e2f2d6b08d246512cce773d087174b450))
* better streaming service selection ([138761d](https://github.com/Gitsack/hamster/commit/138761d910ca889acbfdf2f8ecb2b676885a7be6))
* different media types sorting ([5ecf6fb](https://github.com/Gitsack/hamster/commit/5ecf6fb925f55345625cbe54f0b32f5953510ad3))
* directly access sabnzbd when deduplicating ([981ff75](https://github.com/Gitsack/hamster/commit/981ff753d1e90e7e1d79c957c169809e70f49de1))
* docker, new quality profiles, dialog updates ([03d421b](https://github.com/Gitsack/hamster/commit/03d421b0208f491b9d1a69cf4359792bc252965f))
* download processing management improvements ([b989573](https://github.com/Gitsack/hamster/commit/b9895733c68f94514518a16f799d1bf720680997))
* further improved matching previously downloaded items ([ca146f6](https://github.com/Gitsack/hamster/commit/ca146f6c3f5e92b2028c56bea8115660485bcfdb))
* general playback of items ([14add3a](https://github.com/Gitsack/hamster/commit/14add3ab473a2bdf75a52c2585b8855266284801))
* home & getting started pages ([c1a92f1](https://github.com/Gitsack/hamster/commit/c1a92f125f911b57106cbbc9f5169516669d3268))
* hw acceleration ([f6f8fc7](https://github.com/Gitsack/hamster/commit/f6f8fc7703706df27a2703c53d6561201dd2e285))
* improved album and artist matching ([f8d5eec](https://github.com/Gitsack/hamster/commit/f8d5eec1e5383f94f0d39cd689793d24de93abe2))
* initial music implementation ([7ea57d2](https://github.com/Gitsack/hamster/commit/7ea57d26a529ce43b86b715bc1e96374d4cca5c1))
* library scan for files ([89b86ca](https://github.com/Gitsack/hamster/commit/89b86caa1253f073a12ecbd2c5403e6302de40e1))
* make APP_KEY optional as docker variable ([263bd2e](https://github.com/Gitsack/hamster/commit/263bd2ea7dbdbb3413c60b49e78db729f161f03d))
* more teasers open in sidebar ([de086b7](https://github.com/Gitsack/hamster/commit/de086b740580f49b0bfa9bf99791dd8659fecafc))
* new download options / structure ([c0df269](https://github.com/Gitsack/hamster/commit/c0df269ea37426200e44fe1f94924744715d09b3))
* new library system and cleanups ([913a749](https://github.com/Gitsack/hamster/commit/913a74922976a3f25d5449541c75289301b3535c))
* new media hero structure ([1077065](https://github.com/Gitsack/hamster/commit/107706501ed2195194766ab58a3e09793693ea6c))
* new media structure ([85cb00a](https://github.com/Gitsack/hamster/commit/85cb00a1ebe566b5968697cdc7b821c179ea6bf4))
* new media types ([728faed](https://github.com/Gitsack/hamster/commit/728faed66f135ea3ada42bf7b8f039f8a02a9a27))
* new size quality profile ([c069e95](https://github.com/Gitsack/hamster/commit/c069e95a4c24ab0870104299ea7ee30cc5830f09))
* only one workflow file ([28aeeeb](https://github.com/Gitsack/hamster/commit/28aeeeba413691daccfa1ed4bd051cfa066c0f69))
* quick view of personal streaming availability ([829a1dd](https://github.com/Gitsack/hamster/commit/829a1dd60c03ae088ad5ae5a897f1adb53b0b571))
* renamed to hamster ([39b4105](https://github.com/Gitsack/hamster/commit/39b4105739b6cc64ff8abe4669268f5f7bcbf984))
* scan download files and import ([e379520](https://github.com/Gitsack/hamster/commit/e379520d38a5da039c70a95340419e1b702cdd37))
* scheduled metadata refresh, media hero, deduplicate action ([b087601](https://github.com/Gitsack/hamster/commit/b08760157c29c28d5e441c5dfa8fa68603c959f1))
* search ([3d40efb](https://github.com/Gitsack/hamster/commit/3d40efb7e841ff980060f3a21962bfca65b84c09))
* show more on discover lanes, media type query params ([b8a6939](https://github.com/Gitsack/hamster/commit/b8a6939f113277cc5b8513b16432bac8ec510550))
* similar lane, discover improvements ([9ff81cf](https://github.com/Gitsack/hamster/commit/9ff81cfe5600629512c320029d99e861a598840f))
* structural changes ([3907a72](https://github.com/Gitsack/hamster/commit/3907a72b0892a421d77f3d8b64e74e7e45927eb1))
* trakt and justwatch integrations ([ebf06a8](https://github.com/Gitsack/hamster/commit/ebf06a81aec10c498410f4c93d40b797ffecef2c))
* unified download dialog, search details sheet for movie and show ([d9cd167](https://github.com/Gitsack/hamster/commit/d9cd167d7f1eeb99dc3f3ef45b0160cf1047b9b9))
* unified status badge ([a919d39](https://github.com/Gitsack/hamster/commit/a919d392e49bbbc572c36755653afa42f8df8255))
* updated tv show fetching of tmdb data ([5d30808](https://github.com/Gitsack/hamster/commit/5d30808dc0d21cebfb1d65b8688abed6b34be9fd))
* upgraded to new adonis and vite v7 ([fabb87e](https://github.com/Gitsack/hamster/commit/fabb87eea5d56a3ab58d3ace9ca10a788b573728))
* use unified badges, click event fixes ([3d181fe](https://github.com/Gitsack/hamster/commit/3d181fedf9f8a24d5d846240925e01bd71c16164))
* working download ([d4579d6](https://github.com/Gitsack/hamster/commit/d4579d67387d90f0593d868b339e054b31bc6e56))


### Bug Fixes

* adapted streaming loading debounce ([dfe68e1](https://github.com/Gitsack/hamster/commit/dfe68e1693d70f1862a3aa463705e0a40fc2bd11))
* added different search way for movies ([934e86c](https://github.com/Gitsack/hamster/commit/934e86c0565adaf17bd0d7dc5505830c4f211881))
* apostrophes in search queries ([f20860c](https://github.com/Gitsack/hamster/commit/f20860cbbff7e093c62ade84ee13f16425d9c1c8))
* artists view, albums ([6486efa](https://github.com/Gitsack/hamster/commit/6486efa7d8d02a22497dc530bb01b5380ed142b4))
* better download and sync to sabnzbd ([cebf877](https://github.com/Gitsack/hamster/commit/cebf8774135a41c11d945180f62ad10d0ffa961e))
* bun lockfile ([f0f45fa](https://github.com/Gitsack/hamster/commit/f0f45fa938a31b03dc356d4bbbe7284a1f69f3ba))
* chown only necessary folders ([c160d02](https://github.com/Gitsack/hamster/commit/c160d02588a6b160ee80b113fcc4c1fc6e1c1984))
* consolidatet readme files ([524d199](https://github.com/Gitsack/hamster/commit/524d19981a3097699937a894445f31d8b94011c7))
* correct appearing streaming badges ([425e973](https://github.com/Gitsack/hamster/commit/425e9732b62c6f4b2bc65caaa3b3c523ce3be424))
* correct chown directories ([3dd8178](https://github.com/Gitsack/hamster/commit/3dd8178e440e9b8086e6988a4afb5dda75800044))
* deduplicate download items that have already been downloaded ([f723050](https://github.com/Gitsack/hamster/commit/f723050a74e1a1d4008eb974e1333aeaf8f34824))
* delete file on remove button for importing items ([052668f](https://github.com/Gitsack/hamster/commit/052668fb106aa6cb65edc533f16503ee23da8657))
* different matching for deduplication ([520322e](https://github.com/Gitsack/hamster/commit/520322e069456db52725afb5444190f166a62266))
* direct download ([cb4885f](https://github.com/Gitsack/hamster/commit/cb4885f7628a5c73b06beb1414589a4ff7e45c59))
* docker folders ([2f9bfa0](https://github.com/Gitsack/hamster/commit/2f9bfa0ce66ff1c4b95acfd6f4dd578567ce99cb))
* docker gh build guid ([5288c0c](https://github.com/Gitsack/hamster/commit/5288c0c94fd986b15b558880739b041d733fb2e4))
* docker image size ([4efa872](https://github.com/Gitsack/hamster/commit/4efa872edd24c90f2fe00e1ec97ac2acd04849c0))
* dont link to library entry after requesting from details ([6f30bca](https://github.com/Gitsack/hamster/commit/6f30bca07f76111ef14c0dd7ab881e53118849a1))
* duplication check on adding items ([2c13b05](https://github.com/Gitsack/hamster/commit/2c13b05c793f9082a6f116c661bdc2e81d2afdcc))
* dynamic imports ([ae19bb4](https://github.com/Gitsack/hamster/commit/ae19bb45233fbbd3a47b6a2e2adf33cd00978c3c))
* error handling ([dad7edf](https://github.com/Gitsack/hamster/commit/dad7edf1a55099238aa6a3139b6965a3d9f165fe))
* filesize maximum, original titles ([36cbdf2](https://github.com/Gitsack/hamster/commit/36cbdf2c3610bcaf2230d683a2b0620ffca2888c))
* fixes for queue and activity tabs ([5ad4e0a](https://github.com/Gitsack/hamster/commit/5ad4e0a08c08a158744018b2ace475c7a56a7993))
* handle stuck importing entries ([219c52e](https://github.com/Gitsack/hamster/commit/219c52e7c76c9986cc7a9c4a5756a58bd5b741ce))
* lane refresh mid scroll ([ce8c941](https://github.com/Gitsack/hamster/commit/ce8c94109ba798bd66377ac32adb8795c174aef1))
* lowercase github repo name ([79e7548](https://github.com/Gitsack/hamster/commit/79e7548ee6106997d29c8fabf3b460a09b40a4bb))
* media-hero ([e84dd9b](https://github.com/Gitsack/hamster/commit/e84dd9b1c800062e6cbbf1027a64675e516d6327))
* next fix for lane refresh bug ([963b8db](https://github.com/Gitsack/hamster/commit/963b8dbcfca888747fa1619302e290d46072dcf2))
* null error ([47c30d5](https://github.com/Gitsack/hamster/commit/47c30d52adfc0b59ff9d534911ad28a06171bac2))
* order of preloads in adonisrc ([d6e642a](https://github.com/Gitsack/hamster/commit/d6e642a5fe4c2f21af34e1b5ac325bac7523e96f))
* promote a regular user to admin if last one ([85d79d0](https://github.com/Gitsack/hamster/commit/85d79d0188037cfc5eeb6dcd8ffca950beb03d57))
* provenance for docker build and push ([ba9bd66](https://github.com/Gitsack/hamster/commit/ba9bd66f7e864c7d7156037d453f2363815a1b70))
* show download matching ([977503b](https://github.com/Gitsack/hamster/commit/977503b55b23dcc327b2dff0083d7bed11c69c78))
* streaming server matching, correct chowning ([d9e41c2](https://github.com/Gitsack/hamster/commit/d9e41c2055922fc9b510d61a494587149f3b5c1e))
* tests ([51c0cc3](https://github.com/Gitsack/hamster/commit/51c0cc3f057a1621e02ce9fea66fa1e971341e9c))
* tv show scanning for episodes ([65125bf](https://github.com/Gitsack/hamster/commit/65125bf4872dc4afbbfbe9a6a02c9969f9a7153f))
* updated bun ([b69cdf3](https://github.com/Gitsack/hamster/commit/b69cdf3ba381366f16b7d6c7723ce42b2041d2d4))
* updated bun lockfile ([3d6f94d](https://github.com/Gitsack/hamster/commit/3d6f94da4c7fd64ddabfc0515003e7939c06cbc4))
* updated docker start interval to 2s ([a2364cd](https://github.com/Gitsack/hamster/commit/a2364cd0ee776084e4edfa12ab7a560458b16735))
* updated lockfiles ([82616fc](https://github.com/Gitsack/hamster/commit/82616fc5268adb5b5cbb73d0685e50d62090c76e))
* use amd64 platform ([b97286d](https://github.com/Gitsack/hamster/commit/b97286d7dad64a7e64180785c77bc44141bef3dc))

## [1.21.2](https://github.com/Gitsack/hamster/compare/hamster-v1.21.1...hamster-v1.21.2) (2026-03-28)


### Bug Fixes

* tests ([51c0cc3](https://github.com/Gitsack/hamster/commit/51c0cc3f057a1621e02ce9fea66fa1e971341e9c))

## [1.21.1](https://github.com/Gitsack/hamster/compare/hamster-v1.21.0...hamster-v1.21.1) (2026-03-28)


### Bug Fixes

* bun lockfile ([f0f45fa](https://github.com/Gitsack/hamster/commit/f0f45fa938a31b03dc356d4bbbe7284a1f69f3ba))

## [1.21.0](https://github.com/Gitsack/hamster/compare/hamster-v1.20.3...hamster-v1.21.0) (2026-03-23)


### Features

* download processing management improvements ([b989573](https://github.com/Gitsack/hamster/commit/b9895733c68f94514518a16f799d1bf720680997))
* new media hero structure ([1077065](https://github.com/Gitsack/hamster/commit/107706501ed2195194766ab58a3e09793693ea6c))
* scan download files and import ([e379520](https://github.com/Gitsack/hamster/commit/e379520d38a5da039c70a95340419e1b702cdd37))
* upgraded to new adonis and vite v7 ([fabb87e](https://github.com/Gitsack/hamster/commit/fabb87eea5d56a3ab58d3ace9ca10a788b573728))


### Bug Fixes

* added different search way for movies ([934e86c](https://github.com/Gitsack/hamster/commit/934e86c0565adaf17bd0d7dc5505830c4f211881))
* apostrophes in search queries ([f20860c](https://github.com/Gitsack/hamster/commit/f20860cbbff7e093c62ade84ee13f16425d9c1c8))
* delete file on remove button for importing items ([052668f](https://github.com/Gitsack/hamster/commit/052668fb106aa6cb65edc533f16503ee23da8657))
* direct download ([cb4885f](https://github.com/Gitsack/hamster/commit/cb4885f7628a5c73b06beb1414589a4ff7e45c59))
* filesize maximum, original titles ([36cbdf2](https://github.com/Gitsack/hamster/commit/36cbdf2c3610bcaf2230d683a2b0620ffca2888c))
* fixes for queue and activity tabs ([5ad4e0a](https://github.com/Gitsack/hamster/commit/5ad4e0a08c08a158744018b2ace475c7a56a7993))
* handle stuck importing entries ([219c52e](https://github.com/Gitsack/hamster/commit/219c52e7c76c9986cc7a9c4a5756a58bd5b741ce))
* null error ([47c30d5](https://github.com/Gitsack/hamster/commit/47c30d52adfc0b59ff9d534911ad28a06171bac2))

## [1.20.3](https://github.com/Gitsack/hamster/compare/hamster-v1.20.2...hamster-v1.20.3) (2026-02-25)


### Bug Fixes

* media-hero ([e84dd9b](https://github.com/Gitsack/hamster/commit/e84dd9b1c800062e6cbbf1027a64675e516d6327))

## [1.20.2](https://github.com/Gitsack/hamster/compare/hamster-v1.20.1...hamster-v1.20.2) (2026-02-25)


### Bug Fixes

* different matching for deduplication ([520322e](https://github.com/Gitsack/hamster/commit/520322e069456db52725afb5444190f166a62266))

## [1.20.1](https://github.com/Gitsack/hamster/compare/hamster-v1.20.0...hamster-v1.20.1) (2026-02-25)


### Bug Fixes

* deduplicate download items that have already been downloaded ([f723050](https://github.com/Gitsack/hamster/commit/f723050a74e1a1d4008eb974e1333aeaf8f34824))

## [1.20.0](https://github.com/Gitsack/hamster/compare/hamster-v1.19.1...hamster-v1.20.0) (2026-02-25)


### Features

* new size quality profile ([c069e95](https://github.com/Gitsack/hamster/commit/c069e95a4c24ab0870104299ea7ee30cc5830f09))

## [1.19.1](https://github.com/Gitsack/hamster/compare/hamster-v1.19.0...hamster-v1.19.1) (2026-02-25)


### Bug Fixes

* duplication check on adding items ([2c13b05](https://github.com/Gitsack/hamster/commit/2c13b05c793f9082a6f116c661bdc2e81d2afdcc))

## [1.19.0](https://github.com/Gitsack/hamster/compare/hamster-v1.18.0...hamster-v1.19.0) (2026-02-25)


### Features

* directly access sabnzbd when deduplicating ([981ff75](https://github.com/Gitsack/hamster/commit/981ff753d1e90e7e1d79c957c169809e70f49de1))

## [1.18.0](https://github.com/Gitsack/hamster/compare/hamster-v1.17.5...hamster-v1.18.0) (2026-02-25)


### Features

* scheduled metadata refresh, media hero, deduplicate action ([b087601](https://github.com/Gitsack/hamster/commit/b08760157c29c28d5e441c5dfa8fa68603c959f1))


### Bug Fixes

* lane refresh mid scroll ([ce8c941](https://github.com/Gitsack/hamster/commit/ce8c94109ba798bd66377ac32adb8795c174aef1))
* next fix for lane refresh bug ([963b8db](https://github.com/Gitsack/hamster/commit/963b8dbcfca888747fa1619302e290d46072dcf2))

## [1.17.5](https://github.com/Gitsack/hamster/compare/hamster-v1.17.4...hamster-v1.17.5) (2026-02-15)


### Bug Fixes

* correct chown directories ([3dd8178](https://github.com/Gitsack/hamster/commit/3dd8178e440e9b8086e6988a4afb5dda75800044))

## [1.17.4](https://github.com/Gitsack/hamster/compare/hamster-v1.17.3...hamster-v1.17.4) (2026-02-15)


### Bug Fixes

* streaming server matching, correct chowning ([d9e41c2](https://github.com/Gitsack/hamster/commit/d9e41c2055922fc9b510d61a494587149f3b5c1e))

## [1.17.3](https://github.com/Gitsack/hamster/compare/hamster-v1.17.2...hamster-v1.17.3) (2026-02-15)


### Bug Fixes

* chown only necessary folders ([c160d02](https://github.com/Gitsack/hamster/commit/c160d02588a6b160ee80b113fcc4c1fc6e1c1984))

## [1.17.2](https://github.com/Gitsack/hamster/compare/hamster-v1.17.1...hamster-v1.17.2) (2026-02-15)


### Bug Fixes

* updated docker start interval to 2s ([a2364cd](https://github.com/Gitsack/hamster/commit/a2364cd0ee776084e4edfa12ab7a560458b16735))

## [1.17.1](https://github.com/Gitsack/hamster/compare/hamster-v1.17.0...hamster-v1.17.1) (2026-02-15)


### Bug Fixes

* show download matching ([977503b](https://github.com/Gitsack/hamster/commit/977503b55b23dcc327b2dff0083d7bed11c69c78))

## [1.17.0](https://github.com/Gitsack/hamster/compare/hamster-v1.16.0...hamster-v1.17.0) (2026-02-15)


### Features

* better streaming service selection ([138761d](https://github.com/Gitsack/hamster/commit/138761d910ca889acbfdf2f8ecb2b676885a7be6))
* quick view of personal streaming availability ([829a1dd](https://github.com/Gitsack/hamster/commit/829a1dd60c03ae088ad5ae5a897f1adb53b0b571))


### Bug Fixes

* adapted streaming loading debounce ([dfe68e1](https://github.com/Gitsack/hamster/commit/dfe68e1693d70f1862a3aa463705e0a40fc2bd11))
* correct appearing streaming badges ([425e973](https://github.com/Gitsack/hamster/commit/425e9732b62c6f4b2bc65caaa3b3c523ce3be424))

## [1.16.0](https://github.com/Gitsack/hamster/compare/hamster-v1.15.4...hamster-v1.16.0) (2026-02-14)


### Features

* added trailers and more pictures to entry details ([7c110d7](https://github.com/Gitsack/hamster/commit/7c110d791dc2341b86f4262c42385cf5cb1b39cc))
* different media types sorting ([5ecf6fb](https://github.com/Gitsack/hamster/commit/5ecf6fb925f55345625cbe54f0b32f5953510ad3))
* more teasers open in sidebar ([de086b7](https://github.com/Gitsack/hamster/commit/de086b740580f49b0bfa9bf99791dd8659fecafc))
* show more on discover lanes, media type query params ([b8a6939](https://github.com/Gitsack/hamster/commit/b8a6939f113277cc5b8513b16432bac8ec510550))
* similar lane, discover improvements ([9ff81cf](https://github.com/Gitsack/hamster/commit/9ff81cfe5600629512c320029d99e861a598840f))


### Bug Fixes

* dont link to library entry after requesting from details ([6f30bca](https://github.com/Gitsack/hamster/commit/6f30bca07f76111ef14c0dd7ab881e53118849a1))

## [1.15.4](https://github.com/Gitsack/hamster/compare/hamster-v1.15.3...hamster-v1.15.4) (2026-02-14)


### Bug Fixes

* dynamic imports ([ae19bb4](https://github.com/Gitsack/hamster/commit/ae19bb45233fbbd3a47b6a2e2adf33cd00978c3c))

## [1.15.3](https://github.com/Gitsack/hamster/compare/hamster-v1.15.2...hamster-v1.15.3) (2026-02-14)


### Bug Fixes

* error handling ([dad7edf](https://github.com/Gitsack/hamster/commit/dad7edf1a55099238aa6a3139b6965a3d9f165fe))

## [1.15.2](https://github.com/Gitsack/hamster/compare/hamster-v1.15.1...hamster-v1.15.2) (2026-02-14)


### Bug Fixes

* updated bun ([b69cdf3](https://github.com/Gitsack/hamster/commit/b69cdf3ba381366f16b7d6c7723ce42b2041d2d4))

## [1.15.1](https://github.com/Gitsack/hamster/compare/hamster-v1.15.0...hamster-v1.15.1) (2026-02-14)


### Bug Fixes

* promote a regular user to admin if last one ([85d79d0](https://github.com/Gitsack/hamster/commit/85d79d0188037cfc5eeb6dcd8ffca950beb03d57))

## [1.15.0](https://github.com/Gitsack/hamster/compare/hamster-v1.14.0...hamster-v1.15.0) (2026-02-14)


### Features

* structural changes ([3907a72](https://github.com/Gitsack/hamster/commit/3907a72b0892a421d77f3d8b64e74e7e45927eb1))
* trakt and justwatch integrations ([ebf06a8](https://github.com/Gitsack/hamster/commit/ebf06a81aec10c498410f4c93d40b797ffecef2c))

## [1.14.0](https://github.com/Gitsack/hamster/compare/hamster-v1.13.0...hamster-v1.14.0) (2026-01-27)

### Features

- added different downloaders to UI ([4c89c8c](https://github.com/Gitsack/hamster/commit/4c89c8c4a9c22b27bdcd1eb53208509fd53d1566))
- added genre tags for movie/show search ([4188a37](https://github.com/Gitsack/hamster/commit/4188a37e5e408531230167ab5a9bbfe9a2b61afb))
- new library system and cleanups ([913a749](https://github.com/Gitsack/hamster/commit/913a74922976a3f25d5449541c75289301b3535c))
- unified download dialog, search details sheet for movie and show ([d9cd167](https://github.com/Gitsack/hamster/commit/d9cd167d7f1eeb99dc3f3ef45b0160cf1047b9b9))
- use unified badges, click event fixes ([3d181fe](https://github.com/Gitsack/hamster/commit/3d181fedf9f8a24d5d846240925e01bd71c16164))

## [1.13.0](https://github.com/Gitsack/hamster/compare/hamster-v1.12.0...hamster-v1.13.0) (2026-01-12)

### Features

- added webhooks and other dl options ([9570aa6](https://github.com/Gitsack/hamster/commit/9570aa6cc9ed51f97c89d45918608d9a44dbc2e1))

## [1.12.0](https://github.com/Gitsack/hamster/compare/hamster-v1.11.0...hamster-v1.12.0) (2026-01-11)

### Features

- added version to sidebar ([c96e2df](https://github.com/Gitsack/hamster/commit/c96e2dfff6e455ce5ad22d41d8a1274a19bbe2da))

## [1.11.0](https://github.com/Gitsack/hamster/compare/hamster-v1.10.0...hamster-v1.11.0) (2026-01-11)

### Features

- better retries and blacklistings for failed downloads ([c4a2af1](https://github.com/Gitsack/hamster/commit/c4a2af1e2f2d6b08d246512cce773d087174b450))

## [1.10.0](https://github.com/Gitsack/hamster/compare/hamster-v1.9.1...hamster-v1.10.0) (2026-01-08)

### Features

- updated tv show fetching of tmdb data ([5d30808](https://github.com/Gitsack/hamster/commit/5d30808dc0d21cebfb1d65b8688abed6b34be9fd))

## [1.9.1](https://github.com/Gitsack/hamster/compare/hamster-v1.9.0...hamster-v1.9.1) (2026-01-08)

### Bug Fixes

- updated bun lockfile ([3d6f94d](https://github.com/Gitsack/hamster/commit/3d6f94da4c7fd64ddabfc0515003e7939c06cbc4))

## [1.9.0](https://github.com/Gitsack/hamster/compare/hamster-v1.8.0...hamster-v1.9.0) (2026-01-06)

### Features

- general playback of items ([14add3a](https://github.com/Gitsack/hamster/commit/14add3ab473a2bdf75a52c2585b8855266284801))
- hw acceleration ([f6f8fc7](https://github.com/Gitsack/hamster/commit/f6f8fc7703706df27a2703c53d6561201dd2e285))

## [1.8.0](https://github.com/Gitsack/hamster/compare/hamster-v1.7.1...hamster-v1.8.0) (2026-01-05)

### Features

- further improved matching previously downloaded items ([ca146f6](https://github.com/Gitsack/hamster/commit/ca146f6c3f5e92b2028c56bea8115660485bcfdb))
- improved album and artist matching ([f8d5eec](https://github.com/Gitsack/hamster/commit/f8d5eec1e5383f94f0d39cd689793d24de93abe2))

## [1.7.1](https://github.com/Gitsack/hamster/compare/hamster-v1.7.0...hamster-v1.7.1) (2026-01-05)

### Bug Fixes

- tv show scanning for episodes ([65125bf](https://github.com/Gitsack/hamster/commit/65125bf4872dc4afbbfbe9a6a02c9969f9a7153f))

## [1.7.0](https://github.com/Gitsack/hamster/compare/hamster-v1.6.3...hamster-v1.7.0) (2026-01-04)

### Features

- library scan for files ([89b86ca](https://github.com/Gitsack/hamster/commit/89b86caa1253f073a12ecbd2c5403e6302de40e1))

## [1.6.3](https://github.com/Gitsack/hamster/compare/hamster-v1.6.2...hamster-v1.6.3) (2026-01-04)

### Bug Fixes

- order of preloads in adonisrc ([d6e642a](https://github.com/Gitsack/hamster/commit/d6e642a5fe4c2f21af34e1b5ac325bac7523e96f))

## [1.6.2](https://github.com/Gitsack/hamster/compare/hamster-v1.6.1...hamster-v1.6.2) (2026-01-04)

### Bug Fixes

- docker image size ([4efa872](https://github.com/Gitsack/hamster/commit/4efa872edd24c90f2fe00e1ec97ac2acd04849c0))

## [1.6.1](https://github.com/Gitsack/hamster/compare/hamster-v1.6.0...hamster-v1.6.1) (2026-01-04)

### Bug Fixes

- docker gh build guid ([5288c0c](https://github.com/Gitsack/hamster/commit/5288c0c94fd986b15b558880739b041d733fb2e4))

## [1.6.0](https://github.com/Gitsack/hamster/compare/hamster-v1.5.0...hamster-v1.6.0) (2026-01-04)

### Features

- added pgid puid ([d8dc7c1](https://github.com/Gitsack/hamster/commit/d8dc7c194071301a8a9f3ea7ceb4f3e41811537b))

## [1.5.0](https://github.com/Gitsack/hamster/compare/hamster-v1.4.1...hamster-v1.5.0) (2026-01-04)

### Features

- added secure_cookies env ([6cf76d1](https://github.com/Gitsack/hamster/commit/6cf76d1c6d1ad2016135df5f9f1f8a60eda61588))

## [1.4.1](https://github.com/Gitsack/hamster/compare/hamster-v1.4.0...hamster-v1.4.1) (2026-01-04)

### Bug Fixes

- docker folders ([2f9bfa0](https://github.com/Gitsack/hamster/commit/2f9bfa0ce66ff1c4b95acfd6f4dd578567ce99cb))

## [1.4.0](https://github.com/Gitsack/hamster/compare/hamster-v1.3.1...hamster-v1.4.0) (2026-01-04)

### Features

- add license and contributing ([f04255b](https://github.com/Gitsack/hamster/commit/f04255b5aea900affd9a48d13c0c4f37076899b6))

## [1.3.1](https://github.com/Gitsack/hamster/compare/hamster-v1.3.0...hamster-v1.3.1) (2026-01-04)

### Bug Fixes

- updated lockfiles ([82616fc](https://github.com/Gitsack/hamster/commit/82616fc5268adb5b5cbb73d0685e50d62090c76e))

## [1.3.0](https://github.com/Gitsack/mediabox/compare/hamster-v1.2.0...hamster-v1.3.0) (2026-01-04)

### Features

- added gh actions for release and image push ([453ca8a](https://github.com/Gitsack/mediabox/commit/453ca8a1a2a90d7b05a9bad43fe62d60d1b5854c))
- added shadcn ([b385ca4](https://github.com/Gitsack/mediabox/commit/b385ca4a5a5746de9d00f412d8fb200ffa40b70a))
- added unified spinner component ([99ad097](https://github.com/Gitsack/mediabox/commit/99ad097ca3caf98eb35558a766896e8de4ce49da))
- album artist search ([ce46162](https://github.com/Gitsack/mediabox/commit/ce46162e63655255e25116a56b759215cd22ccef))
- docker, new quality profiles, dialog updates ([03d421b](https://github.com/Gitsack/mediabox/commit/03d421b0208f491b9d1a69cf4359792bc252965f))
- home & getting started pages ([c1a92f1](https://github.com/Gitsack/mediabox/commit/c1a92f125f911b57106cbbc9f5169516669d3268))
- initial music implementation ([7ea57d2](https://github.com/Gitsack/mediabox/commit/7ea57d26a529ce43b86b715bc1e96374d4cca5c1))
- make APP_KEY optional as docker variable ([263bd2e](https://github.com/Gitsack/mediabox/commit/263bd2ea7dbdbb3413c60b49e78db729f161f03d))
- new download options / structure ([c0df269](https://github.com/Gitsack/mediabox/commit/c0df269ea37426200e44fe1f94924744715d09b3))
- new media structure ([85cb00a](https://github.com/Gitsack/mediabox/commit/85cb00a1ebe566b5968697cdc7b821c179ea6bf4))
- new media types ([728faed](https://github.com/Gitsack/mediabox/commit/728faed66f135ea3ada42bf7b8f039f8a02a9a27))
- only one workflow file ([28aeeeb](https://github.com/Gitsack/mediabox/commit/28aeeeba413691daccfa1ed4bd051cfa066c0f69))
- renamed to hamster ([39b4105](https://github.com/Gitsack/mediabox/commit/39b4105739b6cc64ff8abe4669268f5f7bcbf984))
- search ([3d40efb](https://github.com/Gitsack/mediabox/commit/3d40efb7e841ff980060f3a21962bfca65b84c09))
- unified status badge ([a919d39](https://github.com/Gitsack/mediabox/commit/a919d392e49bbbc572c36755653afa42f8df8255))
- working download ([d4579d6](https://github.com/Gitsack/mediabox/commit/d4579d67387d90f0593d868b339e054b31bc6e56))

### Bug Fixes

- artists view, albums ([6486efa](https://github.com/Gitsack/mediabox/commit/6486efa7d8d02a22497dc530bb01b5380ed142b4))
- better download and sync to sabnzbd ([cebf877](https://github.com/Gitsack/mediabox/commit/cebf8774135a41c11d945180f62ad10d0ffa961e))
- consolidatet readme files ([524d199](https://github.com/Gitsack/mediabox/commit/524d19981a3097699937a894445f31d8b94011c7))
- lowercase github repo name ([79e7548](https://github.com/Gitsack/mediabox/commit/79e7548ee6106997d29c8fabf3b460a09b40a4bb))
- provenance for docker build and push ([ba9bd66](https://github.com/Gitsack/mediabox/commit/ba9bd66f7e864c7d7156037d453f2363815a1b70))
- use amd64 platform ([b97286d](https://github.com/Gitsack/mediabox/commit/b97286d7dad64a7e64180785c77bc44141bef3dc))

## [1.2.0](https://github.com/Gitsack/mediabox/compare/mediabox-v1.1.3...mediabox-v1.2.0) (2026-01-04)

### Features

- make APP_KEY optional as docker variable ([263bd2e](https://github.com/Gitsack/mediabox/commit/263bd2ea7dbdbb3413c60b49e78db729f161f03d))

## [1.1.3](https://github.com/Gitsack/mediabox/compare/mediabox-v1.1.2...mediabox-v1.1.3) (2026-01-03)

### Bug Fixes

- lowercase github repo name ([79e7548](https://github.com/Gitsack/mediabox/commit/79e7548ee6106997d29c8fabf3b460a09b40a4bb))

## [1.1.2](https://github.com/Gitsack/mediabox/compare/mediabox-v1.1.1...mediabox-v1.1.2) (2026-01-03)

### Bug Fixes

- provenance for docker build and push ([ba9bd66](https://github.com/Gitsack/mediabox/commit/ba9bd66f7e864c7d7156037d453f2363815a1b70))

## [1.1.1](https://github.com/Gitsack/mediabox/compare/mediabox-v1.1.0...mediabox-v1.1.1) (2026-01-03)

### Bug Fixes

- use amd64 platform ([b97286d](https://github.com/Gitsack/mediabox/commit/b97286d7dad64a7e64180785c77bc44141bef3dc))

## [1.1.0](https://github.com/Gitsack/mediabox/compare/mediabox-v1.0.1...mediabox-v1.1.0) (2026-01-03)

### Features

- only one workflow file ([28aeeeb](https://github.com/Gitsack/mediabox/commit/28aeeeba413691daccfa1ed4bd051cfa066c0f69))

## [1.0.1](https://github.com/Gitsack/mediabox/compare/mediabox-v1.0.0...mediabox-v1.0.1) (2026-01-03)

### Bug Fixes

- consolidatet readme files ([524d199](https://github.com/Gitsack/mediabox/commit/524d19981a3097699937a894445f31d8b94011c7))

## 1.0.0 (2026-01-03)

### Features

- added gh actions for release and image push ([453ca8a](https://github.com/Gitsack/mediabox/commit/453ca8a1a2a90d7b05a9bad43fe62d60d1b5854c))
- added shadcn ([b385ca4](https://github.com/Gitsack/mediabox/commit/b385ca4a5a5746de9d00f412d8fb200ffa40b70a))
- added unified spinner component ([99ad097](https://github.com/Gitsack/mediabox/commit/99ad097ca3caf98eb35558a766896e8de4ce49da))
- album artist search ([ce46162](https://github.com/Gitsack/mediabox/commit/ce46162e63655255e25116a56b759215cd22ccef))
- docker, new quality profiles, dialog updates ([03d421b](https://github.com/Gitsack/mediabox/commit/03d421b0208f491b9d1a69cf4359792bc252965f))
- home & getting started pages ([c1a92f1](https://github.com/Gitsack/mediabox/commit/c1a92f125f911b57106cbbc9f5169516669d3268))
- initial music implementation ([7ea57d2](https://github.com/Gitsack/mediabox/commit/7ea57d26a529ce43b86b715bc1e96374d4cca5c1))
- new download options / structure ([c0df269](https://github.com/Gitsack/mediabox/commit/c0df269ea37426200e44fe1f94924744715d09b3))
- new media structure ([85cb00a](https://github.com/Gitsack/mediabox/commit/85cb00a1ebe566b5968697cdc7b821c179ea6bf4))
- new media types ([728faed](https://github.com/Gitsack/mediabox/commit/728faed66f135ea3ada42bf7b8f039f8a02a9a27))
- search ([3d40efb](https://github.com/Gitsack/mediabox/commit/3d40efb7e841ff980060f3a21962bfca65b84c09))
- unified status badge ([a919d39](https://github.com/Gitsack/mediabox/commit/a919d392e49bbbc572c36755653afa42f8df8255))
- working download ([d4579d6](https://github.com/Gitsack/mediabox/commit/d4579d67387d90f0593d868b339e054b31bc6e56))

### Bug Fixes

- artists view, albums ([6486efa](https://github.com/Gitsack/mediabox/commit/6486efa7d8d02a22497dc530bb01b5380ed142b4))
- better download and sync to sabnzbd ([cebf877](https://github.com/Gitsack/mediabox/commit/cebf8774135a41c11d945180f62ad10d0ffa961e))
