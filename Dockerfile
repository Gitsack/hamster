# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Base image with build dependencies
# ============================================
FROM oven/bun:1-alpine AS base

# Install system dependencies needed for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    bash

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
FROM oven/bun:1-alpine AS production

# Install only essential runtime dependencies (removed bash)
RUN apk add --no-cache \
    curl \
    tini \
    shadow \
    su-exec

# Create hamster user with placeholder UID/GID (will be modified at runtime via PUID/PGID)
RUN addgroup -g 911 -S hamster && \
    adduser -S -D -H -u 911 -h /app -s /sbin/nologin -G hamster hamster

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
    mkdir -p /media/music /media/movies /media/tv /media/books /downloads /app/tmp && \
    chown hamster:hamster /app/tmp

# Note: Container starts as root, entrypoint drops to hamster user after PUID/PGID setup

# Expose the application port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --start-interval=2s --retries=3 \
    CMD curl -f http://localhost:3333/health || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]

# Default command
CMD ["bun", "run", "bin/server.js"]
