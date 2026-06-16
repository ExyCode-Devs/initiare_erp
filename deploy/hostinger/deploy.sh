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

upsert_env_var() {
  local key="$1"
  local value="$2"

  [[ -n "$value" ]] || return 0

  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

upsert_env_var "WEB_IMAGE" "${WEB_IMAGE:-}"
upsert_env_var "API_IMAGE" "${API_IMAGE:-}"
upsert_env_var "IMAGE_TAG" "${IMAGE_TAG:-}"

compose() {
  docker compose \
    --project-name "$COMPOSE_PROJECT_NAME" \
    --project-directory "$APP_DIR" \
    --env-file .env \
    -f "$COMPOSE_FILE" \
    "$@"
}

run_with_timeout() {
  local seconds="$1"
  shift

  if command -v timeout >/dev/null 2>&1; then
    timeout "$seconds" "$@"
    return $?
  fi

  "$@"
}

pull_service_image() {
  local service="$1"
  local max_attempts="${2:-3}"
  local pull_timeout="${3:-900s}"
  local attempt=1

  while (( attempt <= max_attempts )); do
    echo "Pulling ${service} image, attempt ${attempt}/${max_attempts}"

    if run_with_timeout "$pull_timeout" compose pull "$service"; then
      echo "Pulled ${service} image successfully"
      return 0
    fi

    if (( attempt == max_attempts )); then
      echo "Failed to pull ${service} image after ${max_attempts} attempts"
      return 1
    fi

    echo "Pull ${service} failed, waiting 20s before retry"
    sleep 20
    ((attempt++))
  done
}

TRAEFIK_NETWORK="$(
  grep -E '^TRAEFIK_NETWORK=' .env 2>/dev/null | tail -n 1 | cut -d '=' -f 2- | tr -d '\r'
)"

docker network inspect "${TRAEFIK_NETWORK:-proxy}" >/dev/null 2>&1 || \
  docker network create "${TRAEFIK_NETWORK:-proxy}"

if [[ -n "${DOCKERHUB_USERNAME:-}" && -n "${DOCKERHUB_TOKEN:-}" ]]; then
  printf '%s' "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin
fi

pull_service_image api
pull_service_image web
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
