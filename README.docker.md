# Mediabox Docker Setup

Run Mediabox using Docker with PostgreSQL database.

## Quick Start

1. **Clone and configure:**
   ```bash
   git clone <repository-url>
   cd mediabox
   cp .env.example .env
   ```

2. **Generate APP_KEY and configure .env:**
   ```bash
   # Generate a secure key
   openssl rand -hex 32
   # Or: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Edit `.env` and set your configuration:
   ```env
   APP_KEY=<your-generated-key>

   # Media paths (adjust to your setup)
   MUSIC_PATH=/path/to/music
   MOVIES_PATH=/path/to/movies
   TV_PATH=/path/to/tv
   BOOKS_PATH=/path/to/books
   DOWNLOADS_PATH=/path/to/downloads
   ```

3. **Start the application:**
   ```bash
   docker compose up -d
   ```

4. **Access Mediabox:**
   Open http://localhost:3333 in your browser.

## Using Pre-built Image

If an image is published to a registry:

```bash
# Pull the image
docker pull <registry>/mediabox:latest

# Use docker-compose with the pre-built image
# Edit docker-compose.yml to use the image instead of building:
#   image: <registry>/mediabox:latest
#   # comment out: build: ...
```

## Volume Mounts

The container expects media to be mounted at these paths:

| Container Path | Description | Environment Variable |
|----------------|-------------|---------------------|
| `/media/music` | Music library | `MUSIC_PATH` |
| `/media/movies` | Movies library | `MOVIES_PATH` |
| `/media/tv` | TV Shows library | `TV_PATH` |
| `/media/books` | Books library | `BOOKS_PATH` |
| `/downloads` | Download client output | `DOWNLOADS_PATH` |

Configure these in your `.env` file or pass them directly to docker compose:

```bash
MUSIC_PATH=/mnt/media/music MOVIES_PATH=/mnt/media/movies docker compose up -d
```

## Configuration in Mediabox

After starting, configure your root folders in the Mediabox UI:
- Music: `/media/music`
- Movies: `/media/movies`
- TV Shows: `/media/tv`
- Books: `/media/books`

For download clients, use `/downloads` as the path.

## Commands

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f mediabox

# Stop services
docker compose down

# Rebuild after code changes
docker compose up -d --build

# Run database migrations manually
docker compose exec mediabox node ace migration:run

# Access container shell
docker compose exec mediabox sh
```

## Building for Distribution

Build and push to a container registry:

```bash
# Build the image
docker build -t mediabox:latest .

# Tag for your registry
docker tag mediabox:latest ghcr.io/<username>/mediabox:latest
# or: docker tag mediabox:latest <username>/mediabox:latest

# Push to registry
docker push ghcr.io/<username>/mediabox:latest
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3333` | Application port |
| `TZ` | `UTC` | Timezone |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `APP_KEY` | - | **Required.** Encryption key (32 hex chars) |
| `DB_USER` | `mediabox` | PostgreSQL username |
| `DB_PASSWORD` | `changeme` | PostgreSQL password |
| `DB_DATABASE` | `mediabox` | PostgreSQL database name |
| `MUSIC_PATH` | `./media/music` | Host path to music library |
| `MOVIES_PATH` | `./media/movies` | Host path to movies library |
| `TV_PATH` | `./media/tv` | Host path to TV shows library |
| `BOOKS_PATH` | `./media/books` | Host path to books library |
| `DOWNLOADS_PATH` | `./downloads` | Host path to downloads folder |

## Troubleshooting

**Container won't start:**
- Check logs: `docker compose logs mediabox`
- Ensure `APP_KEY` is set in `.env`
- Verify PostgreSQL is healthy: `docker compose ps`

**Media not accessible:**
- Verify volume paths exist on host
- Check file permissions (container runs as UID 1001)
- Ensure paths are correctly set in `.env`

**Database connection errors:**
- Wait for PostgreSQL to be ready (has health check)
- Check `DB_*` environment variables match between services

**Permission issues:**
For media directories, ensure the container user (UID 1001) has read access:
```bash
# Option 1: Make files world-readable
chmod -R o+r /path/to/media

# Option 2: Add user to the mediabox group
sudo groupadd -g 1001 mediabox
sudo chown -R :mediabox /path/to/media
```
