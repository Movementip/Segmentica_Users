# Полный запуск проекта в Docker

В этом репозитории полный стек поднимается сервисами:

- `db` — локальный PostgreSQL в Docker
- `libreoffice` — рендер документов
- `tailscale` — сетевой контейнер для выхода в tailnet
- `backend` — backend-приложение, работает в сети контейнера `tailscale`
- `symmetricds` — репликация, тоже работает в сети контейнера `tailscale`
- `frontend` — внешний web-интерфейс на `http://localhost:3000`

## Что важно по сети

- `backend` и `symmetricds` ходят наружу через `tailscale`
- внутри compose локальная база доступна как `db:5432`
- `backend` ходит к рендереру документов по адресу `http://libreoffice:3000`
- `frontend` ходит к backend по адресу `http://tailscale:3001`
- с хоста доступны:
  - `http://localhost:3000` — frontend
  - `http://localhost:3001` — backend
  - `http://localhost:3010` — libreoffice renderer
  - `localhost:5439` — PostgreSQL
  - `http://localhost:31415` — SymmetricDS

## Что нужно заполнить в `.env.local`

Обязательные значения:

- `TS_AUTHKEY` — auth key для контейнера Tailscale
- `TAILSCALE_WINDOWS_IP` — Tailscale IP Windows-машины

Обычно достаточно таких значений:

```env
LOCAL_DATABASE_URL="postgresql://postgres:postgres@localhost:5439/Segmentica"
DATABASE_URL="postgresql://postgres:postgres@localhost:5439/Segmentica"
DB_HOST=localhost
DB_PORT=5439
DB_NAME=Segmentica
DB_USER=postgres
DB_PASSWORD=postgres

NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000

DOCUMENT_RENDERER_URL=http://localhost:3010
GOTENBERG_URL=

SYMMETRIC_ENGINE_NAME=node-mac
SYMMETRIC_HTTP_PORT=31415
SYMMETRIC_DB_URL=jdbc:postgresql://host.docker.internal:5439/Segmentica
SYMMETRIC_DB_USER=postgres
SYMMETRIC_DB_PASSWORD=postgres

TS_AUTHKEY=tskey-auth-REPLACE_ME
TS_HOSTNAME=segmentica-mac
TAILSCALE_WINDOWS_IP=100.x.y.z
```

Дополнительно, если удалённый PostgreSQL на Windows не слушает стандартный `5432`, лучше задать явно:

```env
REMOTE_DATABASE_URL="postgresql://postgres:postgres@100.x.y.z:5432/Segmentica"
```

Важно: `100.x.y.z` в этой схеме — это IP контейнера `segmentica-tailscale`, а не обычный Windows-host. Поэтому порт PostgreSQL должен слушаться внутри network namespace Tailscale-контейнера. За это отвечает сервис `db-tailscale-proxy`: он слушает `0.0.0.0:5432` рядом с Tailscale и пересылает трафик в локальный контейнер `db:5432`.

Быстрая проверка с другой машины:

```bash
docker exec segmentica-backend node -e "const net=require('net'); const s=net.createConnection({host:process.env.TAILSCALE_WINDOWS_IP,port:5432,timeout:5000},()=>{console.log('open'); s.end();}); s.on('error',e=>console.log(e.code)); s.on('timeout',()=>console.log('timeout'));"
```

## PostgreSQL SSL

Локальная база внутри Docker работает по внутренней сети `db:5432`, поэтому PostgreSQL SSL для неё по умолчанию выключен.

Для удалённой базы логика такая:

- если адрес удалённой БД находится в Tailscale-сети `100.64.0.0/10` или `*.ts.net`, транспорт уже шифруется WireGuard-туннелем Tailscale;
- если удалённая БД находится вне Tailscale, backend по умолчанию включает PostgreSQL SSL;
- если нужно принудительно включить PostgreSQL SSL, задай `REMOTE_DB_SSL=true` или добавь `?sslmode=require` в `REMOTE_DATABASE_URL`;
- если удалённый PostgreSQL не поддерживает SSL, но соединение идёт через Tailscale, задай `REMOTE_DB_SSL=false` или `?sslmode=disable`.

## Что настраивается автоматически

- `SymmetricDS` сам соберёт `sync.url` по IP интерфейса `tailscale0`, если не задан `SYMMETRIC_PUBLIC_URL`
- `SymmetricDS` сам соберёт `registration.url` из `TAILSCALE_WINDOWS_IP`, если не задан `SYMMETRIC_REGISTRATION_URL`
- backend сам использует локальную Docker-базу как `db:5432`

## Команда запуска

```bash
docker compose up -d --build
```

## Полезная проверка после запуска

```bash
docker compose ps
docker logs segmentica-tailscale
docker logs segmentica-backend
docker logs segmentica-symmetricds
```

Если backend не может подключиться к удалённой базе, в первую очередь проверь:

- что `tailscale` контейнер действительно вошёл в сеть
- что `TAILSCALE_WINDOWS_IP` актуален
- что PostgreSQL на Windows слушает нужный порт
- что при необходимости задан `REMOTE_DATABASE_URL`
