# Segmentica Release

Этот пакет поднимает Segmentica целиком через Docker: PostgreSQL, backend, frontend, рендер документов и SymmetricDS.

## Что нужно пользователю

- Docker Desktop.
- Доступ к registry, где опубликованы images Segmentica.
- Свободный порт `3000` для сайта. При необходимости его можно поменять в `.env`.

## Быстрый запуск из GitHub Release

macOS / Linux:

```sh
SEGMENTICA_RELEASE_URL="https://github.com/Movementip/Segmentica_Users/releases/latest/download/segmentica-release.zip" sh -c "$(curl -fsSL https://github.com/Movementip/Segmentica_Users/releases/latest/download/install.sh)"
```

Windows PowerShell:

```powershell
$env:SEGMENTICA_RELEASE_URL="https://github.com/Movementip/Segmentica_Users/releases/latest/download/segmentica-release.zip"; iwr https://github.com/Movementip/Segmentica_Users/releases/latest/download/install.ps1 -UseBasicParsing | iex
```

Если архив уже скачан и распакован:

```sh
cd segmentica-release
cp .env.example .env
docker compose pull
docker compose up -d
```

После запуска открыть `http://localhost:3000`.

Для “одной ссылки” загрузите рядом три файла из `release/dist`: `segmentica-release.zip`, `install.sh`, `install.ps1`. GitHub Actions workflow делает это автоматически при публикации тега.

## Настройка перед публикацией

В `.env` обязательно заменить:

- `SEGMENTICA_IMAGE_PREFIX` на ваш registry, например `ghcr.io/company`.
- `SEGMENTICA_VERSION` на тег опубликованных images.
- `NEXTAUTH_SECRET` на длинную случайную строку.
- `POSTGRES_PASSWORD`, если пакет ставится не только локально.

## Как подготовить релиз

1. Собрать локальные images:

```sh
npm run docker:up
```

2. Опубликовать images:

```sh
SEGMENTICA_IMAGE_PREFIX=ghcr.io/company SEGMENTICA_VERSION=2026.04.28 npm run release:publish
```

3. Подготовить архив без данных:

```sh
npm run release:prepare
```

4. Подготовить архив с текущим заполнением базы:

```sh
npm run release:export-db
SEGMENTICA_DB_DUMP=release/dist/Segmentica.dump npm run release:prepare
```

5. Подготовить архив с любым другим дампом базы:

```sh
SEGMENTICA_DB_DUMP=backups/postgres/Segmentica.dump npm run release:prepare
```

Готовый файл появится в `release/dist/segmentica-release.zip`.
Там же будут отдельные `install.sh` и `install.ps1`, чтобы их можно было загрузить в GitHub Releases или на любой статический сервер рядом с zip.

## Важное про данные

По умолчанию дамп базы не попадает в архив. Это сделано специально, чтобы случайно не раздать реальные заявки, сотрудников, клиентов, cookie или другие приватные данные. Если нужен пакет “как сейчас у нас”, сначала выполните `npm run release:export-db`, затем пересоберите архив с `SEGMENTICA_DB_DUMP=release/dist/Segmentica.dump`.
