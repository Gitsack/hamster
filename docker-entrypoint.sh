#!/bin/sh
set -e

echo "=========================================="
echo "  Hamster - Starting Application"
echo "=========================================="

# Default PUID/PGID to 1000 (common default for Linux users)
PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Starting with UID: $PUID, GID: $PGID"

# Modify hamster group GID if different from current
CURRENT_GID=$(id -g hamster)
if [ "$PGID" != "$CURRENT_GID" ]; then
  echo "Changing hamster group GID from $CURRENT_GID to $PGID"
  groupmod -o -g "$PGID" hamster
fi

# Modify hamster user UID if different from current
CURRENT_UID=$(id -u hamster)
if [ "$PUID" != "$CURRENT_UID" ]; then
  echo "Changing hamster user UID from $CURRENT_UID to $PUID"
  usermod -o -u "$PUID" hamster
fi

# Fix ownership of writable directories only (skip node_modules/build for speed)
chown -R hamster:hamster /app/tmp /media /downloads

# Handle APP_KEY: use env var if set, otherwise load/generate persisted key
if [ -n "$APP_KEY" ]; then
  echo "Using APP_KEY from environment"
elif [ -f /app/tmp/.app_key ]; then
  export APP_KEY=$(cat /app/tmp/.app_key)
  echo "Using persisted APP_KEY"
else
  export APP_KEY=$(su-exec hamster bun -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  echo "$APP_KEY" > /app/tmp/.app_key
  chown hamster:hamster /app/tmp/.app_key
  echo "Generated and persisted new APP_KEY"
fi

# Wait for database to be ready
echo "Checking database connection..."
until su-exec hamster bun -e "
  const { Client } = require('pg');
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  client.connect()
    .then(() => { client.end(); process.exit(0); })
    .catch(() => process.exit(1));
" 2>/dev/null; do
  echo "Waiting for database..."
  sleep 2
done
echo "Database is ready!"

# Run database migrations
echo "Running database migrations..."
su-exec hamster bun ace migration:run --force
echo "Migrations completed successfully!"

# Execute the main command as hamster user
echo "Starting server..."
exec su-exec hamster "$@"
