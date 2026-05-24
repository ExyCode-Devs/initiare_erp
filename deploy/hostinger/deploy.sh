#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"

cd "$APP_DIR"

if [[ -f ".env.production" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.production"
  set +a
fi

export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"
export NODE_ENV=production
export PM2_APP_NAME="${PM2_APP_NAME:-axiom-prime}"

npm ci
npm run build
npx --yes pm2 startOrReload ecosystem.config.cjs --update-env
npx --yes pm2 save || true
