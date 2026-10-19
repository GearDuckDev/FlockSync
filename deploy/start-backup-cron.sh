#!/bin/sh
set -eu

if [ "${BACKUP_ONCE:-0}" = "1" ]; then
    exec /bin/sh /usr/local/bin/backup-sqlite
fi

# UTC midnight daily; forward both cron-job streams to the container logs.
echo '0 0 * * * /bin/sh /usr/local/bin/backup-sqlite >>/proc/1/fd/1 2>>/proc/1/fd/2' > /etc/crontabs/root
if ! /bin/sh /usr/local/bin/backup-sqlite; then
    echo "Startup backup failed; cron will retry at the next daily run" >&2
fi
exec crond -f -l 2
