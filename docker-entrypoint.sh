#!/bin/bash
set -e

echo "=========================================="
echo "  Mediabox - Starting Application"
echo "=========================================="

# Wait for database to be ready (backup check)
echo "Checking database connection..."
until node -e "
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
node ace migration:run --force

echo "Migrations completed successfully!"

# Execute the main command
echo "Starting server..."
exec "$@"
