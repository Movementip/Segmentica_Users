#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="$ROOT_DIR/runtime/bin"
RUNTIME_DIR="$ROOT_DIR/runtime"
mkdir -p "$DEST_DIR"

SOURCE="${SEGMENTICA_LIMACTL_PATH:-$(command -v limactl || true)}"
if [ -z "$SOURCE" ]; then
  echo "limactl не найден. Установите Lima или задайте SEGMENTICA_LIMACTL_PATH." >&2
  exit 1
fi

LIMA_PREFIX="${SEGMENTICA_LIMA_PREFIX:-$(brew --prefix lima 2>/dev/null || true)}"
if [ -z "$LIMA_PREFIX" ]; then
  SOURCE_LINK="$(readlink "$SOURCE" 2>/dev/null || true)"
  if [ -n "$SOURCE_LINK" ]; then
    case "$SOURCE_LINK" in
      /*) REAL_SOURCE="$SOURCE_LINK" ;;
      *) REAL_SOURCE="$(cd "$(dirname "$SOURCE")" && cd "$(dirname "$SOURCE_LINK")" && pwd)/$(basename "$SOURCE_LINK")" ;;
    esac
    LIMA_PREFIX="$(cd "$(dirname "$REAL_SOURCE")/.." && pwd)"
  fi
fi

if [ ! -d "$LIMA_PREFIX/share/lima" ]; then
  echo "Не найдены ресурсы Lima: $LIMA_PREFIX/share/lima" >&2
  echo "Задайте SEGMENTICA_LIMA_PREFIX, например /opt/homebrew/opt/lima." >&2
  exit 1
fi

chmod u+w "$DEST_DIR/limactl" 2>/dev/null || true
rm -f "$DEST_DIR/limactl"
cp -L "$SOURCE" "$DEST_DIR/limactl"
chmod +x "$DEST_DIR/limactl"

rm -rf "$RUNTIME_DIR/share/lima"
mkdir -p "$RUNTIME_DIR/share"
cp -R "$LIMA_PREFIX/share/lima" "$RUNTIME_DIR/share/lima"

if [ -d "$LIMA_PREFIX/libexec/lima" ]; then
  rm -rf "$RUNTIME_DIR/libexec/lima"
  mkdir -p "$RUNTIME_DIR/libexec"
  cp -R "$LIMA_PREFIX/libexec/lima" "$RUNTIME_DIR/libexec/lima"
fi

echo "Скопирован limactl: $SOURCE -> $DEST_DIR/limactl"
echo "Скопированы ресурсы Lima: $LIMA_PREFIX/share/lima -> $RUNTIME_DIR/share/lima"
