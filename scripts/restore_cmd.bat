@echo off
setlocal EnableExtensions

rem Usage:
rem   restore_cmd.bat [backup_file] [db_name] [host] [port] [user] [password]
rem Defaults:
rem   backup_file = newest .sql.gz in ..\db_backups
rem   db_name     = appdb_test
rem   host        = 127.0.0.1
rem   port        = 13306
rem   user        = innogroup
rem   password    = DB_PASSWORD env var, or prompt if missing

set "SCRIPT_DIR=%~dp0"
set "DEFAULT_BACKUP_DIR=%SCRIPT_DIR%..\db_backups"

set "BACKUP=%~1"
set "DB=%~2"
set "HOST=%~3"
set "PORT=%~4"
set "USER=%~5"
set "PASSWORD=%~6"

if not defined BACKUP (
  for /f "delims=" %%F in ('dir /b /o-d "%DEFAULT_BACKUP_DIR%\*.sql.gz" 2^>nul') do (
    set "BACKUP=%DEFAULT_BACKUP_DIR%\%%F"
    goto :backup_found
  )
  echo No backup file found in "%DEFAULT_BACKUP_DIR%".
  exit /b 1
)
:backup_found

if not defined DB set "DB=appdb_test"
if not defined HOST set "HOST=127.0.0.1"
if not defined PORT set "PORT=13306"
if not defined USER set "USER=innogroup"
if not defined PASSWORD set "PASSWORD=%DB_PASSWORD%"

if not defined PASSWORD (
  set /p "PASSWORD=Enter MySQL password for %USER%: "
)

set "MYSQL_PWD=%PASSWORD%"

echo Creating database %DB% if missing...
mysql -h %HOST% -P %PORT% -u %USER% -e "CREATE DATABASE IF NOT EXISTS %DB%;"
if errorlevel 1 (
  echo CREATE DATABASE failed
  exit /b 1
)

echo Restoring "%BACKUP%" into %DB%...
gzip -dc "%BACKUP%" | mysql -h %HOST% -P %PORT% -u %USER% %DB%
if errorlevel 1 (
  echo Restore failed
  exit /b 1
)

echo Showing tables in %DB%:
mysql -h %HOST% -P %PORT% -u %USER% -e "USE %DB%; SHOW TABLES;"
