# Публикация GitHub Release

Цель релиза: пользователь открывает GitHub Release, скачивает desktop-приложение или запускает одну команду установки Docker Compose.

## Что публикуется

GitHub Release должен содержать:

- `Segmentica-<version>-mac-arm64.dmg`
- `Segmentica-<version>-mac-arm64.zip`
- `Segmentica-<version>-win-x64.exe`
- `Segmentica-<version>-win-x64.zip`
- `Segmentica-macOS.dmg`
- `Segmentica-macOS.zip`
- `Segmentica-Windows-x64.exe`
- `Segmentica-Windows-x64.zip`
- `segmentica-release.zip`
- `install.sh`
- `install.ps1`

GitHub Packages / GHCR должен содержать:

- `ghcr.io/movementip/segmentica-backend:<version>`
- `ghcr.io/movementip/segmentica-frontend:<version>`
- `ghcr.io/movementip/segmentica-libreoffice:<version>`
- `ghcr.io/movementip/segmentica-symmetricds:<version>`

## Автоматическая публикация

1. Убедитесь, что в репозитории включены permissions для GitHub Actions:
   - `Contents: Read and write`
   - `Packages: Read and write`
2. Создайте тег версии:

```sh
git tag v2026.04.28
git push origin v2026.04.28
```

3. Workflow `.github/workflows/release.yml`:
   - собирает и публикует Docker/OCI images в GHCR;
   - собирает `segmentica-release.zip`;
   - собирает macOS desktop DMG/ZIP;
   - собирает Windows installer/ZIP;
   - создаёт GitHub Release и прикладывает assets.

## Ручная подготовка release-пакета

```sh
npm run release:prepare
```

С дампом текущей базы:

```sh
npm run release:export-db
SEGMENTICA_DB_DUMP=release/dist/Segmentica.dump npm run release:prepare
```

## Ручная публикация images

```sh
SEGMENTICA_IMAGE_PREFIX=ghcr.io/movementip \
SEGMENTICA_VERSION=2026.04.28 \
BUILD_IMAGES=1 \
PUSH_LATEST=1 \
npm run release:publish
```

Перед публикацией выполните login:

```sh
echo "$GITHUB_TOKEN" | docker login ghcr.io -u Movementip --password-stdin
```

## Desktop-сборки

macOS:

```sh
npm --prefix desktop install
npm --prefix desktop run build:mac:bundled
```

Windows:

```sh
npm --prefix desktop install
npm --prefix desktop run build:win
```

На macOS Windows-сборка требует скачать Windows runtime Electron. Если DNS или GitHub недоступны, сборка упадёт до создания `.exe`.

## Почему Dockerfile'ы остаются

macOS desktop использует Lima вместо Docker Desktop, но приложение всё равно работает со стандартными OCI/Docker images. Dockerfile'ы нужны для:

- сборки backend/frontend/libreoffice/symmetricds images;
- публикации GHCR packages;
- Docker Compose варианта установки;
- GitHub Actions release pipeline.
