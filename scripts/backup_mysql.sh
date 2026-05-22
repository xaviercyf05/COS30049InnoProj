#!/usr/bin/env bash
set -euo pipefail

# Simple MySQL backup script with rotation (keep latest N backups)
# Usage: env DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=... BACKUP_DIR=... ./scripts/backup_mysql.sh

ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-innogroup}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-appdb}"
BACKUP_DIR="${BACKUP_DIR:-$(pwd)/db_backups}"
KEEP="${KEEP:-5}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%F_%H%M%S")
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"

if ! command -v mysqldump >/dev/null 2>&1; then
  echo "mysqldump not found in PATH" >&2
  exit 2
fi

echo "Starting backup of database '$DB_NAME' to $BACKUP_DIR/$FILENAME"

# Use MYSQL_PWD env var to avoid exposing password in the process list (still has tradeoffs)
export MYSQL_PWD="$DB_PASSWORD"

dump_args=(
  -h "$DB_HOST"
  -P "$DB_PORT"
  -u "$DB_USER"
  --single-transaction
  --quick
  --lock-tables=false
)

if mysqldump --help 2>/dev/null | grep -q -- '--column-statistics'; then
  dump_args+=(--column-statistics=0)
fi

mysqldump "${dump_args[@]}" "$DB_NAME" | gzip > "$BACKUP_DIR/$FILENAME"
rc=$?
unset MYSQL_PWD

if [ $rc -ne 0 ]; then
  echo "mysqldump failed with exit code $rc" >&2
  exit $rc
fi

echo "Backup saved: $BACKUP_DIR/$FILENAME"

# Rotation: keep only the newest $KEEP files
count=$(ls -1t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l || true)
if [ "$count" -gt "$KEEP" ]; then
  echo "Rotating backups, keeping latest $KEEP files"
  ls -1t "$BACKUP_DIR"/*.sql.gz | tail -n +$(($KEEP + 1)) | xargs -r rm --
fi

echo "Done"
