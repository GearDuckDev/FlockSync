#!/bin/sh
set -eu

backup_once() {
    if [ ! -f /data/flocksync.db ]; then
        echo "Database not created yet; waiting for API startup" >&2
        return 1
    fi

    if ! mkdir -p /backups; then
        echo "Cannot create backup directory" >&2
        return 1
    fi
    stamp=$(date -u +%Y%m%d)
    partial="/backups/.flocksync-${stamp}-$$.partial"
    destination="/backups/flocksync-${stamp}.db"
    echo "Starting SQLite online backup: $destination"
    if ! sqlite3 /data/flocksync.db ".timeout 30000" ".backup '$partial'"; then
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
    if ! find /backups -type f -name 'flocksync-*.db' -mtime +30 -delete; then
        echo "Backup succeeded, but retention cleanup failed" >&2
        return 1
    fi
}

backup_once
