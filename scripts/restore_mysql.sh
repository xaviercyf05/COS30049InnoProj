#!/usr/bin/env bash
set -euo pipefail

# Restore a MySQL backup (.sql.gz) into a target database.
#
# Usage:
#   ./scripts/restore_mysql.sh [backup_file] [db_name] [host] [port] [user] [password]
#
# Defaults:
#   backup_file = newest .sql.gz in ./db_backups
#   db_name     = appdb_test
#   host        = 127.0.0.1
#   port        = 3306
#   user        = root
#   password    = DB_PASSWORD env var (or prompt if empty)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_BACKUP_DIR="$REPO_ROOT/db_backups"

BACKUP_FILE="${1:-}"
TARGET_DB="${2:-appdb_test}"
DB_HOST="${3:-127.0.0.1}"
DB_PORT="${4:-3306}"
DB_USER="${5:-innogroup}"
DB_PASSWORD="${6:-${DB_PASSWORD:-}}"

if ! command -v mysql >/dev/null 2>&1; then
  echo "mysql client not found in PATH" >&2
  exit 2
fi

if ! command -v gzip >/dev/null 2>&1; then
  echo "gzip not found in PATH" >&2
  exit 2
fi

if [ -z "$BACKUP_FILE" ]; then
  BACKUP_FILE="$(ls -1t "$DEFAULT_BACKUP_DIR"/*.sql.gz 2>/dev/null | head -n 1 || true)"
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "No backup file found. Provide one explicitly or place backups in $DEFAULT_BACKUP_DIR" >&2
  exit 1
fi

if [ -z "$DB_PASSWORD" ]; then
  read -r -s -p "Enter MySQL password for $DB_USER: " DB_PASSWORD
  echo
fi

export MYSQL_PWD="$DB_PASSWORD"

echo "Creating database '$TARGET_DB' if missing..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -e "CREATE DATABASE IF NOT EXISTS \`$TARGET_DB\`;"

echo "Restoring '$BACKUP_FILE' into '$TARGET_DB'..."
gzip -dc "$BACKUP_FILE" | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$TARGET_DB"

echo "Listing tables in '$TARGET_DB'..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -e "USE \`$TARGET_DB\`; SHOW TABLES;"

unset MYSQL_PWD
echo "Restore complete."
