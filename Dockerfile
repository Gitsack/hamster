# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Base image with dependencies
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
# Stage 2: Install dependencies
# ============================================
FROM base AS deps

# Copy package files
COPY package.json bun.lock* package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# ============================================
# Stage 3: Build the application
# ============================================
FROM deps AS builder

# Copy source code
COPY . .

# Build the application (compiles TypeScript + Vite frontend)
RUN bun run build

# ============================================
# Stage 4: Production image
# ============================================
FROM oven/bun:1-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    bash \
    tini \
    shadow \
    su-exec

# Create hamster user (UID/GID will be modified at runtime via PUID/PGID)
RUN addgroup -g 1000 -S hamster && \
    adduser -S -D -H -u 1000 -h /app -s /sbin/nologin -G hamster hamster

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/build ./
COPY --from=builder /app/package.json ./

# Install only production dependencies
RUN bun install --production && \
    rm -rf ~/.bun/install/cache

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create directories for media, downloads, and tmp with correct permissions
RUN mkdir -p /media/music /media/movies /media/tv /media/books /downloads /app/tmp && \
    chown -R hamster:hamster /app /media /downloads

# Note: Container starts as root, entrypoint drops to hamster user after PUID/PGID setup

# Expose the application port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3333/health || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]

# Default command
CMD ["bun", "run", "bin/server.js"]
