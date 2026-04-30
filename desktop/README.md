# Segmentica Desktop

Electron-приложение для запуска Segmentica вместе с локальным окружением
контейнеров.

## Что делает приложение

- Показывает панель окружения перед входом в сайт.
- Управляет встроенной виртуальной машиной Lima для контейнеров Segmentica.
- Распаковывает bundled `segmentica-release.zip` в пользовательскую папку приложения.
- Готовит compose-файлы, images, volumes и сеть контейнеров.
- Запускает и останавливает контейнеры из интерфейса Electron.
- Открывает `http://localhost:3000` во вкладке приложения.
- При закрытии приложения останавливает контейнеры перед выходом.

## Встроенное окружение

Для macOS приложение может поставляться с `limactl` внутри ресурсов Electron.
Это убирает зависимость от `PATH` пользователя и позволяет управлять окружением
из одного приложения.

Важно: сама виртуальная машина Lima всё равно использует системную виртуализацию
macOS. Segmentica задаёт для неё отдельный `LIMA_HOME`, поэтому файлы VM лежат
в пользовательской папке приложения:

```text
~/Library/Application Support/Segmentica/lima
```

Файлы окружения compose/release лежат рядом:

```text
~/Library/Application Support/Segmentica/runtime
```

Физически контейнеры, images и volumes находятся внутри диска виртуальной машины в этой
папке приложения. Внутрь самого `.app` bundle VM-диск не кладётся: bundle может
быть read-only, подписанным и заменяться при обновлении.

Подготовить bundled `limactl`:

```sh
npm --prefix desktop run bundle:lima
```

Если `limactl` лежит не в `PATH`, укажите его явно:

```sh
SEGMENTICA_LIMACTL_PATH=/opt/homebrew/bin/limactl npm --prefix desktop run bundle:lima
```

## Сборка

Перед сборкой обновите release-пакет:

```sh
npm run release:export-db
SEGMENTICA_DB_DUMP=release/dist/Segmentica.dump npm run release:prepare
```

Установите зависимости Electron:

```sh
npm --prefix desktop install
```

Запуск в dev-режиме:

```sh
SEGMENTICA_CONTAINER_RUNTIME=embedded-lima npm --prefix desktop start
```

Сборка macOS с bundled Lima:

```sh
npm --prefix desktop run build:mac:bundled
```

Обычная сборка macOS:

```sh
npm --prefix desktop run build:mac
```

Сборка Windows:

```sh
npm --prefix desktop run build:win
```

Артефакты появятся в `desktop/dist`.
