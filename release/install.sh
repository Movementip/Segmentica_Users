#!/usr/bin/env sh
set -eu

APP_DIR="${SEGMENTICA_HOME:-$HOME/segmentica}"
RELEASE_URL="${SEGMENTICA_RELEASE_URL:-}"
IMAGES_ARCHIVE="segmentica-images.tar.gz"
IMAGES_MANIFEST="segmentica-images.sha256"

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

resolve_images_url() {
  if [ -n "${SEGMENTICA_IMAGES_URL:-}" ]; then
    printf '%s\n' "$SEGMENTICA_IMAGES_URL"
    return 0
  fi

  if [ -n "$RELEASE_URL" ]; then
    case "$RELEASE_URL" in
      */segmentica-release.zip)
        printf '%s\n' "$RELEASE_URL" | sed 's#/segmentica-release\.zip$#/segmentica-images.tar.gz#'
        ;;
    esac
  fi
}

resolve_images_base_url() {
  if [ -n "${SEGMENTICA_IMAGES_BASE_URL:-}" ]; then
    printf '%s\n' "$SEGMENTICA_IMAGES_BASE_URL"
    return 0
  fi

  if [ -n "$RELEASE_URL" ]; then
    case "$RELEASE_URL" in
      */segmentica-release.zip)
        printf '%s\n' "$RELEASE_URL" | sed 's#/segmentica-release\.zip$##'
        ;;
    esac
  fi
}

download_images_archive() {
  if [ -f "$IMAGES_ARCHIVE" ]; then
    return 0
  fi

  images_url="$(resolve_images_url)"
  if [ -n "$images_url" ]; then
    need_cmd curl
    echo "Скачиваю архив container images..."
    if curl -fsSL "$images_url" -o "$IMAGES_ARCHIVE"; then
      return 0
    fi

    rm -f "$IMAGES_ARCHIVE"
    echo "Единый архив images недоступен, попробую скачать части архива." >&2
  fi

  images_base_url="$(resolve_images_base_url)"
  if [ -z "$images_base_url" ]; then
    return 0
  fi

  need_cmd curl
  echo "Скачиваю список частей архива images..."
  if ! curl -fsSL "$images_base_url/$IMAGES_MANIFEST" -o "$IMAGES_MANIFEST"; then
    rm -f "$IMAGES_MANIFEST"
    echo "Список частей images недоступен, попробую загрузить images из registry." >&2
    return 0
  fi

  parts="$(awk '{print $2}' "$IMAGES_MANIFEST")"
  if [ -z "$parts" ]; then
    rm -f "$IMAGES_MANIFEST"
    echo "Список частей images пустой, попробую загрузить images из registry." >&2
    return 0
  fi

  for part in $parts; do
    echo "Скачиваю $part..."
    curl -fsSL "$images_base_url/$part" -o "$part"
  done

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 -c "$IMAGES_MANIFEST"
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c "$IMAGES_MANIFEST"
  else
    echo "Команда проверки sha256 не найдена, собираю архив без проверки." >&2
  fi

  tmp_archive="$IMAGES_ARCHIVE.tmp"
  rm -f "$tmp_archive"
  for part in $parts; do
    cat "$part" >> "$tmp_archive"
    rm -f "$part"
  done
  mv "$tmp_archive" "$IMAGES_ARCHIVE"
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

load_images_if_present() {
  if [ ! -f "$IMAGES_ARCHIVE" ]; then
    return 1
  fi

  echo "Загружаю container images из $IMAGES_ARCHIVE..."
  docker load -i "$IMAGES_ARCHIVE"
  return 0
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

download_images_archive

if ! load_images_if_present; then
  echo "Скачиваю Docker images..."
  docker compose pull
fi

echo "Запускаю Segmentica..."
docker compose up -d

wait_for_db
restore_seed_if_present

echo
echo "Готово. Откройте: ${NEXTAUTH_URL:-http://localhost:3000}"
