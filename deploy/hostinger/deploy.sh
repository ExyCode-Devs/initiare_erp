#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

cd "$APP_DIR"

if [[ ! -f ".env" ]]; then
  echo "Missing .env file in $APP_DIR"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ".env"
set +a

docker network inspect "${TRAEFIK_NETWORK:-proxy}" >/dev/null 2>&1 || \
  docker network create "${TRAEFIK_NETWORK:-proxy}"

docker compose --env-file .env -f "$COMPOSE_FILE" up -d --build --remove-orphans
