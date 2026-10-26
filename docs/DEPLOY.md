# Triển khai Production — Classly

> ⚠️ **Server đã có nginx trên host thì KHÔNG dùng runbook này.** Khi đó chạy
> `docker-compose.prod.yml` sau host **nginx** — xem [`DEPLOY-PROD.md`](DEPLOY-PROD.md).
> File này chỉ dành cho **server sạch mới** dùng Traefik + shared stack (`docker-compose.yml` +
> `docker-compose.shared.yml`). Tuyệt đối không chạy shared stack trên một host đã có web server.

Runbook deploy Classly lên server production (Docker, không cần Docker cho dev local).
Stack: **api** (Laravel/FrankenPHP) · **queue** (worker) · **app** (Next.js),
sau reverse-proxy **Traefik** (HTTPS Let's Encrypt) + **MySQL 8.4** + **Redis 7** dùng chung.

> Tham chiếu: `docker-compose.yml` (project), `docker-compose.shared.yml` (proxy/mysql/redis dùng chung),
> `.env.example`, `scripts/deploy.sh`.

---

## 0. Yêu cầu trước
- 1 VPS Linux có Docker + Docker Compose plugin.
- **DNS** trỏ về IP server (A record):
  - `api.classly.io.vn` → `app.classly.io.vn`.
- Cổng **80** và **443** mở (Let's Encrypt + HTTPS). Chạy `bash scripts/check-ports.sh` để kiểm cổng bận.
- Tài khoản SMTP (gửi mail), tài khoản ngân hàng + **SePay** (thu học phí/mua gói).

## 1. Điền secrets (`.env` gốc)
```bash
cp .env.example .env
```
Điền THẬT (không commit `.env`):
- `APP_KEY` → `docker run --rm classly-api:latest php artisan key:generate --show` (hoặc generate sau khi build).
- `JWT_SECRET` → `php artisan jwt:secret --show`. `HASHIDS_SALT` → chuỗi ngẫu nhiên dài.
- `DB_PASSWORD`, `REDIS_PASSWORD`, `MYSQL_ROOT_PASSWORD` → mật khẩu mạnh.
- `MAIL_*` (SMTP thật), `MAIL_FROM_ADDRESS`.
- `SEPAY_WEBHOOK_TOKEN` (từ dashboard SePay), `SEPAY_MATCH_PATTERN=CLS`.
- `LETSENCRYPT_EMAIL` (email nhận cảnh báo cert — **bắt buộc** cho ACME).
- `API_HOST`/`APP_HOST` + `API_PUBLIC_URL`/`APP_PUBLIC_URL` (đúng domain).
- Để **`CLIENT_SIGNATURE_ENABLED=false`** (xem §7 — bật sẽ vỡ FE khi chưa làm ký request).

## 2. Dịch vụ dùng chung (chạy 1 LẦN mỗi server)
```bash
docker compose -f docker-compose.shared.yml up -d      # proxy(Traefik+ACME) + mysql + redis
```
Traefik tự xin SSL Let's Encrypt cho các domain qua TLS-ALPN (cần :443 + DNS đúng), lưu ở volume `shared-proxy-certs`.

**Tạo database + user cho Classly** (mysql dùng chung, tạo 1 lần):
```bash
docker exec -i mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS classly CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'classly'@'%' IDENTIFIED BY '<DB_PASSWORD>';
GRANT ALL PRIVILEGES ON classly.* TO 'classly'@'%'; FLUSH PRIVILEGES;
SQL
```

## 3. Deploy project
```bash
bash scripts/check-ports.sh          # pre-flight cổng 80/443/3306
bash scripts/deploy.sh v1.0.0        # validate env → build → up → health
```
- `RUN_MIGRATIONS=true` trên container `api` → tự chạy `migrate --force` + cache config/route khi boot.
- `queue` chạy `queue:work` (KHÔNG migrate) — **bắt buộc** để mail/thông báo/**tính lương** hoạt động.

## 4. Seed lần đầu (PRODUCTION — KHÔNG dùng DemoDataSeeder)
```bash
docker compose exec api php artisan db:seed --class=DatabaseSeeder --force
# (`exec` takes the SERVICE name `api` — `classly-api` is the container name, not a service)
```
Seed: **gói dịch vụ** (Free/Pro/Trung tâm), **vai trò/quyền** (Shield), **admin** `admin@classly.io.vn`.
> ⚠️ **Tuyệt đối KHÔNG** chạy `DemoDataSeeder` trên prod (đó là dữ liệu demo: Cô Lan, trung tâm Sao Mai, tài khoản `demo1234`).
> Đổi mật khẩu admin ngay sau khi seed.

## 5. Smoke test prod
- `https://api.classly.io.vn/up` → 200 (cert hợp lệ, không cảnh báo).
- `https://app.classly.io.vn` → trang đăng nhập.
- Đăng ký thử 1 GV (`/register`) → login → tạo lớp.
- **Mua gói** (Pro/Trung tâm) → QR SePay → chuyển khoản test → webhook đối soát → gói kích hoạt (xem §7).

## 6. Cập nhật / redeploy
```bash
git pull && bash scripts/deploy.sh v1.0.1   # build image tag mới + up -d (rolling)
```

## 7. Điểm cần làm/kiểm trước khi bán (gaps)
- **💰 SePay end-to-end**: xác minh *mua gói → QR → webhook `SEPAY_WEBHOOK_TOKEN` → kích hoạt* với TIỀN THẬT.
  Route webhook phải công khai qua `api.classly.io.vn`; đối chiếu `SEPAY_MATCH_PATTERN`.
- **🔒 Client-signature**: `CLIENT_SIGNATURE_ENABLED=true` yêu cầu MỌI client gọi API trực tiếp
  phải **ký request** + đăng ký trong `config/fraud.php → allowed_clients`. App hiện **chưa ký** → bật sẽ 403 toàn bộ.
  Giữ `false` cho tới khi triển khai ký (đây là hardening, không phải blocker mở bán).
- **📩 Zalo/SMS**: nếu dùng thông báo Zalo OA/SMS, thêm key tương ứng (chưa có trong `.env.example`).
- **💾 Backup**: cron `mysqldump` DB `classly` + volume `classly-storage` (file upload) hằng ngày, offsite.
- **📊 Giám sát**: uptime (`/up`), error tracking (Sentry), log; theo dõi **chi phí AI** thật (pool org 1500/150).
- **🔑 Xoay secrets**: đổi mật khẩu admin, không để `APP_DEBUG=true`.

## 8. Cấu trúc tên (nhiều project chung 1 server)
Tài nguyên project mang prefix `classly-` (`classly-api/app/queue`, network `classly-net`,
volume `classly-storage`). Dịch vụ dùng chung giữ tên chung (`proxy`/`mysql`/`redis`, network `shared`).
FE trong Docker gọi backend qua **tên service** (`http://classly-api:8000`), không phải localhost.
