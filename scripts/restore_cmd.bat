@echo off
setlocal EnableExtensions

rem Usage:
rem   restore_cmd.bat [backup_file] [db_name] [host] [port] [user] [password]
rem Defaults:
rem   backup_file = newest .bundle.tar.gz or .sql.gz in ..\db_backups
rem   db_name     = appdb_test
rem   host        = 127.0.0.1
rem   port        = 13306
rem   user        = innogroup
rem   password    = DB_PASSWORD env var, or prompt if missing

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "REPO_ROOT=%%~fI"
set "DEFAULT_BACKUP_DIR=%REPO_ROOT%\db_backups"
if not defined RICH_CONTENT_STORAGE_DIR set "RICH_CONTENT_STORAGE_DIR=%REPO_ROOT%\storage\rich-content"

set "BACKUP=%~1"
set "DB=%~2"
set "HOST=%~3"
set "PORT=%~4"
set "USER=%~5"
set "PASSWORD=%~6"

if not defined BACKUP (
  for /f "delims=" %%F in ('dir /b /o-d "%DEFAULT_BACKUP_DIR%\*.bundle.tar.gz" 2^>nul') do (
    set "BACKUP=%DEFAULT_BACKUP_DIR%\%%F"
    goto :backup_found
  )
  for /f "delims=" %%F in ('dir /b /o-d "%DEFAULT_BACKUP_DIR%\*.sql.gz" 2^>nul') do (
    set "BACKUP=%DEFAULT_BACKUP_DIR%\%%F"
    goto :backup_found
  )
  echo No backup file found in "%DEFAULT_BACKUP_DIR%".
  exit /b 1
)
:backup_found

if not defined DB set "DB=appdb"
if not defined HOST set "HOST=127.0.0.1"
if not defined PORT set "PORT=13306"
if not defined USER set "USER=innogroup"
if not defined PASSWORD set "PASSWORD=%DB_PASSWORD%"

if not defined PASSWORD (
  set /p "PASSWORD=Enter MySQL password for %USER%: "
)

set "MYSQL_PWD=%PASSWORD%"

if /i "%BACKUP:~-7%"==".tar.gz" goto :restore_bundle

if /i not "%BACKUP:~-7%"==".sql.gz" (
  echo Unsupported backup format: %BACKUP%
  exit /b 1
)

where gzip >nul 2>nul
if errorlevel 1 (
  echo gzip not found in PATH
  exit /b 2
)

call :confirm_restore
if errorlevel 1 exit /b 1

call :recreate_database
if errorlevel 1 exit /b 1

echo Restoring "%BACKUP%" into %DB%...
gzip -dc "%BACKUP%" | mysql -h %HOST% -P %PORT% -u %USER% %DB%
if errorlevel 1 (
  echo Restore failed
  exit /b 1
)

echo Showing tables in %DB%:
mysql -h %HOST% -P %PORT% -u %USER% -e "USE %DB%; SHOW TABLES;"

set "MYSQL_PWD="
exit /b 0

:restore_bundle
where tar >nul 2>nul
if errorlevel 1 (
  echo tar not found in PATH
  exit /b 2
)

call :confirm_restore
if errorlevel 1 exit /b 1

set "RESTORE_TEMP=%TEMP%\innoproj-restore-%RANDOM%%RANDOM%"
mkdir "%RESTORE_TEMP%" >nul 2>nul
if errorlevel 1 (
  echo Failed to create temporary restore directory
  exit /b 1
)

tar -xzf "%BACKUP%" -C "%RESTORE_TEMP%"
if errorlevel 1 (
  echo Restore bundle extraction failed
  rmdir /s /q "%RESTORE_TEMP%"
  exit /b 1
)

if not exist "%RESTORE_TEMP%\database.sql" (
  echo Bundle backup is missing database.sql
  rmdir /s /q "%RESTORE_TEMP%"
  exit /b 1
)

call :recreate_database
if errorlevel 1 (
  rmdir /s /q "%RESTORE_TEMP%"
  exit /b 1
)

echo Restoring database payload into %DB%...
mysql -h %HOST% -P %PORT% -u %USER% %DB% < "%RESTORE_TEMP%\database.sql"
if errorlevel 1 (
  echo Restore failed
  rmdir /s /q "%RESTORE_TEMP%"
  exit /b 1
)

call :restore_dir "%RESTORE_TEMP%\uploads" "%REPO_ROOT%\uploads"
if errorlevel 1 goto :bundle_failed
call :restore_dir "%RESTORE_TEMP%\files" "%REPO_ROOT%\src\files"
if errorlevel 1 goto :bundle_failed
call :restore_dir "%RESTORE_TEMP%\rich-content" "%RICH_CONTENT_STORAGE_DIR%"
if errorlevel 1 goto :bundle_failed

echo Showing tables in %DB%:
mysql -h %HOST% -P %PORT% -u %USER% -e "USE %DB%; SHOW TABLES;"

rmdir /s /q "%RESTORE_TEMP%"
set "MYSQL_PWD="
echo Restore complete.
exit /b 0

:bundle_failed
rmdir /s /q "%RESTORE_TEMP%"
set "MYSQL_PWD="
exit /b 1

:confirm_restore
echo WARNING: This will delete the current database %DB% and overwrite any restored storage folders.
echo Backup source: %BACKUP%
set /p "CONFIRM=Type yes to continue: "
if /i not "%CONFIRM%"=="yes" (
  echo Restore cancelled.
  exit /b 1
)
exit /b 0

:recreate_database
echo Dropping existing database %DB% if it exists...
mysql -h %HOST% -P %PORT% -u %USER% -e "DROP DATABASE IF EXISTS %DB%;"
if errorlevel 1 (
  echo DROP DATABASE failed
  exit /b 1
)

echo Creating database %DB%...
mysql -h %HOST% -P %PORT% -u %USER% -e "CREATE DATABASE %DB%;"
if errorlevel 1 (
  echo CREATE DATABASE failed
  exit /b 1
)
exit /b 0

:restore_dir
set "SOURCE=%~1"
set "DEST=%~2"

if not exist "%SOURCE%" exit /b 0
if exist "%DEST%" rmdir /s /q "%DEST%"
for %%D in ("%DEST%") do if not exist "%%~dpD" mkdir "%%~dpD" >nul 2>nul
robocopy "%SOURCE%" "%DEST%" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
  echo Failed to restore "%DEST%"
  exit /b 1
)
exit /b 0
