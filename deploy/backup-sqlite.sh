#!/bin/sh
set -eu

backup_once() {
    if [ ! -f /data/flocksync.db ]; then
        echo "Database not created yet; waiting for API startup" >&2
        return 1
    fi

    backup_directory=/backups
    if [ -f /data/admin-database-state.json ]; then
        if ! grep -q '"backupDirectory":"[^"]*"' /data/admin-database-state.json; then
            echo "Invalid persistent database admin settings" >&2
            return 1
        fi
        backup_subdirectory=$(sed -n 's/.*"backupDirectory":"\([^"]*\)".*/\1/p' /data/admin-database-state.json)
        case "$backup_subdirectory" in
            *[!A-Za-z0-9._\ /-]*|/*|*//*|*\\*)
                echo "Invalid persistent backup directory setting" >&2
                return 1
                ;;
        esac
        remaining=$backup_subdirectory
        while [ -n "$remaining" ]; do
            segment=${remaining%%/*}
            if [ "$segment" = "." ] || [ "$segment" = ".." ] || [ -z "$segment" ]; then
                echo "Invalid persistent backup directory setting" >&2
                return 1
            fi
            if [ "$remaining" = "$segment" ]; then
                remaining=
            else
                remaining=${remaining#*/}
            fi
            backup_directory="$backup_directory/$segment"
            if [ -L "$backup_directory" ]; then
                echo "Backup folders must not be symbolic links" >&2
                return 1
            fi
        done
    fi
    if [ -L /backups ] || ! mkdir -p "$backup_directory"; then
        echo "Cannot create backup directory" >&2
        return 1
    fi
    case "${BACKUP_REASON:-daily}" in
        daily) stamp=$(date -u +%Y%m%d) ;;
        pre-update) stamp="pre-update-$(date -u +%Y%m%dT%H%M%SZ)" ;;
        *) echo "Invalid BACKUP_REASON; expected daily or pre-update" >&2; return 1 ;;
    esac
    partial=$(mktemp "$backup_directory/.flocksync-XXXXXX") || {
        echo "Cannot create temporary backup file" >&2
        return 1
    }
    if [ "${BACKUP_REASON:-daily}" = "pre-update" ]; then
        stamp="${stamp}-${partial##*-}"
    fi
    destination="$backup_directory/flocksync-${stamp}.db"
    echo "Starting SQLite online backup: $destination"
    if ! sqlite3 -readonly /data/flocksync.db ".timeout 30000" ".backup '$partial'"; then
        echo "SQLite backup failed; existing backups retained" >&2
        rm -f "$partial"
        return 1
    fi
    if [ "$(sqlite3 "$partial" 'PRAGMA quick_check;')" != "ok" ]; then
        echo "Backup integrity check failed; existing backups retained" >&2
        rm -f "$partial"
        return 1
    fi
    if ! mv "$partial" "$destination"; then
        echo "Cannot publish backup; existing backups retained" >&2
        rm -f "$partial"
        return 1
    fi
    echo "Backup complete: $destination"
    # Keep rollback snapshots until the administrator explicitly removes them.
    if ! find "$backup_directory" -type f \
        -name 'flocksync-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9].db' \
        -mtime +30 -delete; then
        echo "Backup succeeded, but retention cleanup failed" >&2
        return 1
    fi
}

backup_once
