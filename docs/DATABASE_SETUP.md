# База данных Segmentica CRM

Проект рассчитан на локальный PostgreSQL в Docker. Backend по умолчанию работает с локальной базой `db:5432`, а удалённая Windows-БД подключается отдельно через Tailscale.

## Fresh start

При первом запуске нового volume контейнер `segmentica-postgres` автоматически применяет init-файлы:

- `infra/db/init/001-prepare-business-schema.sql` — готовит роль `symuser` и чистую `public`-схему;
- `infra/db/init/010-load-business-schema.sh` — загружает бизнес-схему из `infra/db/schema/Segmentica-public-business-schema.sql`;
- `infra/db/init/020-core-extensions.sql` — включает `pgcrypto` для авторизации.
- `infra/db/init/030-imported-requests.sql` — добавляет таблицу `imported_requests` для заявок, импортированных из Bitrix.

Важно: Docker применяет `/docker-entrypoint-initdb.d` только на пустом volume. Если volume `segmentica-postgres-data` уже создан, эти файлы повторно не выполнятся.

## Основной запуск

```bash
npm run docker:up
```

Скрипт сначала собирает frontend локально, затем поднимает compose-стек. Это нужно, потому что production-образ frontend использует `frontend/.next/standalone`.

Если нужен только инфраструктурный слой без пересборки frontend/backend:

```bash
npm run docker:infra
```

## Адреса

- `postgresql://postgres:postgres@localhost:5439/Segmentica` — доступ с хоста;
- `postgresql://postgres:postgres@db:5432/Segmentica` — доступ внутри compose;
- `postgresql://postgres:postgres@<tailscale-ip>:5432/Segmentica` — доступ к базе другой машины через Tailscale-прокси.

## Проверки

Проверить, что база поднялась:

```bash
docker compose ps db
docker logs segmentica-postgres
```

Проверить `pgcrypto`:

```bash
docker exec segmentica-postgres psql -U postgres -d Segmentica -c "select extname from pg_extension where extname = 'pgcrypto';"
```

Проверить наличие бизнес-таблиц:

```bash
docker exec segmentica-postgres psql -U postgres -d Segmentica -c "\dt"
```

## Существующий volume

Если база уже создана, init-скрипты не перезаписывают данные. Для обновления существующей базы нужно применять миграции/SQL вручную или делать восстановление из backup осознанно.

Не удаляй volume `segmentica-postgres-data`, если нужно сохранить локальные данные.
