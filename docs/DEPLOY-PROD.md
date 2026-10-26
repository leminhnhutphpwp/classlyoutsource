# Triển khai production sau nginx của host

Runbook cho server **đã có nginx trên host** giữ cổng 80/443 và SSL do certbot cấp. Đây là cách
chạy mặc định (`docker-compose.prod.yml`, `bash scripts/deploy.sh`). Server sạch muốn dùng Traefik
trong Docker thì đọc [`DEPLOY.md`](DEPLOY.md).

> ⚠️ **Không chạy `docker-compose.shared.yml` trên server kiểu này.** File đó bật Traefik bind
> :80/:443, giành cổng với nginx và làm sập mọi site nginx đang phục vụ.

---

## Kiến trúc

```
Internet → nginx (host, :443, certbot)
             ├── /                → 127.0.0.1:8102   app Next.js
             └── /api/sepay/      → 127.0.0.1:8101   webhook SePay

Docker network classly-net (nội bộ, không publish):
   classly-api ─┬─ classly-mysql
   classly-queue┘  classly-redis
   classly-app  ──► classly-api:8000   (BFF gọi nội bộ)
```

API Laravel không lộ ra Internet. App Next là BFF: `apps/app/src/lib/api-config.ts` đặt
`BASE_URL = ''` nên trình duyệt luôn gọi cùng origin, còn app gọi Laravel qua mạng Docker. nginx
chỉ mở thêm đường cho webhook SePay (bên thứ ba gọi từ ngoài vào).

Cổng mặc định: **8101** api, **8102** app, chỉ bind `127.0.0.1`. MySQL và Redis không publish.

---

## Bí danh SSH

Các lệnh dưới dùng bí danh `classly-prod`. Thêm vào `~/.ssh/config`:

```
Host classly-prod
  HostName <ip-server>
  User <user>
  IdentityFile ~/.ssh/<khoá của bạn>
  IdentitiesOnly yes
```

Đặt tên theo project chứ không theo máy, để khi chuyển server chỉ phải đổi `HostName`.

---

## Các bước

```bash
# 1. Đẩy mã nguồn (từ máy local)
rsync -az --exclude='.git' --exclude='node_modules' --exclude='vendor' \
      --exclude='.next' --exclude='*.sqlite' --exclude='storage/logs/*' \
      --exclude='scripts/logs' --exclude='.env*' \
      ./ classly-prod:/srv/classly/

# 2. Tạo .env production trên server từ .env.example: sinh secret bằng openssl, chmod 600,
#    KHÔNG commit. Cần APP_KEY, JWT_SECRET, HASHIDS_SALT, DB_PASSWORD, REDIS_PASSWORD,
#    MYSQL_ROOT_PASSWORD, và SEED_ADMIN_PASSWORD cho tài khoản quản trị đầu tiên.

# 3. Build + chạy
ssh classly-prod 'cd /srv/classly && docker compose -f docker-compose.prod.yml up -d --build'

# 4. Seed (vai trò, dữ liệu gốc, tài khoản quản trị)
ssh classly-prod 'cd /srv/classly && docker compose -f docker-compose.prod.yml exec api php artisan db:seed --force'

# 5. nginx + SSL (đổi app.example.com thành domain của bạn trong file mẫu)
sudo cp deploy/nginx/classly.example.conf /etc/nginx/sites-available/classly.conf
sudo ln -sfn /etc/nginx/sites-available/classly.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.example.com
```

Container `api` đặt `RUN_MIGRATIONS=true` nên tự chạy `migrate --force` khi khởi động. Container
`queue` đặt `RUN_MIGRATIONS=false`, chỉ `api` được migrate.

Reload nginx là bước cuối cùng, chỉ làm sau khi mọi container đã lên và đã thử qua loopback
(`curl http://127.0.0.1:8101/up`).

---

## Cấu hình cho bản demo

| Biến | Giá trị | Lý do |
|---|---|---|
| `MAIL_MAILER` | `log` | Chưa có SMTP thật, mail chỉ ghi log |
| `AI_ENABLED` | `false` | Tránh phát sinh chi phí AI |
| `CLIENT_SIGNATURE_ENABLED` | `false` | Bật sẽ trả 403 toàn bộ vì FE chưa ký request |
| `APP_DEBUG` | `false` | Không lộ stack trace |
| `SEPAY_WEBHOOK_TOKEN` | rỗng | Chưa nối SePay thật |

Khi vận hành thật: điền SMTP và `SEPAY_WEBHOOK_TOKEN`, đổi mật khẩu quản trị sau lần đăng nhập đầu.

---

## Vận hành

```bash
# Trạng thái
docker compose -f docker-compose.prod.yml ps

# Log
docker compose -f docker-compose.prod.yml logs -f api

# Cập nhật mã nguồn: rsync như bước 1, rồi
docker compose -f docker-compose.prod.yml up -d --build

# Sao lưu DB
docker exec classly-mysql mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" classly | gzip > backup.sql.gz
```

Nên thêm khi chạy thật: cron sao lưu database và volume `classly-storage`, giám sát uptime, và
theo dõi RAM (5 container dùng khoảng 800 MB).

---

## Lỗi đã gặp khi build lần đầu

| Lỗi | Triệu chứng | Cách đã sửa trong repo |
|---|---|---|
| Vendor stage thiếu `ext-intl`/`ext-gd` | `composer install` dừng vì thiếu extension | Thêm `--ignore-platform-reqs` cho vendor stage; runtime stage kiểm `php -m` để build hỏng ngay nếu thiếu extension thật |
| `AppServiceProvider` truy vấn DB lúc boot | `package:discover` chết vì chưa có DB | Bọc trong `try/catch` kèm `Schema::hasTable()` |
| Dockerfile ghim PHP 8.3 | Build xanh nhưng artisan bị `platform_check.php` chặn, queue khởi động lại liên tục | Nâng lên PHP 8.4 và thêm bước kiểm phiên bản trong Dockerfile |
| Healthcheck kế thừa từ image FrankenPHP | `classly-queue` báo unhealthy dù vẫn chạy job | Đặt healthcheck riêng cho queue |
| `--default-authentication-plugin` trong compose | MySQL 8.4 dừng với "unknown variable" | Bỏ cờ này, 8.4 đã mặc định `caching_sha2_password` |
