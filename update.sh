#!/usr/bin/env bash
set -euo pipefail

: "${APP_DIR:?APP_DIR environment variable is required}"
BRANCH="main"
PM2_NAME="camera-stream"

cd "$APP_DIR"

exec 9>/tmp/app_update.lock
flock -n 9 || { echo "Update already in progress, skipping"; exit 0; }

git fetch origin "$BRANCH" --quiet

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL" != "$REMOTE" ]; then
  cp .env .env.backup 2>/dev/null || true
  
  git reset --hard "origin/$BRANCH"

  cp .env.backup .env 2>/dev/null || true
  
  if ! npm ci --omit=dev >/dev/null 2>&1; then
    echo "Error: npm ci failed, aborting update"
    exit 1
  fi

  pm2 restart "$PM2_NAME"
  pm2 save
fi