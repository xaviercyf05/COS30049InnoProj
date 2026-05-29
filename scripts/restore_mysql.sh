#!/usr/bin/env bash
set -euo pipefail

# Restore a bundle backup (.tar.gz) or legacy MySQL dump (.sql.gz) into a target database.
#
# Usage:
#   ./scripts/restore_mysql.sh [backup_file] [db_name] [host] [port] [user] [password]
#
# Defaults:
#   backup_file = newest .bundle.tar.gz or .sql.gz in ./db_backups
#   db_name     = appdb_test
#   host        = 127.0.0.1
#   port        = 3306
#   user        = root
#   password    = DB_PASSWORD env var (or prompt if empty)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_BACKUP_DIR="$REPO_ROOT/db_backups"
ENV_FILE="$REPO_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  set -o allexport
  # shellcheck disable=SC1090
  source <(tr -d '\r' < "$ENV_FILE")
  set +o allexport
fi

BACKUP_FILE="${1:-}"
TARGET_DB="${2:-appdb}"
DB_HOST="${3:-127.0.0.1}"
DB_PORT="${4:-3306}"
DB_USER="${5:-innogroup}"
DB_PASSWORD="${6:-${DB_PASSWORD:-cos30049fr}}"
RICH_CONTENT_TARGET_DIR="${RICH_CONTENT_STORAGE_DIR:-$REPO_ROOT/storage/rich-content}"

if ! command -v mysql >/dev/null 2>&1; then
  echo "mysql client not found in PATH" >&2
  exit 2
fi

if [ -z "$BACKUP_FILE" ]; then
  shopt -s nullglob
  backup_candidates=("$DEFAULT_BACKUP_DIR"/*.bundle.tar.gz "$DEFAULT_BACKUP_DIR"/*.sql.gz)
  shopt -u nullglob

  if [ "${#backup_candidates[@]}" -gt 0 ]; then
    BACKUP_FILE="$(ls -1t "${backup_candidates[@]}" | head -n 1 || true)"
  fi
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "No backup file found. Provide one explicitly or place backups in $DEFAULT_BACKUP_DIR" >&2
  exit 1
fi

confirm_restore() {
  echo "WARNING: This will delete the current '$TARGET_DB' database and overwrite any restored storage folders."
  echo "Backup source: $BACKUP_FILE"
  read -r -p "Type 'yes' to continue: " confirmation

  if [ "$confirmation" != "yes" ]; then
    echo "Restore cancelled."
    exit 1
  fi
}

recreate_database() {
  echo "Dropping existing database '$TARGET_DB' if it exists..."
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -e "DROP DATABASE IF EXISTS \`$TARGET_DB\`;"

  echo "Creating database '$TARGET_DB'..."
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -e "CREATE DATABASE \`$TARGET_DB\`;"
}

if [ -z "$DB_PASSWORD" ]; then
  read -r -s -p "Enter MySQL password for $DB_USER: " DB_PASSWORD
  echo
fi

export MYSQL_PWD="$DB_PASSWORD"

RESTORE_TEMP_DIR=""
restore_tree() {
  local source_dir="$1"
  local target_dir="$2"

  if [ -d "$source_dir" ]; then
    rm -rf "$target_dir"
    mkdir -p "$(dirname "$target_dir")"
    cp -R "$source_dir" "$target_dir"
  fi
}

restore_bundle() {
  if ! command -v tar >/dev/null 2>&1; then
    echo "tar not found in PATH" >&2
    exit 2
  fi

  confirm_restore

  RESTORE_TEMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$RESTORE_TEMP_DIR"; unset MYSQL_PWD' EXIT

  tar -xzf "$BACKUP_FILE" -C "$RESTORE_TEMP_DIR"

  if [ ! -f "$RESTORE_TEMP_DIR/database.sql" ]; then
    echo "Bundle backup is missing database.sql" >&2
    exit 1
  fi

  recreate_database

  echo "Restoring database payload into '$TARGET_DB'..."
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$TARGET_DB" < "$RESTORE_TEMP_DIR/database.sql"

  restore_tree "$RESTORE_TEMP_DIR/uploads" "$REPO_ROOT/uploads"
  restore_tree "$RESTORE_TEMP_DIR/files" "$REPO_ROOT/src/files"
  restore_tree "$RESTORE_TEMP_DIR/rich-content" "$RICH_CONTENT_TARGET_DIR"

  echo "Listing tables in '$TARGET_DB'..."
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -e "USE \`$TARGET_DB\`; SHOW TABLES;"

  echo "Restore complete."
}

case "$BACKUP_FILE" in
  *.tar.gz|*.tgz)
    restore_bundle
    exit 0
    ;;
  *.sql.gz)
    ;;
  *)
    echo "Unsupported backup format: $BACKUP_FILE" >&2
    exit 1
    ;;
esac

if ! command -v gzip >/dev/null 2>&1; then
  echo "gzip not found in PATH" >&2
  exit 2
fi

confirm_restore

recreate_database

echo "Restoring '$BACKUP_FILE' into '$TARGET_DB'..."
gzip -dc "$BACKUP_FILE" | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$TARGET_DB"

echo "Listing tables in '$TARGET_DB'..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -e "USE \`$TARGET_DB\`; SHOW TABLES;"

unset MYSQL_PWD
echo "Restore complete."
