# Embedded Container Runtime для Segmentica

Цель: дать пользователю один `Segmentica.app`, который может запускать локальную серверную часть без ручного Docker Desktop. Текущий Docker Desktop runtime остается рабочим fallback-режимом до конца миграции.

## Выбранный путь

Базовый вариант для macOS:

- Lima как управляемая Linux VM;
- containerd внутри VM;
- nerdctl как Docker-compatible CLI;
- `nerdctl compose` вместо `docker compose`;
- отдельная Lima-инстанция `segmentica`;
- отдельный `LIMA_HOME` внутри `app.getPath("userData")/lima`;
- runtime-файлы Segmentica остаются в `app.getPath("userData")/runtime`.

Почему не Colima первым шагом:

- Colima удобен как пользовательская утилита, но добавляет еще один управляющий слой;
- Segmentica проще контролировать через `limactl`;
- Lima официально поддерживает file sharing, port forwarding и containerd/nerdctl.

## Runtime-режимы

### `docker-desktop`

Текущий режим.

- Проверка: `docker --version`, `docker compose version`, `docker info`.
- Запуск: `open -ga Docker`.
- Compose: `docker compose -f runtime/docker-compose.yml --env-file runtime/.env ...`.
- Остановка: `docker compose down --remove-orphans` или `docker stop ...` для найденных контейнеров.

### `embedded-lima`

Новый экспериментальный режим.

- Проверка host tool: `limactl --version`.
- Инстанция: `segmentica`.
- Lima home: `~/Library/Application Support/Segmentica/lima`.
- Диск VM и данные containerd/nerdctl физически лежат внутри пользовательской папки приложения.
- Создание VM: Lima template с включенным system containerd.
- Проверка VM: `limactl list segmentica`.
- Compose: `limactl shell segmentica sudo nerdctl compose -f <runtime/docker-compose.yml> --env-file <runtime/.env> ...`.
- Проверка app: тот же `http://localhost:3000`.
- Остановка: `limactl shell segmentica sudo nerdctl compose ... down --remove-orphans`.

## Этапы

### Этап 1. Runtime abstraction

Срок: 1-2 дня.

Статус: начат. В Electron добавлен скрытый переключатель `SEGMENTICA_CONTAINER_RUNTIME=embedded-lima`; дефолтный режим остается `docker-desktop`.

Задача:

- вынести текущие Docker-команды из `desktop/src/main.js` за интерфейс runtime provider;
- оставить `docker-desktop` дефолтом;
- добавить скрытый env-флаг `SEGMENTICA_CONTAINER_RUNTIME=embedded-lima`;
- не менять пользовательское поведение по умолчанию.

Готово, когда:

- `npm run desktop:start` работает как раньше;
- все Docker Desktop команды идут через provider;
- Electron UI показывает понятные статусы runtime.

### Этап 2. Lima preflight

Срок: 2-4 дня.

Статус: начат. Electron уже проверяет `limactl`, создает/стартует инстанцию `segmentica` с `--containerd=system` и проверяет `nerdctl`.

Добавлен runtime YAML: Electron генерирует `segmentica-lima.yaml` в runtime-директории Segmentica. В нем зафиксированы:

- Ubuntu base image через Lima templates;
- system `containerd`;
- writable mount runtime-директории Segmentica в тот же путь внутри VM;
- port forwards для `3000`, `3001`, `3010`, `31415`, `5439`.

Задача:

- проверять наличие `limactl`;
- показывать экран установки/диагностики, если Lima не найден;
- создать/запустить инстанцию `segmentica`;
- проверить внутри VM наличие `nerdctl` и containerd.

Готово, когда:

- `SEGMENTICA_CONTAINER_RUNTIME=embedded-lima npm run desktop:start` доходит до готовой VM;
- ошибки не падают в консоль, а показываются в стартовом окне.

### Этап 3. Compose через nerdctl

Срок: 3-7 дней.

Задача:

- запустить `release/docker-compose.yml` через `nerdctl compose`;
- проверить порты `3000`, `3001`, `3010`, `31415`, `5439`;
- проверить volumes Postgres и SymmetricDS;
- проверить загрузку images из registry.

Готово, когда:

- Segmentica открывается внутри Electron без Docker Desktop;
- PDF/LibreOffice preview работает;
- база сохраняется после перезапуска приложения.

### Этап 4. Packaging

Срок: 1-2 недели.

Задача:

- решить, поставляем ли `limactl` внутри `.app` или просим установить Lima один раз;
- добавить installer/repair flow;
- добавить logs/export diagnostics;
- проверить Apple Silicon и Intel;
- подготовить подпись/notarization сценарий.

Готово, когда:

- чистая машина может запустить Segmentica по инструкции без ручного терминала;
- есть понятные ошибки для отсутствующей virtualization/support tools/network.

## Риски

- `nerdctl compose` совместим не со всеми возможностями Docker Compose;
- named volumes и bind mounts должны быть проверены отдельно;
- macOS file sharing в VM может отличаться по производительности;
- bundled `limactl` усложнит подпись и обновления;
- первый запуск будет дольше Docker Desktop из-за создания VM и загрузки images.

## Первое решение

Пока дефолтом остается Docker Desktop. `embedded-lima` включается только явным флагом:

```bash
SEGMENTICA_CONTAINER_RUNTIME=embedded-lima npm run desktop:start
```

После стабильного прохождения этапов 1-3 можно будет сделать embedded runtime дефолтом для macOS.
