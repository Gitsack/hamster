# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a **solo homelab operator**: one technically capable person who installs Hamster, configures it, and runs it for themselves. They are the admin, the daily user, and the person who debugs it when a download fails.

Their situation: a self-hosted box (usually Docker, often behind a VPN container), a personal media library across four media types, and a set of external services — indexers, download clients, metadata providers — that must be kept working. They already know the \*arr ecosystem's vocabulary (quality profiles, root folders, grabs, imports, blacklists) and expect it to be present.

Their job: keep a library complete and correctly organized without babysitting five separate applications. Day to day this means adding media, checking what got grabbed, seeing what failed, and fixing the thing that broke.

Hamster does support multiple user accounts with an `isAdmin` flag and a Users settings screen, but the design target is the operator. Non-admin accounts are a supported capability, not the audience the interface is shaped around.

## Product Purpose

Hamster is a self-hosted media management application that finds, downloads, organizes, and serves a personal library of **music, movies, TV shows, and books** from a single install.

It exists because the incumbent solution is a stack: Lidarr + Radarr + Sonarr + Readarr, plus Prowlarr, plus a request app, each with its own database, its own settings, its own UI, and its own upgrade path. Hamster replaces that stack with one application, one library, one queue, one history.

Success is an operator who stops thinking about the tooling: media appears where it should, in the quality it should, and the interface tells them plainly when it did not.

## Positioning

Three claims a neighboring tool could not truthfully make in combination:

1. **One app replaces the \*arr stack.** Music, movies, TV, and books are first-class in the same install, sharing one library model, one activity queue, one history, one set of indexers and download clients — not four apps wearing the same theme.
2. **Requests are native, not bolted on.** Discovery, requesting, and approval live inside the product; there is no companion service (Overseerr/Ombi) to deploy, authenticate, and keep in sync.
3. **The modern interface is itself the reason to switch.** The \*arr apps are functionally strong and visually dated. A genuinely current, coherent interface is not decoration here — it is a stated product differentiator and a reason people adopt it.

Explicitly **not** the position: replacing Plex/Jellyfin/Emby as the playback layer. Hamster plays and transcodes media (see Capabilities), but "manage and play in one place" is not a claim the product leads with, and design work should not treat it as one.

## Operating Context

- **Deployment:** Docker / `docker compose`, published as `ghcr.io/gitsack/hamster`. Media mounts at `/media/music`, `/media/movies`, `/media/tv`, `/media/books`; download client output at `/downloads`. Root folders are configured in the UI using container paths. Development also runs directly on the host via `npm run dev` — both runtimes must work.
- **External services the operator wires up:** indexers via Prowlarr or raw Newznab; download clients (SABnzbd, NZBGet, qBittorrent, Deluge, Transmission); metadata from TMDB, MusicBrainz, OpenLibrary, CoverArt, Trakt, JustWatch; optional media-server refresh hooks into Plex, Emby, or Jellyfin; notifications and outbound webhooks.
- **Recurring rituals:** run a library scan, review the activity queue, inspect history when something did not arrive, check the calendar for upcoming releases, adjust quality profiles, resolve unmatched files, clear a blacklisted release and retry.
- **Failure is a normal state, not an edge case.** Downloads stall, imports fail, indexers rate-limit, DNS breaks behind a VPN sidecar. The interface's job during those moments is diagnosis: what was attempted, what came back, what to do next.

## Capabilities and Constraints

**Confirmed capabilities**

- Four media types with full hierarchies: Artist → Album → Track, Movie, TV Show → Season → Episode, Author → Book, each with a file model.
- Library management: root folders, scanning, matching, file naming and organization templates, unmatched-file resolution, metadata refresh, tags, quality profiles, custom formats, blacklisted releases.
- Acquisition: indexer search and release selection, grabbing to a download client, queue monitoring, completed-download scanning, import, stuck-import recovery.
- Requests and discovery, calendar of upcoming releases, dashboard, activity queue and history, system status and event log.
- Import lists (IMDb, Trakt), notifications, webhooks with delivery history, API keys, backups, scheduled tasks.
- Playback: an in-app player and a video transcoding service with hardware-acceleration settings. Real functionality, but not the product's positioning.
- Accounts with an admin flag, registration, password reset, per-user settings.

**Technical constraints**

- AdonisJS 6 + Inertia.js + React 19, PostgreSQL via Lucid ORM, Tailwind v4 with shadcn/ui components and Hugeicons.
- API surface under `/api/v1`; pages are Inertia-rendered and receive server-side props.
- Every change must work under both `npm run dev` on the host and inside the Docker Compose stack.
- GPL-3.0.

**Durable design constraints the user made binding**

- **Dark mode is first-class.** Every surface must work in both themes. Self-hosters commonly run dark permanently; it can never be the second-class path.
- **Mobile and tablet are real usage.** The app is genuinely used from a phone or tablet, away from the desk. Responsive behavior is a requirement, not a courtesy.
- **Self-hosted with no external dependencies.** No CDN fonts or assets, no telemetry, no phone-home. It must run fully on a LAN-only box with no internet access to third-party frontend services.

**Explicitly not pinned**

The current visual implementation (Tailwind v4 + shadcn/ui defaults, oklch token set, violet primary, Hugeicons) exists and is the incumbent, but the user did **not** declare it a durable constraint. It is evidence, not a commitment. Whether future work preserves, extends, or replaces that visual world is an open decision to be made in a visual-world step — not assumed here in either direction.

## Brand Commitments

- Name: **Hamster**. Repository and image namespace: `Gitsack/hamster`, `ghcr.io/gitsack/hamster`.
- A hamster mark exists in code (`inertia/components/icons/hamster-icon.tsx`) and is used in the sidebar header.
- No voice, tone, or personality guidelines have been confirmed. Do not invent brand language.

## Evidence on Hand

- `README.md` — install, Docker, volume mounts, environment variables.
- `docs/FEATURE_ROADMAP.md` — the \*arr-parity plan, with schema and event-type definitions.
- `CHANGELOG.md` and release-please versioning; currently at 1.27.0.
- Storybook is configured (`npm run storybook`), with stories for some components.
- Frontend tests (Vitest) and backend tests (Japa) exist for parts of the app.

**Absences future work must not fabricate:** there are no testimonials, no user counts, no case studies, no benchmarks, no pricing, no hosted/SaaS offering, and no confirmed adoption numbers. Hamster is a GPL-3.0 self-hosted project; do not write marketing claims it cannot support.

## Product Principles

1. **One app, one mental model.** Four media types share the same library, queue, history, and settings vocabulary. Where a type genuinely differs (tracks vs. episodes vs. chapters), the difference should be visible in the data, not in a divergent interface pattern.
2. **The operator is expert; do not dumb it down.** Quality strings, release names, indexer responses, and task state are the information the user came for. Density and precision beat simplification.
3. **Design for the failure, not the happy path.** The screens that matter most are the ones shown when a grab, import, or connection went wrong. They must say what was attempted, what came back, and what to do next.
4. **Modernity is a feature, not a coat of paint.** Looking and feeling current is a reason people choose this over the \*arr stack; visual quality carries real product weight.
5. **Runs anywhere, depends on nothing.** Dark and light, phone and desktop, LAN-only and offline. Anything that assumes an internet-reachable frontend service is a defect.

## Accessibility & Inclusion

No product-specific accessibility standard was established. Baseline expectations still apply: both themes must meet contrast requirements, and the interface must remain usable at tablet and phone widths.
