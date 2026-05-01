# Установка Segmentica

Этот документ для пользователя, которому нужно установить Segmentica без ручной настройки проекта.

## Вариант 1. Desktop-приложение macOS

1. Откройте страницу релиза:
   <https://github.com/Movementip/Segmentica_Users/releases/latest>
2. Скачайте `Segmentica-macOS.dmg`.
3. Откройте DMG и перенесите `Segmentica.app` в `Applications`.
4. Запустите `Segmentica.app`.
5. Нажмите `Запустить`.

Приложение само создаёт и обслуживает локальное окружение:

```text
~/Library/Application Support/Segmentica/runtime
~/Library/Application Support/Segmentica/lima/segmentica
```

Если раньше использовалась старая среда `~/.lima/segmentica`, приложение переносит её в папку Segmentica, чтобы сохранить уже загруженные images, containers и volumes.

## Вариант 2. Docker Compose одной командой

Этот способ подходит для macOS, Linux и Windows с Docker Desktop.

### macOS / Linux

```sh
SEGMENTICA_RELEASE_URL="https://github.com/Movementip/Segmentica_Users/releases/latest/download/segmentica-release.zip" sh -c "$(curl -fsSL https://github.com/Movementip/Segmentica_Users/releases/latest/download/install.sh)"
```

### Windows PowerShell

```powershell
$env:SEGMENTICA_RELEASE_URL="https://github.com/Movementip/Segmentica_Users/releases/latest/download/segmentica-release.zip"; iwr https://github.com/Movementip/Segmentica_Users/releases/latest/download/install.ps1 -UseBasicParsing | iex
```

После установки откройте:

```text
http://localhost:3000
```

## Что должно быть установлено

Для macOS desktop-версии ничего дополнительно ставить не нужно: `limactl` и ресурсы Lima входят в приложение.

Для Docker Compose варианта нужен Docker Desktop или совместимый Docker daemon с поддержкой `docker compose`.

## Где хранятся данные

macOS desktop:

```text
~/Library/Application Support/Segmentica
```

Docker Compose:

```text
~/segmentica
```

База PostgreSQL хранится в Docker/nerdctl volume `segmentica-postgres-data`.

## Остановка

В desktop-приложении нажмите `Остановить` или `Закрыть`.

В Docker Compose варианте:

```sh
cd ~/segmentica
docker compose stop
```

Полное удаление контейнеров без удаления данных:

```sh
cd ~/segmentica
docker compose down
```

Удаление вместе с volumes выполняйте только если данные больше не нужны:

```sh
cd ~/segmentica
docker compose down -v
```
