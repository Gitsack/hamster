# Mediabox

A self-hosted media management application for organizing and streaming your personal media library.

## Features

- Manage music, movies, TV shows, and books
- Modern web interface built with React and Inertia.js
- PostgreSQL database for reliable data storage
- Docker support for easy deployment

## Quick Start

### Using Docker Compose

1. Clone the repository:
   ```bash
   git clone https://github.com/Gitsack/mediabox.git
   cd mediabox
   ```

2. Create a `.env` file:
   ```bash
   # Required - generate with: openssl rand -hex 32
   APP_KEY=your-32-character-secret-key

   # Database (optional, defaults shown)
   DB_USER=mediabox
   DB_PASSWORD=changeme
   DB_DATABASE=mediabox

   # Media paths (optional, defaults to ./media/*)
   MUSIC_PATH=/path/to/your/music
   MOVIES_PATH=/path/to/your/movies
   TV_PATH=/path/to/your/tv
   BOOKS_PATH=/path/to/your/books
   DOWNLOADS_PATH=/path/to/your/downloads

   # Timezone (optional)
   TZ=UTC
   ```

3. Start the application:
   ```bash
   docker compose up -d
   ```

4. Access Mediabox at `http://localhost:3333`

### Using Pre-built Image

```bash
docker pull ghcr.io/gitsack/mediabox:latest
```

## Development

### Prerequisites

- Node.js 22+
- PostgreSQL 16+

### Setup

```bash
# Install dependencies
npm install

# Run database migrations
node ace migration:run

# Start development server
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run typecheck` | Run TypeScript type checking |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_KEY` | Application secret key (required) | - |
| `PORT` | Application port | `3333` |
| `HOST` | Application host | `0.0.0.0` |
| `NODE_ENV` | Environment mode | `development` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_USER` | Database user | `mediabox` |
| `DB_PASSWORD` | Database password | `changeme` |
| `DB_DATABASE` | Database name | `mediabox` |
| `LOG_LEVEL` | Logging level | `info` |
| `TZ` | Timezone | `UTC` |

## License

This project is proprietary software.
