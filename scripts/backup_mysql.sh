#!/usr/bin/env bash
set -euo pipefail

# Bundle MySQL data and storage folders into one backup archive.
# Usage: env DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=... BACKUP_DIR=... ./scripts/backup_mysql.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$REPO_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
  set -o allexport
  # shellcheck disable=SC1090
  source <(tr -d '\r' < "$ENV_FILE")
  set +o allexport
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-innogroup}"
DB_PASSWORD="${DB_PASSWORD:-cos30049fr}"
DB_NAME="${DB_NAME:-appdb}"
BACKUP_DIR="${BACKUP_DIR:-$(pwd)/db_backups}"
KEEP="${KEEP:-5}"
FILES_DIR="$REPO_ROOT/src/files"
UPLOADS_DIR="$REPO_ROOT/uploads"
RICH_CONTENT_DIR="${RICH_CONTENT_STORAGE_DIR:-$REPO_ROOT/storage/rich-content}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%F_%H%M%S")
FILENAME="${DB_NAME}_${TIMESTAMP}.bundle.tar.gz"
WORK_DIR="$(mktemp -d)"
PAYLOAD_DIR="$WORK_DIR/payload"

cleanup() {
  rm -rf "$WORK_DIR"
}

trap cleanup EXIT

copy_tree() {
  local source_dir="$1"
  local target_dir="$2"

  if [ -d "$source_dir" ]; then
    rm -rf "$target_dir"
    mkdir -p "$(dirname "$target_dir")"
    cp -R "$source_dir" "$target_dir"
  fi
}

if ! command -v mysqldump >/dev/null 2>&1; then
  echo "mysqldump not found in PATH" >&2
  exit 2
fi

if ! command -v tar >/dev/null 2>&1; then
  echo "tar not found in PATH" >&2
  exit 2
fi

mkdir -p "$PAYLOAD_DIR"

echo "Starting bundle backup of database '$DB_NAME' to $BACKUP_DIR/$FILENAME"

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

mysqldump "${dump_args[@]}" "$DB_NAME" > "$PAYLOAD_DIR/database.sql"
rc=$?
unset MYSQL_PWD

if [ $rc -ne 0 ]; then
  echo "mysqldump failed with exit code $rc" >&2
  exit $rc
fi

copy_tree "$UPLOADS_DIR" "$PAYLOAD_DIR/uploads"
copy_tree "$FILES_DIR" "$PAYLOAD_DIR/files"
copy_tree "$RICH_CONTENT_DIR" "$PAYLOAD_DIR/rich-content"

tar -czf "$BACKUP_DIR/$FILENAME" -C "$PAYLOAD_DIR" .
rc=$?

if [ $rc -ne 0 ]; then
  echo "tar failed with exit code $rc" >&2
  exit $rc
fi

echo "Backup saved: $BACKUP_DIR/$FILENAME"

# Rotation: keep only the newest $KEEP backup archives and legacy db dumps
shopt -s nullglob
backup_files=("$BACKUP_DIR"/*.bundle.tar.gz "$BACKUP_DIR"/*.sql.gz)
shopt -u nullglob

if [ "${#backup_files[@]}" -gt "$KEEP" ]; then
  echo "Rotating backups, keeping latest $KEEP files"
  ls -1t "${backup_files[@]}" | tail -n +$(($KEEP + 1)) | xargs -r rm --
fi

echo "Done"
