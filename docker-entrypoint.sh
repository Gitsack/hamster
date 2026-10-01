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

# GPU access for version encoding. /dev/dri/renderD* belongs to the host's
# render group, whose GID differs between distros; give hamster a group with
# that GID so it can open the device after dropping root. Nothing happens when
# no GPU is passed through, and encodes then run on the CPU.
for DEVICE in /dev/dri/renderD*; do
  [ -e "$DEVICE" ] || continue
  DEVICE_GID=$(stat -c '%g' "$DEVICE")
  DEVICE_GROUP=$(getent group "$DEVICE_GID" | cut -d: -f1)
  if [ -z "$DEVICE_GROUP" ]; then
    DEVICE_GROUP="hostrender$DEVICE_GID"
    groupadd -g "$DEVICE_GID" "$DEVICE_GROUP"
  fi
  usermod -aG "$DEVICE_GROUP" hamster
  echo "GPU $DEVICE available (group $DEVICE_GROUP)"
done

# Fix ownership of app tmp directory only
# Media and download directories are NAS mounts - permissions are managed by the host/NAS
chown -R hamster:hamster /app/tmp

# Backups: only the mount point itself, the host owns what is inside
chown hamster:hamster /backups 2>/dev/null || true

# Handle APP_KEY: use env var if set, otherwise load/generate persisted key
if [ -n "$APP_KEY" ]; then
  echo "Using APP_KEY from environment"
elif [ -f /app/tmp/.app_key ]; then
  export APP_KEY=$(cat /app/tmp/.app_key)
  echo "Using persisted APP_KEY"
else
  export APP_KEY=$(gosu hamster bun -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  echo "$APP_KEY" > /app/tmp/.app_key
  chown hamster:hamster /app/tmp/.app_key
  echo "Generated and persisted new APP_KEY"
fi

# Wait for database to be ready
echo "Checking database connection..."
until gosu hamster bun -e "
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
gosu hamster bun ace migration:run --force
echo "Migrations completed successfully!"

# Execute the main command as hamster user
echo "Starting server..."
exec gosu hamster "$@"
