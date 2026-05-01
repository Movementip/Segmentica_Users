# Segmentica 2026.04.28

## Главное

- Добавлено desktop-приложение Segmentica для macOS.
- macOS-версия использует встроенную Lima VM вместо Docker Desktop.
- Runtime, VM, контейнеры, images и volumes сведены в одну пользовательскую среду Segmentica.
- Добавлена панель окружения перед входом в приложение.
- Добавлены кнопки запуска, остановки, обновления, открытия папки данных и полного закрытия.
- Добавлены логи контейнеров в интерфейсе.
- Добавлена поддержка GitHub Release assets и GHCR packages.
- Release-пакет включает seed текущей базы для первого восстановления PostgreSQL volume.

## Установка

macOS:

1. Скачайте `Segmentica-macOS.dmg` из assets последнего релиза.
2. Перенесите `Segmentica.app` в `Applications`.
3. Запустите приложение и нажмите `Запустить`.

Docker Compose:

```sh
SEGMENTICA_RELEASE_URL="https://github.com/Movementip/Segmentica_Users/releases/latest/download/segmentica-release.zip" sh -c "$(curl -fsSL https://github.com/Movementip/Segmentica_Users/releases/latest/download/install.sh)"
```

Windows PowerShell:

```powershell
$env:SEGMENTICA_RELEASE_URL="https://github.com/Movementip/Segmentica_Users/releases/latest/download/segmentica-release.zip"; iwr https://github.com/Movementip/Segmentica_Users/releases/latest/download/install.ps1 -UseBasicParsing | iex
```

## Данные

macOS desktop хранит данные здесь:

```text
~/Library/Application Support/Segmentica
```

Docker Compose хранит рабочие файлы здесь:

```text
~/segmentica
```
