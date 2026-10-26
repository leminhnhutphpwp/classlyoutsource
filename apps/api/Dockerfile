# apps/api — Laravel 11 (production) trên FrankenPHP (Caddy + PHP, 1 container).
# Build từ ROOT monorepo:  docker build -f apps/api/Dockerfile -t classly-api apps/api

# ---------- Stage 1: vendor (composer, no-dev) ----------
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
# --ignore-platform-reqs: stage này CHỈ tải package về, không chạy code.
# Image composer:2 không có ext-intl/ext-gd nên nếu kiểm tra platform ở đây thì
# build đứt ngay ("filament/support requires ext-intl") dù runtime stage bên dưới
# đã cài đủ. composer.lock ghim sẵn phiên bản nên bỏ kiểm tra KHÔNG làm đổi kết quả
# resolve. Extension thật được kiểm ở runtime stage — xem bước xác minh phía dưới.
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction \
      --ignore-platform-reqs
COPY . .
RUN composer dump-autoload --optimize --no-dev --classmap-authoritative

# ---------- Stage 2: runtime ----------
# PHẢI là php8.4: composer.json yêu cầu "php": "^8.4" (và README ghi PHP ≥8.4).
# Image php8.3 vẫn build được nhưng container CHẾT lúc chạy — vendor/composer/platform_check.php
# ném "Your Composer dependencies require a PHP version >= 8.4.1" ở mọi lệnh artisan,
# khiến queue worker restart vô hạn và migrate lúc boot thất bại âm thầm.
FROM dunglas/frankenphp:1-php8.4-alpine AS runtime

# Extension cho Laravel + Filament + intervention/image + excel + redis + queue
RUN install-php-extensions \
      pdo_mysql \
      gd \
      zip \
      bcmath \
      intl \
      exif \
      pcntl \
      opcache \
      redis

# Chốt lại rằng extension thật sự có mặt. Vì vendor stage đã bỏ qua kiểm tra platform,
# nếu thiếu extension ở đây thì lỗi sẽ chỉ lộ ra lúc CHẠY (trang admin trắng, ảnh không
# resize được) — rất khó truy. Fail ngay lúc build, ở đúng chỗ có thể sửa.
RUN for ext in pdo_mysql gd zip bcmath intl exif pcntl redis; do \
      php -m | grep -qix "$ext" || { echo "THIẾU extension PHP: $ext"; exit 1; }; \
    done

# Chốt phiên bản PHP khớp yêu cầu trong composer.json ("php": "^8.4").
# Nếu base image bị hạ xuống 8.3, không có bước này thì build vẫn XANH và lỗi chỉ lộ ra
# lúc chạy: queue worker restart vô hạn, migrate lúc boot thất bại âm thầm.
RUN php -r 'exit(version_compare(PHP_VERSION, "8.4.0", ">=") ? 0 : 1);' \
    || { echo "PHP $(php -r 'echo PHP_VERSION;') KHÔNG ĐẠT — composer.json yêu cầu ^8.4"; exit 1; }

WORKDIR /app
COPY --from=vendor /app /app

# Quyền cho storage + cache
RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Caddyfile phục vụ public/ trên :8000
COPY docker/Caddyfile /etc/frankenphp/Caddyfile
COPY docker/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

ENV SERVER_NAME=:8000
EXPOSE 8000

ENTRYPOINT ["entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/frankenphp/Caddyfile"]
