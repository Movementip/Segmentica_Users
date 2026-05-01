# Segmentica Users

Segmentica Users - локальная система для работы с заявками, пользователями, документами и синхронизацией данных. Репозиторий содержит исходники приложения, Docker/OCI images, release-пакет для Docker Compose и desktop-приложение Segmentica.

## Установка в один клик

### macOS

Скачайте последнюю сборку:

[Скачать Segmentica для macOS](https://github.com/Movementip/Segmentica_Users/releases/latest/download/Segmentica-macOS.dmg)

После установки откройте `Segmentica.app`. Приложение само управляет встроенной виртуальной машиной Lima и контейнерами Segmentica.
В релизный пакет входит seed текущей базы: при первом запуске PostgreSQL volume восстанавливается из `seed/Segmentica.dump`.

### Docker Compose

macOS / Linux:

```sh
SEGMENTICA_RELEASE_URL="https://github.com/Movementip/Segmentica_Users/releases/latest/download/segmentica-release.zip" sh -c "$(curl -fsSL https://github.com/Movementip/Segmentica_Users/releases/latest/download/install.sh)"
```

Windows PowerShell:

```powershell
$env:SEGMENTICA_RELEASE_URL="https://github.com/Movementip/Segmentica_Users/releases/latest/download/segmentica-release.zip"; iwr https://github.com/Movementip/Segmentica_Users/releases/latest/download/install.ps1 -UseBasicParsing | iex
```

После запуска откройте:

```text
http://localhost:3000
```

## Что входит в релиз

- `Segmentica-macOS.dmg` - стабильная ссылка на desktop-приложение для macOS.
- `Segmentica-macOS.zip` - стабильная zip-версия macOS-приложения.
- `Segmentica-Windows-x64.exe` - стабильная ссылка на Windows-установщик, когда сборка доступна.
- `Segmentica-Windows-x64.zip` - стабильная portable zip-версия Windows, когда сборка доступна.
- `Segmentica-...` - versioned-копии тех же desktop-сборок для истории релизов.
- `segmentica-release.zip` - Docker Compose release-пакет.
- `seed/Segmentica.dump` внутри release-пакета - снимок текущей базы для первого восстановления.
- `install.sh` и `install.ps1` - установщики release-пакета.
- GHCR packages:
  - `ghcr.io/movementip/segmentica-backend`
  - `ghcr.io/movementip/segmentica-frontend`
  - `ghcr.io/movementip/segmentica-libreoffice`
  - `ghcr.io/movementip/segmentica-symmetricds`

## macOS: единая среда Segmentica

Desktop-приложение на macOS использует встроенную Lima VM вместо Docker Desktop. Все runtime-данные лежат в папке приложения пользователя:

```text
~/Library/Application Support/Segmentica
```

Основные части:

```text
/Applications/Segmentica.app
~/Library/Application Support/Segmentica/runtime
~/Library/Application Support/Segmentica/lima/segmentica
```

Внутри VM находятся containerd/nerdctl images, containers и volumes. Dockerfile'ы остаются в проекте, потому что Segmentica всё ещё собирается как стандартные OCI/Docker images.

## Документация

- [Установка для пользователей](docs/INSTALL.md)
- [Desktop runtime на Lima](docs/embedded-container-runtime.md)
- [Публикация GitHub Release](docs/GITHUB_RELEASE.md)
- [Docker Compose release](release/README.md)

## Разработка

Установка зависимостей:

```sh
npm --prefix backend install
npm --prefix frontend install
npm --prefix desktop install
```

Локальный запуск:

```sh
npm run dev
```

Сборка Docker images:

```sh
npm run docker:up
```

Подготовка release-пакета:

```sh
npm run release:prepare
```

Сборка macOS desktop:

```sh
npm run desktop:build:mac:bundled
```
