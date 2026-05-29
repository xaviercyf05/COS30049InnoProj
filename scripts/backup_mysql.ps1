param(
    [string]$DbHost = $(if ($env:DB_HOST) { $env:DB_HOST } else { '127.0.0.1' }),
    [int]$DbPort = $(if ($env:DB_PORT) { [int]$env:DB_PORT } else { 3306 }),
    [string]$DbUser = $(if ($env:DB_USER) { $env:DB_USER } else { 'root' }),
    [string]$DbPassword = $(if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { '' }),
    [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { 'appdb' }),
    [string]$BackupDir = $(if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { (Join-Path (Get-Location) 'db_backups') }),
    [int]$Keep = $(if ($env:KEEP) { [int]$env:KEEP } else { 5 })
)

if (-not (Get-Command mysqldump -ErrorAction SilentlyContinue)) {
    Write-Error "mysqldump not found in PATH"
    exit 2
}

if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
    Write-Error "tar not found in PATH"
    exit 2
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$uploadsDir = Join-Path $repoRoot 'uploads'
$filesDir = Join-Path $repoRoot 'src/files'
$richContentDir = if ($env:RICH_CONTENT_STORAGE_DIR) { $env:RICH_CONTENT_STORAGE_DIR } else { (Join-Path $repoRoot 'storage/rich-content') }

if (-not (Test-Path -Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir | Out-Null }

$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$filename = "${DbName}_${timestamp}.bundle.tar.gz"
$outPath = Join-Path $BackupDir $filename
$tempSqlPath = Join-Path $BackupDir "${DbName}_${timestamp}.sql"

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString('N'))
$payloadRoot = Join-Path $tempRoot 'payload'

function Copy-StorageTree {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path -Path $Source)) {
        return
    }

    if (Test-Path -Path $Destination) {
        Remove-Item -Path $Destination -Recurse -Force
    }

    $destinationParent = Split-Path -Parent $Destination
    if ($destinationParent -and -not (Test-Path -Path $destinationParent)) {
        New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
    }

    Copy-Item -Path $Source -Destination $Destination -Recurse -Force
}

New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
New-Item -ItemType Directory -Path $payloadRoot -Force | Out-Null

Write-Output "Starting bundle backup of database '$DbName' to $outPath"

try {
    $env:MYSQL_PWD = $DbPassword
    # Write the raw dump first so mysqldump errors are not hidden by a pipe.
    $dumpCmd = 'mysqldump -h ' + $DbHost + ' -P ' + $DbPort + ' -u ' + $DbUser + ' --single-transaction --quick --lock-tables=false --column-statistics=0 ' + $DbName + ' > "' + $tempSqlPath + '"'
    cmd.exe /c $dumpCmd
    $rc = $LASTEXITCODE
} finally {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}

if ($rc -ne 0) {
    Remove-Item $tempSqlPath -ErrorAction SilentlyContinue
    Write-Error "mysqldump failed with exit code $rc"
    Remove-Item $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    exit $rc
}

Copy-StorageTree -Source $uploadsDir -Destination (Join-Path $payloadRoot 'uploads')
Copy-StorageTree -Source $filesDir -Destination (Join-Path $payloadRoot 'files')
Copy-StorageTree -Source $richContentDir -Destination (Join-Path $payloadRoot 'rich-content')

& tar -czf $outPath -C $payloadRoot .
$tarExitCode = $LASTEXITCODE

Remove-Item $tempSqlPath -ErrorAction SilentlyContinue
Remove-Item $tempRoot -Recurse -Force -ErrorAction SilentlyContinue

if ($tarExitCode -ne 0) {
    Write-Error "tar failed with exit code $tarExitCode"
    exit $tarExitCode
}

if (-not (Test-Path $outPath) -or ((Get-Item $outPath).Length -lt 20)) {
    Remove-Item $outPath -ErrorAction SilentlyContinue
    Write-Error "Backup compression failed or produced an invalid file"
    exit 3
}

Write-Output "Backup saved: $outPath"

# Rotation
$files = @(
    Get-ChildItem -Path $BackupDir -Filter "*.bundle.tar.gz" -File -ErrorAction SilentlyContinue
) + @(
    Get-ChildItem -Path $BackupDir -Filter "*.sql.gz" -File -ErrorAction SilentlyContinue
)
$files = $files | Sort-Object LastWriteTime -Descending
if ($files.Count -gt $Keep) {
    $toRemove = $files | Select-Object -Skip $Keep
    $toRemove | ForEach-Object { Remove-Item $_.FullName -Force }
    Write-Output "Rotated backups, removed $($toRemove.Count) files"
}

Write-Output "Done"
