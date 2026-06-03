#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-initiare_erp}"

cd "$APP_DIR"

if [[ ! -f ".env" ]]; then
  echo "Missing .env file in $APP_DIR"
  exit 1
fi

if ! grep -q '^ACTIVE_ACTIONS_HMAC_SECRET=' .env; then
  echo "ACTIVE_ACTIONS_HMAC_SECRET missing in .env, writing safe placeholder"
  printf '\nACTIVE_ACTIONS_HMAC_SECRET=%s\n' \
    'change-this-active-actions-secret-before-production-123456' >> .env
fi

compose() {
  docker compose \
    --project-name "$COMPOSE_PROJECT_NAME" \
    --project-directory "$APP_DIR" \
    --env-file .env \
    -f "$COMPOSE_FILE" \
    "$@"
}

TRAEFIK_NETWORK="$(
  grep -E '^TRAEFIK_NETWORK=' .env 2>/dev/null | tail -n 1 | cut -d '=' -f 2- | tr -d '\r'
)"

docker network inspect "${TRAEFIK_NETWORK:-proxy}" >/dev/null 2>&1 || \
  docker network create "${TRAEFIK_NETWORK:-proxy}"

if [[ -n "${DOCKERHUB_USERNAME:-}" && -n "${DOCKERHUB_TOKEN:-}" ]]; then
  printf '%s' "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin
fi

compose pull web api
compose up -d postgres

postgres_container="$(compose ps -q postgres)"
if [[ -z "$postgres_container" ]]; then
  echo "Failed to resolve postgres container id"
  exit 1
fi

until [[ "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' "$postgres_container")" == "healthy" ]]; do
  sleep 2
done

compose run --rm --no-deps api npx prisma migrate deploy
compose run --rm --no-deps api node dist/prisma/bootstrap.js
compose up -d web api --remove-orphans

docker rm -f "${WORKER_CONTAINER_NAME:-initiare_erp-worker}" >/dev/null 2>&1 || true
