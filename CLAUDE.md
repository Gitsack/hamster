# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Hamster?

Hamster is a self-hosted media management application for organizing and streaming music, movies, TV shows, and books. It features a React frontend with Inertia.js and an AdonisJS 6 backend with PostgreSQL storage.

## Common Commands

```bash
# Development
npm run dev              # Start dev server with HMR
node ace migration:run   # Run database migrations

# Quality checks
npm run lint             # ESLint
npm run typecheck        # TypeScript checking
npm run format           # Prettier formatting

# Testing
npm test                 # Run tests (Japa)
npm run test:frontend         # Run frontend tests (Vitest)
npm run test:frontend:watch   # Run frontend tests in watch mode

# Storybook
npm run storybook             # Start Storybook dev server (port 6006)
npm run build-storybook       # Build static Storybook

# Production
npm run build            # Build for production
npm start                # Start production server
```

## Architecture

### Backend (AdonisJS 6)

- **Controllers** (`app/controllers/`): Handle HTTP requests, render Inertia pages
- **Models** (`app/models/`): Lucid ORM models for PostgreSQL - includes User, Artist, Album, Track, Movie, TvShow, Episode, Book, Author, Download, etc.
- **Services** (`app/services/`): Business logic organized by domain:
  - `media/`: Library scanning, file importing, transcoding, naming
  - `metadata/`: External API integrations (TMDB, MusicBrainz, OpenLibrary, CoverArt)
  - `download_clients/`: Download client integrations (SABnzbd, etc.)
  - `indexers/`: Prowlarr/Newznab integration for media search
  - `tasks/`: Scheduled background tasks
- **Validators** (`app/validators/`): VineJS schema validation
- **Routes** (`start/routes.ts`): All HTTP routes, API endpoints prefixed with `/api/v1`

### Frontend (React + Inertia.js)

- **Pages** (`inertia/pages/`): Inertia page components that receive server-side props
  - `library/`: Media library views (artist, album, movie, tvshow, author, book)
  - `settings/`: Configuration pages
  - `activity/`: Queue and history views
- **Components** (`inertia/components/`): Reusable React components
- **Hooks** (`inertia/hooks/`): Custom React hooks
- **Contexts** (`inertia/contexts/`): React context providers

### Import Aliases

The codebase uses `#` prefix imports configured in package.json:

- `#controllers/*`, `#models/*`, `#services/*`, `#validators/*`, `#utils/*` → `app/`
- `#config/*` → `config/`
- `#database/*` → `database/`

## Key External Integrations

- **TMDB**: Movie and TV show metadata
- **MusicBrainz**: Music metadata (artists, albums, tracks)
- **OpenLibrary**: Book and author metadata
- **Prowlarr**: Indexer management and search
- **Download clients**: SABnzbd and similar for downloading media

## Database

PostgreSQL with Lucid ORM. Migrations are in `database/migrations/`. Run `node ace migration:run` after pulling changes.

## Docker Development

```bash
docker compose up -d                          # Start services
docker compose logs -f hamster                # View logs
docker compose exec hamster node ace migration:run  # Run migrations in container
```
