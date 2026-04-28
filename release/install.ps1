param(
    [string]$ReleaseUrl = $env:SEGMENTICA_RELEASE_URL,
    [string]$AppDir = $(if ($env:SEGMENTICA_HOME) { $env:SEGMENTICA_HOME } else { Join-Path $HOME "segmentica" })
)

$ErrorActionPreference = "Stop"

function Require-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Не найдена команда: $Name. Установите Docker Desktop и повторите запуск."
    }
}

function Download-Release {
    if ([string]::IsNullOrWhiteSpace($ReleaseUrl)) {
        return
    }

    $tmpZip = Join-Path ([System.IO.Path]::GetTempPath()) ("segmentica-release-{0}.zip" -f ([guid]::NewGuid()))
    Write-Host "Скачиваю release-пакет..."
    Invoke-WebRequest -Uri $ReleaseUrl -OutFile $tmpZip

    New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
    Expand-Archive -Path $tmpZip -DestinationPath $AppDir -Force
    Remove-Item $tmpZip -Force
}

function Load-EnvFile {
    param([string]$Path)

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
            return
        }

        $parts = $line.Split("=", 2)
        if ($parts.Length -eq 2) {
            [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
        }
    }
}

function Wait-ForDb {
    Write-Host "Жду готовность PostgreSQL..."
    for ($i = 0; $i -lt 60; $i++) {
        docker compose exec -T db pg_isready -U $env:POSTGRES_USER -d $env:POSTGRES_DB *> $null
        if ($LASTEXITCODE -eq 0) {
            return
        }
        Start-Sleep -Seconds 2
    }

    throw "PostgreSQL не успел запуститься."
}

function Restore-SeedIfPresent {
    if (-not (Test-Path "seed/Segmentica.dump")) {
        return
    }

    $marker = ".segmentica-seed-restored"
    if (Test-Path $marker) {
        Write-Host "Seed уже был восстановлен, пропускаю pg_restore."
        return
    }

    Write-Host "Восстанавливаю базу из seed/Segmentica.dump..."
    docker compose exec -T db pg_restore `
        -U $env:POSTGRES_USER `
        -d $env:POSTGRES_DB `
        --clean `
        --if-exists `
        /seed/Segmentica.dump

    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore завершился с ошибкой."
    }

    Get-Date | Out-File -Encoding utf8 $marker
}

Require-Command docker
Download-Release

New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
Set-Location $AppDir

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
    } else {
        throw "Не найден .env.example в $AppDir"
    }
}

if (-not (Test-Path "docker-compose.yml")) {
    throw "Не найден docker-compose.yml в $AppDir"
}

Load-EnvFile ".env"
if (-not $env:POSTGRES_USER) { $env:POSTGRES_USER = "postgres" }
if (-not $env:POSTGRES_DB) { $env:POSTGRES_DB = "Segmentica" }
if (-not $env:NEXTAUTH_URL) { $env:NEXTAUTH_URL = "http://localhost:3000" }

Write-Host "Скачиваю Docker images..."
docker compose pull
if ($LASTEXITCODE -ne 0) {
    throw "docker compose pull завершился с ошибкой."
}

Write-Host "Запускаю Segmentica..."
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    throw "docker compose up завершился с ошибкой."
}

Wait-ForDb
Restore-SeedIfPresent

Write-Host ""
Write-Host "Готово. Откройте: $env:NEXTAUTH_URL"
