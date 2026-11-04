#!/bin/sh
set -eu

if [ ! -f docker-compose.yml ] || [ ! -f .env ]; then
    echo '{"event":"resource_check_failed","message":"Run from the deployed project directory"}' >&2
    exit 1
fi

outcome=0
if [ -n "${BACKUP_MOUNTPOINT:-}" ] && ! mountpoint -q "$BACKUP_MOUNTPOINT"; then
    echo '{"event":"resource_check_failed","message":"Required backup mount is absent"}' >&2
    outcome=1
elif ! docker compose --env-file .env exec -T \
    -e "RESOURCE_MIN_FREE_BYTES=${RESOURCE_MIN_FREE_BYTES:-1073741824}" \
    -e "RESOURCE_MIN_FREE_PERCENT=${RESOURCE_MIN_FREE_PERCENT:-10}" \
    api node --input-type=module < deploy/check-resources.mjs; then
    outcome=1
fi

if [ -n "${MONITOR_CURL_CONFIG:-}" ]; then
    status=up
    message="Resource and verified backup checks passed"
    if [ "$outcome" -ne 0 ]; then
        status=down
        message="Resource or backup checks failed; inspect private server logs"
    fi
    if ! response=$(curl --config "$MONITOR_CURL_CONFIG" --silent --show-error --fail \
        --connect-timeout 5 --max-time 15 --get \
        --data-urlencode "status=$status" --data-urlencode "msg=$message") ||
        ! printf '%s' "$response" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'; then
        echo '{"event":"monitor_delivery_failed"}' >&2
        outcome=1
    fi
fi
exit "$outcome"
