# Hamster

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
   git clone https://github.com/Gitsack/hamster.git
   cd hamster
   ```

2. Create a `.env` file:
   ```bash
   # Required - generate with: openssl rand -hex 32
   APP_KEY=your-32-character-secret-key

   # Database (optional, defaults shown)
   DB_USER=hamster
   DB_PASSWORD=changeme
   DB_DATABASE=hamster

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

4. Access Hamster at `http://localhost:3333`

### Using Pre-built Image

```bash
docker pull ghcr.io/gitsack/hamster:latest
```

### Volume Mounts

The container expects media to be mounted at these paths:

| Container Path | Description | Environment Variable |
|----------------|-------------|---------------------|
| `/media/music` | Music library | `MUSIC_PATH` |
| `/media/movies` | Movies library | `MOVIES_PATH` |
| `/media/tv` | TV Shows library | `TV_PATH` |
| `/media/books` | Books library | `BOOKS_PATH` |
| `/downloads` | Download client output | `DOWNLOADS_PATH` |

After starting, configure your root folders in the Hamster UI using the container paths (e.g., `/media/music`).

### Docker Commands

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f hamster

# Stop services
docker compose down

# Rebuild after code changes
docker compose up -d --build

# Run database migrations manually
docker compose exec hamster node ace migration:run

# Access container shell
docker compose exec hamster sh
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
| `DB_USER` | Database user | `hamster` |
| `DB_PASSWORD` | Database password | `changeme` |
| `DB_DATABASE` | Database name | `hamster` |
| `LOG_LEVEL` | Logging level | `info` |
| `TZ` | Timezone | `UTC` |

## Troubleshooting

**Container won't start:**
- Check logs: `docker compose logs hamster`
- Ensure `APP_KEY` is set in `.env`
- Verify PostgreSQL is healthy: `docker compose ps`

**Media not accessible:**
- Verify volume paths exist on host
- Check file permissions (container runs as UID 1001)
- Ensure paths are correctly set in `.env`

**Permission issues:**
```bash
# Option 1: Make files world-readable
chmod -R o+r /path/to/media

# Option 2: Add user to the hamster group
sudo groupadd -g 1001 hamster
sudo chown -R :hamster /path/to/media
```

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
