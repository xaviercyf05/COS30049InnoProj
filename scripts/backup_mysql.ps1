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

if (-not (Test-Path -Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir | Out-Null }

$timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$filename = "${DbName}_${timestamp}.sql.gz"
$outPath = Join-Path $BackupDir $filename
$tempSqlPath = Join-Path $BackupDir "${DbName}_${timestamp}.sql"

Write-Output "Starting backup of database '$DbName' to $outPath"

$env:MYSQL_PWD = $DbPassword
# Write the raw dump first so mysqldump errors are not hidden by a pipe.
$dumpCmd = 'mysqldump -h ' + $DbHost + ' -P ' + $DbPort + ' -u ' + $DbUser + ' --single-transaction --quick --lock-tables=false --column-statistics=0 ' + $DbName + ' > "' + $tempSqlPath + '"'
cmd.exe /c $dumpCmd
$rc = $LASTEXITCODE
Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue

if ($rc -ne 0) {
    Remove-Item $tempSqlPath -ErrorAction SilentlyContinue
    Write-Error "mysqldump failed with exit code $rc"
    exit $rc
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$inputStream = [System.IO.File]::OpenRead($tempSqlPath)
$outputStream = [System.IO.File]::Create($outPath)
$gzipStream = New-Object System.IO.Compression.GzipStream($outputStream, [System.IO.Compression.CompressionMode]::Compress)
try {
    $inputStream.CopyTo($gzipStream)
} finally {
    $gzipStream.Dispose()
    $outputStream.Dispose()
    $inputStream.Dispose()
    Remove-Item $tempSqlPath -ErrorAction SilentlyContinue
}

if (-not (Test-Path $outPath) -or ((Get-Item $outPath).Length -lt 20)) {
    Remove-Item $outPath -ErrorAction SilentlyContinue
    Write-Error "Backup compression failed or produced an invalid file"
    exit 3
}

Write-Output "Backup saved: $outPath"

# Rotation
$files = Get-ChildItem -Path $BackupDir -Filter "*.sql.gz" | Sort-Object LastWriteTime -Descending
if ($files.Count -gt $Keep) {
    $toRemove = $files | Select-Object -Skip $Keep
    $toRemove | ForEach-Object { Remove-Item $_.FullName -Force }
    Write-Output "Rotated backups, removed $($toRemove.Count) files"
}

Write-Output "Done"
