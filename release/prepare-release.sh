#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/release/dist"
WORK_DIR="$DIST_DIR/segmentica-release"
ZIP_PATH="$DIST_DIR/segmentica-release.zip"
DB_DUMP="${SEGMENTICA_DB_DUMP:-}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Не найдена команда: $1" >&2
    exit 1
  fi
}

need_cmd mkdir
need_cmd cp
need_cmd rm

rm -rf "$WORK_DIR" "$ZIP_PATH"
mkdir -p "$WORK_DIR/db/init" "$WORK_DIR/db/schema" "$WORK_DIR/seed"

cp "$ROOT_DIR/release/docker-compose.yml" "$WORK_DIR/docker-compose.yml"
cp "$ROOT_DIR/release/.env.example" "$WORK_DIR/.env.example"
cp "$ROOT_DIR/release/install.sh" "$WORK_DIR/install.sh"
cp "$ROOT_DIR/release/install.ps1" "$WORK_DIR/install.ps1"
cp "$ROOT_DIR/release/README.md" "$WORK_DIR/README.md"
cp "$ROOT_DIR/infra/db/init/"* "$WORK_DIR/db/init/"
cp "$ROOT_DIR/infra/db/schema/"* "$WORK_DIR/db/schema/"

if [ -n "$DB_DUMP" ]; then
  if [ ! -f "$DB_DUMP" ]; then
    echo "SEGMENTICA_DB_DUMP задан, но файл не найден: $DB_DUMP" >&2
    exit 1
  fi
  cp "$DB_DUMP" "$WORK_DIR/seed/Segmentica.dump"
else
  touch "$WORK_DIR/seed/.gitkeep"
fi

chmod +x "$WORK_DIR/install.sh"
cp "$WORK_DIR/install.sh" "$DIST_DIR/install.sh"
cp "$WORK_DIR/install.ps1" "$DIST_DIR/install.ps1"
chmod +x "$DIST_DIR/install.sh"

(
  cd "$WORK_DIR"
  if command -v zip >/dev/null 2>&1; then
    zip -qr "$ZIP_PATH" .
  else
    ditto -c -k --sequesterRsrc . "$ZIP_PATH"
  fi
)

echo "Release-пакет готов: $ZIP_PATH"
echo "Отдельные установщики: $DIST_DIR/install.sh и $DIST_DIR/install.ps1"
if [ -z "$DB_DUMP" ]; then
  echo "Дамп базы не включён. Для включения используйте SEGMENTICA_DB_DUMP=/path/to/Segmentica.dump."
fi
