#!/usr/bin/env bash
set -euo pipefail

source ~/.bashrc 2>/dev/null || true
source ~/.profile 2>/dev/null || true

: "${APP_DIR:?APP_DIR environment variable is required}"
BRANCH="main"
PM2_NAME="camera-stream"

cd "$APP_DIR"

exec 9>/tmp/app_update.lock
flock -n 9 || { echo "$(date '+%Y-%m-%d %H:%M:%S') - Update already in progress, skipping"; exit 0; }

echo "$(date '+%Y-%m-%d %H:%M:%S') - Checking for updates..."

git fetch origin "$BRANCH" --quiet

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') - Update found! Updating from $LOCAL to $REMOTE"
  
  cp .env .env.backup 2>/dev/null || true
  
  git reset --hard "origin/$BRANCH"

  cp .env.backup .env 2>/dev/null || true
  
  if ! npm ci --omit=dev 2>&1; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Error: npm ci failed, aborting update"
    exit 1
  fi

  pm2 restart "$PM2_NAME"
  pm2 save
  
  echo "$(date '+%Y-%m-%d %H:%M:%S') - Update completed successfully!"
else
  echo "$(date '+%Y-%m-%d %H:%M:%S') - No updates available"
fi