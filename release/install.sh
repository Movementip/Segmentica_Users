#!/usr/bin/env sh
set -eu

APP_DIR="${SEGMENTICA_HOME:-$HOME/segmentica}"
RELEASE_URL="${SEGMENTICA_RELEASE_URL:-}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Не найдена команда: $1" >&2
    echo "Установите Docker Desktop и повторите запуск." >&2
    exit 1
  fi
}

download_release() {
  if [ -z "$RELEASE_URL" ]; then
    return 0
  fi

  need_cmd curl
  need_cmd unzip

  tmp_zip="$(mktemp -t segmentica-release.XXXXXX.zip)"
  echo "Скачиваю release-пакет..."
  curl -fsSL "$RELEASE_URL" -o "$tmp_zip"

  mkdir -p "$APP_DIR"
  unzip -oq "$tmp_zip" -d "$APP_DIR"
  rm -f "$tmp_zip"
}

wait_for_db() {
  echo "Жду готовность PostgreSQL..."
  i=0
  while [ "$i" -lt 60 ]; do
    if docker compose exec -T db pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Segmentica}" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i + 1))
    sleep 2
  done

  echo "PostgreSQL не успел запуститься." >&2
  exit 1
}

restore_seed_if_present() {
  if [ ! -f "seed/Segmentica.dump" ]; then
    return 0
  fi

  marker=".segmentica-seed-restored"
  if [ -f "$marker" ]; then
    echo "Seed уже был восстановлен, пропускаю pg_restore."
    return 0
  fi

  echo "Восстанавливаю базу из seed/Segmentica.dump..."
  docker compose exec -T db pg_restore \
    -U "${POSTGRES_USER:-postgres}" \
    -d "${POSTGRES_DB:-Segmentica}" \
    --clean \
    --if-exists \
    /seed/Segmentica.dump
  date > "$marker"
}

need_cmd docker

download_release
mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
  else
    echo "Не найден .env.example в $APP_DIR" >&2
    exit 1
  fi
fi

if [ ! -f "docker-compose.yml" ]; then
  echo "Не найден docker-compose.yml в $APP_DIR" >&2
  exit 1
fi

set -a
. ./.env
set +a

echo "Скачиваю Docker images..."
docker compose pull

echo "Запускаю Segmentica..."
docker compose up -d

wait_for_db
restore_seed_if_present

echo
echo "Готово. Откройте: ${NEXTAUTH_URL:-http://localhost:3000}"
