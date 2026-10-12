#!/bin/sh
# Dumps the game database (pg_dump custom format) to BACKUP_DIR and deletes dumps older than KEEP_DAYS.
# Run from anywhere; meant for cron on the host (docs/deployment.md, Backups):
#   0 * * * *  /srv/marchlands/tools/ops/backup.sh >> /srv/marchlands/backups/backup.log 2>&1
set -eu
cd "$(dirname "$0")/../.."
BACKUP_DIR="${BACKUP_DIR:-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/marchlands-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$file.part"
mv "$file.part" "$file"
find "$BACKUP_DIR" -name 'marchlands-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "$(date -u +%FT%TZ) backup $file ($(du -h "$file" | cut -f1))"
