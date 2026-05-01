param(
    [string]$ReleaseUrl = $env:SEGMENTICA_RELEASE_URL,
    [string]$AppDir = $(if ($env:SEGMENTICA_HOME) { $env:SEGMENTICA_HOME } else { Join-Path $HOME "segmentica" })
)

$ErrorActionPreference = "Stop"
$ImagesArchive = "segmentica-images.tar.gz"
$ImagesManifest = "segmentica-images.sha256"

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

function Resolve-ImagesUrl {
    if (-not [string]::IsNullOrWhiteSpace($env:SEGMENTICA_IMAGES_URL)) {
        return $env:SEGMENTICA_IMAGES_URL
    }

    if ((-not [string]::IsNullOrWhiteSpace($ReleaseUrl)) -and $ReleaseUrl.EndsWith("/segmentica-release.zip")) {
        return ($ReleaseUrl -replace "/segmentica-release\.zip$", "/segmentica-images.tar.gz")
    }

    return $null
}

function Resolve-ImagesBaseUrl {
    if (-not [string]::IsNullOrWhiteSpace($env:SEGMENTICA_IMAGES_BASE_URL)) {
        return $env:SEGMENTICA_IMAGES_BASE_URL
    }

    if ((-not [string]::IsNullOrWhiteSpace($ReleaseUrl)) -and $ReleaseUrl.EndsWith("/segmentica-release.zip")) {
        return ($ReleaseUrl -replace "/segmentica-release\.zip$", "")
    }

    return $null
}

function Download-ImagesArchive {
    if (Test-Path $ImagesArchive) {
        return
    }

    $imagesUrl = Resolve-ImagesUrl
    if (-not [string]::IsNullOrWhiteSpace($imagesUrl)) {
        Write-Host "Скачиваю архив container images..."
        try {
            Invoke-WebRequest -Uri $imagesUrl -OutFile $ImagesArchive
            return
        } catch {
            Remove-Item $ImagesArchive -Force -ErrorAction SilentlyContinue
            Write-Warning "Единый архив images недоступен, попробую скачать части архива."
        }
    }

    $imagesBaseUrl = Resolve-ImagesBaseUrl
    if ([string]::IsNullOrWhiteSpace($imagesBaseUrl)) {
        return
    }

    Write-Host "Скачиваю список частей архива images..."
    try {
        Invoke-WebRequest -Uri "$imagesBaseUrl/$ImagesManifest" -OutFile $ImagesManifest
    } catch {
        Remove-Item $ImagesManifest -Force -ErrorAction SilentlyContinue
        Write-Warning "Список частей images недоступен, попробую загрузить images из registry."
        return
    }

    $parts = Get-Content $ImagesManifest | ForEach-Object {
        $columns = $_.Trim() -split "\s+"
        if ($columns.Length -ge 2) { $columns[1] }
    }

    if (-not $parts -or $parts.Count -eq 0) {
        Remove-Item $ImagesManifest -Force -ErrorAction SilentlyContinue
        Write-Warning "Список частей images пустой, попробую загрузить images из registry."
        return
    }

    foreach ($part in $parts) {
        Write-Host "Скачиваю $part..."
        Invoke-WebRequest -Uri "$imagesBaseUrl/$part" -OutFile $part
    }

    foreach ($line in Get-Content $ImagesManifest) {
        $columns = $line.Trim() -split "\s+"
        if ($columns.Length -lt 2) { continue }
        $expected = $columns[0].ToLowerInvariant()
        $part = $columns[1]
        $actual = (Get-FileHash -Algorithm SHA256 -Path $part).Hash.ToLowerInvariant()
        if ($actual -ne $expected) {
            throw "Контрольная сумма $part не совпадает."
        }
    }

    $tmpArchive = "$ImagesArchive.tmp"
    Remove-Item $tmpArchive -Force -ErrorAction SilentlyContinue
    $output = [System.IO.File]::Open($tmpArchive, [System.IO.FileMode]::CreateNew)
    try {
        foreach ($part in $parts) {
            $input = [System.IO.File]::OpenRead($part)
            try {
                $input.CopyTo($output)
            } finally {
                $input.Dispose()
            }
            Remove-Item $part -Force
        }
    } finally {
        $output.Dispose()
    }

    Move-Item $tmpArchive $ImagesArchive -Force
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

function Load-ImagesIfPresent {
    if (-not (Test-Path $ImagesArchive)) {
        return $false
    }

    Write-Host "Загружаю container images из $ImagesArchive..."
    docker load -i $ImagesArchive
    if ($LASTEXITCODE -ne 0) {
        throw "docker load завершился с ошибкой."
    }

    return $true
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

Download-ImagesArchive

if (-not (Load-ImagesIfPresent)) {
    Write-Host "Скачиваю Docker images..."
    docker compose pull
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose pull завершился с ошибкой."
    }
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
