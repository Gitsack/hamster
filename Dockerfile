# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Base image with build dependencies
# ============================================
# Debian rather than Alpine throughout: the production image needs glibc for
# jellyfin-ffmpeg (see below), and node_modules built here are copied into it.
FROM oven/bun:1-debian AS base

# Install system dependencies needed for native modules
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ============================================
# Stage 2: Install ALL dependencies (for build)
# ============================================
FROM base AS deps

COPY package.json bun.lock* package-lock.json* ./
RUN bun install --frozen-lockfile

# ============================================
# Stage 3: Build the application
# ============================================
FROM deps AS builder

COPY . .
RUN bun run build

# ============================================
# Stage 4: Production dependencies only
# ============================================
FROM base AS prod-deps

COPY package.json bun.lock* package-lock.json* ./
RUN bun install --production --omit=optional --omit=peer --frozen-lockfile && \
    rm -rf ~/.bun/install/cache

# ============================================
# Stage 5: Production image (minimal)
# ============================================
FROM oven/bun:1-debian AS production

# ffmpeg carries ffprobe, which the importers use to verify a download is not
# corrupt and to trim surplus subtitle tracks. Without it both checks silently
# skip themselves, so a corrupt file imports looking perfectly healthy.
#
# It is Jellyfin's build (jellyfin-ffmpeg8), not Debian's: it ships the Intel
# media driver and the oneVPL GPU runtime that Quick Sync needs, which no
# Alpine package provides, and it is ffmpeg 8, past the 6.1 bug where the GPU
# scaler dies while flushing a file's last frames. Quick Sync's look-ahead
# made versions about 35% smaller than plain VAAPI at the same quality on an
# Iris Xe. Without a GPU passed through none of that is loaded.
#
# postgresql-client-16 carries pg_dump and psql for Settings → System →
# Backups; without them a backup fails with "spawn pg_dump ENOENT". It comes
# from PGDG so it matches the postgres:16 server in docker-compose.yml.
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg && \
    curl -fsSL https://repo.jellyfin.org/jellyfin_team.gpg.key \
      | gpg --dearmor -o /usr/share/keyrings/jellyfin.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/jellyfin.gpg] https://repo.jellyfin.org/debian trixie main" \
      > /etc/apt/sources.list.d/jellyfin.list && \
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt trixie-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      jellyfin-ffmpeg8 \
      postgresql-client-16 \
      tini \
      gosu && \
    ln -s /usr/lib/jellyfin-ffmpeg/ffmpeg /usr/local/bin/ffmpeg && \
    ln -s /usr/lib/jellyfin-ffmpeg/ffprobe /usr/local/bin/ffprobe && \
    apt-get purge -y gnupg && apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Create hamster user with placeholder UID/GID (will be modified at runtime via PUID/PGID)
RUN groupadd -r -g 911 hamster && \
    useradd -r -M -u 911 -g hamster -d /app -s /usr/sbin/nologin hamster

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/build ./

# Copy pre-built production node_modules (no reinstall needed)
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Make app files world-readable so any PUID/PGID can read them without runtime chown
RUN chmod -R a+rX /app && \
    mkdir -p /media/music /media/movies /media/tv /media/books /downloads /app/tmp /backups && \
    chown hamster:hamster /app/tmp /backups

# Note: Container starts as root, entrypoint drops to hamster user after PUID/PGID setup

# Expose the application port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --start-interval=2s --retries=3 \
    CMD curl -f http://localhost:3333/health || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--", "docker-entrypoint.sh"]

# Default command
CMD ["bun", "run", "bin/server.js"]
