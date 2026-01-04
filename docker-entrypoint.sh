#!/bin/bash
set -e

echo "=========================================="
echo "  Hamster - Starting Application"
echo "=========================================="

# Handle APP_KEY: use env var if set, otherwise load/generate persisted key
if [ -n "$APP_KEY" ]; then
  echo "Using APP_KEY from environment"
elif [ -f /app/tmp/.app_key ]; then
  export APP_KEY=$(cat /app/tmp/.app_key)
  echo "Using persisted APP_KEY"
else
  export APP_KEY=$(bun -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  mkdir -p /app/tmp
  echo "$APP_KEY" > /app/tmp/.app_key
  echo "Generated and persisted new APP_KEY"
fi

# Wait for database to be ready (backup check)
echo "Checking database connection..."
until bun -e "
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
bun ace migration:run --force

echo "Migrations completed successfully!"

# Execute the main command
echo "Starting server..."
exec "$@"
