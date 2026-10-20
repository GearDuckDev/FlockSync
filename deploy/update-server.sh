#!/bin/sh
set -eu

if [ "$#" -ne 0 ]; then
    echo "Usage: sh deploy/update-server.sh (from the deployed project directory)" >&2
    exit 1
fi
if [ ! -f docker-compose.yml ] || [ ! -f .env.production ]; then
    echo "Run from the deployed project directory with docker-compose.yml and .env.production present." >&2
    exit 1
fi

compose() {
    docker compose --env-file .env.production "$@"
}

compose config --quiet
echo "Preparing backup tooling; running API/web containers are unchanged."
compose build db-backup
echo "Creating and verifying a pre-update SQLite backup in NAS_BACKUP_PATH."
if ! compose run --rm --no-deps -e BACKUP_ONCE=1 -e BACKUP_REASON=pre-update db-backup; then
    echo "UPDATE ABORTED: backup failed. API/web containers have not been rebuilt or restarted." >&2
    exit 1
fi
echo "Backup verified. Building the selected server source."
compose build api web
compose up -d --no-build api web db-backup
compose ps
echo "Server update applied. Check API/web health and login before resuming use."
