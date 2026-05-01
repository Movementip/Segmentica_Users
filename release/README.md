# Segmentica Release

Этот пакет поднимает Segmentica целиком через Docker: PostgreSQL, backend, frontend, рендер документов и SymmetricDS. Если рядом или в GitHub Release есть части `segmentica-images.tar.gz.part-*`, установщик сначала соберёт архив образов из них. Если внутри архива есть `seed/Segmentica.dump`, база восстанавливается из него при первом запуске.

## Что нужно пользователю

- Docker Desktop.
- Доступ к GitHub Release assets `segmentica-images.sha256` и `segmentica-images.tar.gz.part-*` или к registry, где опубликованы images Segmentica.
- Свободный порт `3000` для сайта. При необходимости его можно поменять в `.env`.
- Для репликации между двумя машинами: reusable auth key Tailscale и заполненные `TS_AUTHKEY`, `TS_HOSTNAME`, `TAILSCALE_WINDOWS_IP` в `.env`.

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

Для “одной ссылки” загрузите рядом `segmentica-release.zip`, `segmentica-images.sha256`, части `segmentica-images.tar.gz.part-*`, `install.sh`, `install.ps1`. GitHub Actions workflow делает это автоматически при публикации тега.

## Tailscale и удалённая база

Release-пакет поднимает отдельный контейнер `segmentica-tailscale`. Backend, SymmetricDS и PostgreSQL-proxy работают в его сетевом пространстве, поэтому удалённый узел должен видеть:

- `100.x.y.z:5432` — PostgreSQL через `segmentica-db-tailscale-proxy`;
- `100.x.y.z:31415` — SymmetricDS.

На Mac-узле оставьте `SYMMETRIC_ENGINE_NAME=node-mac` и укажите `TAILSCALE_WINDOWS_IP=<ip Windows-узла>`.
На Windows-узле задайте `SYMMETRIC_ENGINE_NAME=node-win`, `TS_HOSTNAME=segmentica-win` и, если Windows должен регистрироваться через Mac, `TAILSCALE_MAC_IP=<ip Mac-узла>`.

Если в приложении удалённая БД недоступна, проверьте с другой машины:

```sh
docker exec segmentica-backend node -e "const net=require('net'); const host=process.env.TAILSCALE_WINDOWS_IP; for (const port of [5432,31415]) { const s=net.createConnection({host,port,timeout:5000},()=>{console.log('open',host,port); s.end();}); s.on('error',e=>console.log('error',host,port,e.code)); s.on('timeout',()=>console.log('timeout',host,port)); } setTimeout(()=>{},6000)"
```

`ECONNREFUSED` означает, что Tailscale-узел найден, но на удалённой стороне не слушает нужный сервис: не запущен `segmentica-db-tailscale-proxy`/`segmentica-symmetricds`, контейнер Tailscale не авторизован, или порт закрыт локальным firewall.

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

Текущий release может включать `seed/Segmentica.dump`. Тогда при первой установке PostgreSQL volume будет восстановлен из этого снимка, и пользователь получит состояние базы на момент сборки релиза.

Если нужен новый пакет “как сейчас у нас”, сначала выполните `npm run release:export-db` или снимите дамп из встроенной Lima-среды, затем пересоберите архив с `SEGMENTICA_DB_DUMP=/path/to/Segmentica.dump npm run release:prepare`. Если файл лежит в `release/seed/Segmentica.dump`, `release:prepare` включит его автоматически.
