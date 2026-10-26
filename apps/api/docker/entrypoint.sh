#!/bin/sh
set -e

# Chờ DB sẵn sàng rồi migrate + cache config (idempotent).
# Chỉ chạy ở container web (không chạy ở queue worker) — biến RUN_MIGRATIONS.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "==> php artisan migrate --force"
  php artisan migrate --force || echo "migrate skipped/failed (kiểm tra DB)"
fi

# Cache cho production (an toàn nếu chạy lại)
php artisan config:cache >/dev/null 2>&1 || true
php artisan route:cache  >/dev/null 2>&1 || true
php artisan event:cache  >/dev/null 2>&1 || true

# Link storage nếu chưa có
[ -L public/storage ] || php artisan storage:link >/dev/null 2>&1 || true

exec "$@"
