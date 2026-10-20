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
    case "${BACKUP_REASON:-daily}" in
        daily) stamp=$(date -u +%Y%m%d) ;;
        pre-update) stamp="pre-update-$(date -u +%Y%m%dT%H%M%SZ)" ;;
        *) echo "Invalid BACKUP_REASON; expected daily or pre-update" >&2; return 1 ;;
    esac
    partial=$(mktemp /backups/.flocksync-XXXXXX) || {
        echo "Cannot create temporary backup file" >&2
        return 1
    }
    if [ "${BACKUP_REASON:-daily}" = "pre-update" ]; then
        stamp="${stamp}-${partial##*-}"
    fi
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
    # Keep rollback snapshots until the administrator explicitly removes them.
    if ! find /backups -type f -name 'flocksync-[0-9]*.db' -mtime +30 -delete; then
        echo "Backup succeeded, but retention cleanup failed" >&2
        return 1
    fi
}

backup_once
