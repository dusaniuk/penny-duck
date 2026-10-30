#!/usr/bin/env bash
# Dumps the Coolify Postgres database, encrypts it with age and uploads it with
# rclone. The host holds only the age public key, so it can't read old backups.
#
# Configuration comes from the environment (see penny-duck-backup.env.example):
#   DB_CONTAINER      Coolify's Postgres container (its internal hostname)
#   DB_USER, DB_NAME  default to postgres
#   AGE_RECIPIENT     age public key (age1...)
#   RCLONE_REMOTE     upload destination, e.g. b2:penny-duck-backups
#   HEALTHCHECK_URL   optional healthchecks.io ping URL
set -euo pipefail

: "${DB_CONTAINER:?DB_CONTAINER is required}"
: "${AGE_RECIPIENT:?AGE_RECIPIENT is required}"
: "${RCLONE_REMOTE:?RCLONE_REMOTE is required}"
DB_USER=${DB_USER:-postgres}
DB_NAME=${DB_NAME:-postgres}

ping() {
  [[ -n "${HEALTHCHECK_URL:-}" ]] || return 0
  curl -fsS -m 10 --retry 3 "$HEALTHCHECK_URL$1" > /dev/null || true
}

# Encrypted before it touches the disk, and uploaded only once pg_dump has
# succeeded, so the bucket never holds a truncated backup.
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
trap 'ping /fail' ERR

ping /start
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -Fc "$DB_NAME" \
  | age -r "$AGE_RECIPIENT" > "$tmp"

# The B2 key is write-only, so rclone can't list the bucket to check whether
# the (timestamped, unique) file already exists.
name="penny-duck-$(date -u +%Y-%m-%dT%H%M%SZ).dump.age"
rclone copyto --no-check-dest "$tmp" "$RCLONE_REMOTE/$name"

echo "Uploaded $name ($(wc -c < "$tmp" | tr -d ' ') bytes)"
ping ""
