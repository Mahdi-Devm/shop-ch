# Docker و Environment

این سند توضیح می‌دهد پوشه‌ی `docker/` چه کاری می‌کند، چطور اجرا می‌شود و هر متغیر محیطی کجا استفاده می‌شود.

## 1. وضعیت فعلی

کل سیستم با یک دستور داخل Docker بالا می‌آید: زیرساخت (دو PostgreSQL، Redis، RabbitMQ)، سرویس‌های `order` و `inventory`، فرانت `web` و gateway ‏nginx. برای توسعه‌ی محلی با `pnpm` فقط زیرساخت با فایل `compose.dev.yml` و پورت‌های localhost بالا می‌آید.

## 2. ساختار پوشه

```text
docker/
├── .dockerignore
├── .env.example        # تنها نمونه‌ی env پروژه
├── compose.yml         # کل سیستم؛ بدون پورت host جز gateway
├── compose.dev.yml     # override: پورت‌های localhost برای زیرساخت در توسعه‌ی محلی
└── nginx/nginx.conf    # load balancer جلوی Replicaهای order و web

apps/api/Dockerfile     # یک ایمیج برای هر دو سرویس order و inventory
apps/web/Dockerfile     # Next.js standalone
Makefile                # در ریشه‌ی ریپو
scripts/load-test.mjs   # آزمون بار روی همه‌ی Replicaهای order
```

## 3. سرویس‌ها

| سرویس | ایمیج | پورت host | کاربرد |
|---|---|---|---|
| `gateway` | `nginx:1.29-alpine` | `${PUBLIC_PORT:-8080}` | تنها نقطه‌ی ورود: `/api`، `/auth`، `/health` → `order` و `/` → `web`؛ SSE بدون buffering |
| `order` | `flash-sale-api:local` | ندارد (قابل scale) | Order Service، `node dist/order/main.js` |
| `inventory` | `flash-sale-api:local` | **هیچ `ports`** | Inventory Service، `node dist/inventory/main.js` |
| `web` | `flash-sale-web:local` | ندارد | Next.js |
| `postgres` | `postgres:17-alpine` | ندارد | دیتابیس Order (`POSTGRES_DB`) |
| `postgres-inventory` | `postgres:17-alpine` | ندارد | دیتابیس Inventory (`INVENTORY_DB`) |
| `redis` | `redis:8-alpine` | ندارد | Rate limit مشترک و pub/sub برای SSE |
| `rabbitmq` | `rabbitmq:4-management-alpine` | ندارد | Message Broker |
| `load-test` | `flash-sale-api:local` | ندارد | فقط با profile `tools`؛ آزمون بار |

همه‌ی سرویس‌ها `healthcheck` دارند و وابستگی‌ها با `depends_on: condition: service_healthy` تعریف شده‌اند. Migrationها و seed هنگام بالا آمدن هر سرویس زیر `pg_advisory_lock` اجرا می‌شوند، پس چند Replica هم‌زمان مشکلی ندارند.

در `compose.dev.yml` پورت‌های زیرساخت فقط روی `127.0.0.1` باز می‌شوند: `15432` (Order DB)، `15433` (Inventory DB)، `6379`، `5672` و `15672` (پنل RabbitMQ).

## 4. اجرا

از ریشه‌ی ریپو:

```bash
make up-rabbit            # یا make up؛ اولین بار docker/.env را از .env.example می‌سازد
make up-scaled            # سه Replica از order (REPLICAS=3)
make ps                   # وضعیت
make logs                 # لاگ‌ها
make load-test            # ۲۰۰ خرید هم‌زمان روی همه‌ی Replicaهای order
make verify               # شمارش سفارش‌ها و موجودی مستقیم از دو دیتابیس
make down                 # خاموش کردن (داده‌ها می‌مانند)
make infra                # فقط زیرساخت با پورت localhost برای توسعه‌ی محلی
```

معادل بدون Makefile:

```bash
cp docker/.env.example docker/.env
docker compose -f docker/compose.yml up -d --build --wait --scale order=3
```

برنامه: <http://localhost:8080>

## 5. متغیرهای محیطی

**تنها فایل env پروژه `docker/.env` است.** Compose آن را خودکار می‌خواند (پوشه‌ی پروژه‌ی compose همان `docker/` است) و اپ‌ها هنگام اجرای محلی آن را از مسیر `../../docker/.env` بارگذاری می‌کنند (`apps/api/src/common/config/env-file-paths.ts`). داخل Docker، `compose.yml` host و پورت‌ها را به نام سرویس‌ها (`postgres`، `redis`، `rabbitmq`، …) بازنویسی می‌کند.

| متغیر | پیش‌فرض نمونه | چه کسی می‌خواند |
|---|---|---|
| `NODE_ENV`، `LOG_LEVEL` | `development`، `log` | هر دو سرویس |
| `PORT_ORDER`، `PORT_INVENTORY` | `3001`، `3002` | Order، Inventory |
| `JWT_SECRET` | باید عوض شود (حداقل ۱۶ کاراکتر) | هر دو سرویس؛ **باید یکسان باشد** |
| `JWT_EXPIRES_IN_SECONDS` | `3600` | Order |
| `CORS_ORIGIN` | `http://localhost:3000` | Order (اجرای محلی) |
| `THROTTLE_IP_LIMIT`، `THROTTLE_USER_LIMIT`، `THROTTLE_TTL_MS` | `10`، `5`، `1000` | Order |
| `RESERVATION_TTL_MS` | `300000` | Order (TTL صف انقضا) |
| `IDEMPOTENCY_KEY_TTL_HOURS` | `24` | Order |
| `ENABLE_DEV_PAYMENT` | `true` | Order و build فرانت؛ در production `false` |
| `OUTBOX_POLL_INTERVAL_MS`، `MESSAGE_MAX_RETRIES`، `MESSAGE_RETRY_DELAY_MS` | `200`، `5`، `1000` | هر دو سرویس |
| `NEXT_PUBLIC_APP_URL`، `NEXT_PUBLIC_API_URL` | `http://localhost:3000`، `http://localhost:3001` | فرانت در اجرای محلی (در Docker، API هم‌مبدأ است و `NEXT_PUBLIC_API_URL` خالی است) |
| `POSTGRES_USER`، `POSTGRES_PASSWORD` | `postgres` | هر دو دیتابیس |
| `POSTGRES_HOST`، `POSTGRES_PORT`، `POSTGRES_DB` | `localhost`، `15432`، `order_db` | Order |
| `INVENTORY_DB_HOST`، `INVENTORY_DB_PORT`، `INVENTORY_DB` | `localhost`، `15433`، `inventory_db` | Inventory |
| `REDIS_HOST`، `REDIS_PORT` | `localhost`، `6379` | Order |
| `RABBITMQ_USER`، `RABBITMQ_PASSWORD`، `RABBITMQ_URL` | `guest` | هر دو سرویس و compose |
| `PUBLIC_PORT`، `PUBLIC_URL` (اختیاری) | `8080`، `http://localhost:8080` | compose |

اپ‌ها env را هنگام شروع با `class-validator` اعتبارسنجی می‌کنند و با مقدار نامعتبر بالا نمی‌آیند؛ پیام خطا فقط نام متغیر را می‌گوید، نه مقدارش.

## 6. نکات و خطاهای رایج

- **`POSTGRES_DB` اعمال نشد:** نام دیتابیس فقط هنگام ساخته شدن اولین volume اعمال می‌شود. اگر قبلاً با نام دیگری بالا آمده، volume را با `docker compose -f docker/compose.yml down -v` پاک کنید. این کار **همه‌ی داده‌ها را حذف می‌کند**.
- **پورت 8080 اشغال است:** `PUBLIC_PORT=8081 make up`.
- **build پشت proxy با گواهی سازمانی:** Dockerfileها یک BuildKit secret اختیاری با شناسه‌ی `ca_bundle` می‌پذیرند: `docker build --secret id=ca_bundle,src=<ca.pem> …`. بدون آن هم build عادی کار می‌کند.
- **آزمون بار و Rate limit:** `make load-test` داخل شبکه‌ی Docker و مستقیم به Replicaهای `order` درخواست می‌زند و برای هر خریدار IP جدا در `X-Forwarded-For` می‌فرستد. از بیرون، nginx این هدر را بازنویسی می‌کند، پس همه‌ی درخواست‌های یک ماشین یک IP حساب می‌شوند.
- **`.env` را commit نکنید.** فقط `docker/.env.example` در Git است و `.env` در build context Docker هم نیست.
