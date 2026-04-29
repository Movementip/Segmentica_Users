# Segmentica Desktop

Electron-обёртка для запуска Segmentica как desktop-приложения.

## Что делает приложение

- Проверяет наличие Docker и Docker Compose.
- Пытается запустить Docker Desktop, если daemon не активен.
- Распаковывает bundled `segmentica-release.zip` в пользовательскую папку приложения.
- Проверяет нужные Docker images и скачивает отсутствующие.
- Запускает `docker compose up -d`.
- При первом запуске восстанавливает заполненную базу из `seed/Segmentica.dump`.
- Открывает `http://localhost:3000` внутри окна приложения.
- При закрытии приложения выполняет `docker compose down --remove-orphans`, не удаляя volume с базой.

## Ограничение Docker

На macOS и Windows Docker нельзя корректно встроить внутрь Electron-приложения как обычную библиотеку. Нужен Docker Desktop или совместимый Docker daemon, потому что он использует системную виртуализацию и требует пользовательской установки.

Если Docker Desktop не установлен, приложение откроет страницу скачивания Docker Desktop.

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
npm --prefix desktop start
```

Сборка под macOS:

```sh
npm --prefix desktop run build:mac
```

Сборка под Windows:

```sh
npm --prefix desktop run build:win
```

Артефакты появятся в `desktop/dist`.
