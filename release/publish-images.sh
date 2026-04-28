#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

IMAGE_PREFIX="${SEGMENTICA_IMAGE_PREFIX:-}"
IMAGE_VERSION="${SEGMENTICA_VERSION:-}"
BUILD_IMAGES="${BUILD_IMAGES:-0}"
PUSH_LATEST="${PUSH_LATEST:-0}"

if [ -z "$IMAGE_PREFIX" ]; then
  echo "Укажите SEGMENTICA_IMAGE_PREFIX, например:" >&2
  echo "  SEGMENTICA_IMAGE_PREFIX=ghcr.io/company SEGMENTICA_VERSION=2026.04.28 sh release/publish-images.sh" >&2
  exit 1
fi

if [ -z "$IMAGE_VERSION" ]; then
  IMAGE_VERSION="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
fi

IMAGE_PREFIX="${IMAGE_PREFIX%/}"

if [ "$BUILD_IMAGES" = "1" ]; then
  echo "Собираю локальные Docker images..."
  (cd "$ROOT_DIR" && npm run build:frontend:docker)
  (cd "$ROOT_DIR" && docker compose build backend frontend libreoffice symmetricds)
fi

publish_image() {
  local_name="$1"
  remote_name="$2"
  target="$IMAGE_PREFIX/$remote_name:$IMAGE_VERSION"

  if ! docker image inspect "$local_name" >/dev/null 2>&1; then
    echo "Не найден локальный image $local_name." >&2
    echo "Запустите с BUILD_IMAGES=1 или сначала выполните npm run docker:up." >&2
    exit 1
  fi

  echo "Публикую $local_name -> $target"
  docker tag "$local_name" "$target"
  docker push "$target"

  if [ "$PUSH_LATEST" = "1" ]; then
    latest="$IMAGE_PREFIX/$remote_name:latest"
    docker tag "$local_name" "$latest"
    docker push "$latest"
  fi
}

publish_image "segmentica-backend:local" "segmentica-backend"
publish_image "segmentica-frontend:local" "segmentica-frontend"
publish_image "segmentica-libreoffice:local" "segmentica-libreoffice"
publish_image "segmentica-symmetricds:local" "segmentica-symmetricds"

echo
echo "Images опубликованы."
echo "SEGMENTICA_IMAGE_PREFIX=$IMAGE_PREFIX"
echo "SEGMENTICA_VERSION=$IMAGE_VERSION"
