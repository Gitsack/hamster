# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Base image with dependencies
# ============================================
FROM node:22-alpine AS base

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
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# ============================================
# Stage 3: Build the application
# ============================================
FROM deps AS builder

# Copy source code
COPY . .

# Build the application (compiles TypeScript + Vite frontend)
RUN npm run build

# ============================================
# Stage 4: Production image
# ============================================
FROM node:22-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    bash \
    tini

# Create non-root user for security
RUN addgroup -g 1001 -S mediabox && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G mediabox mediabox

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/build ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create directories for media and downloads with correct permissions
RUN mkdir -p /media/music /media/movies /media/tv /media/books /downloads && \
    chown -R mediabox:mediabox /app /media /downloads

# Switch to non-root user
USER mediabox

# Expose the application port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3333/health || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]

# Default command
CMD ["node", "bin/server.js"]
