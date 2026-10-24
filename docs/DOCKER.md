# Docker و Environment

این سند توضیح می‌دهد پوشه‌ی `docker/` چه کاری می‌کند، چطور اجرا می‌شود و هر متغیر محیطی کجا استفاده می‌شود.

## 1. وضعیت فعلی

در حال حاضر Docker فقط **زیرساخت** را بالا می‌آورد. بک‌اند (NestJS) و فرانت‌اند (Next.js) روی ماشین توسعه‌دهنده با `pnpm` اجرا می‌شوند.

> پیش از تحویل نهایی، سرویس‌های Order و Inventory و فرانت باید داخل compose هم اضافه شوند تا با یک دستور بالا بیایند. بخش 8 را ببین.

## 2. ساختار پوشه

```text
docker/
├── .dockerignore
├── .env.example
└── compose.yml
```

## 3. سرویس‌ها

| سرویس | ایمیج | پورت host | کاربرد |
|---|---|---|---|
| `postgres` | `postgres:17-alpine` | `15432` | دیتابیس Order Service (`POSTGRES_DB`) |
| `postgres-inventory` | `postgres:17-alpine` | `15433` | دیتابیس Inventory Service (`INVENTORY_DB`) |
| `redis` | `redis:8-alpine` | `6379` | Rate Limit مشترک (Throttler) و کش |
| `rabbitmq` | `rabbitmq:4-management-alpine` | `5672` (AMQP)، `15672` (پنل مدیریت) | Message Broker بین Order و Inventory |

دو دیتابیس عمداً روی دو کانتینر جدا هستند تا الزام چالش (هر سرویس DB مجزا و بدون اشتراک) رعایت شود و به اسکریپت اضافه‌ای هم نیاز نباشد.

پنل RabbitMQ: <http://localhost:15672> (کاربر و رمز از `.env`).

## 4. اجرا

از داخل پوشه‌ی `docker/`:

```bash
cp .env.example .env     # فقط بار اول
docker compose up -d     # بالا آوردن
docker compose ps        # وضعیت سرویس‌ها
docker compose logs -f   # لاگ‌ها
docker compose down      # خاموش کردن (داده‌ها می‌مانند)
docker compose down -v   # خاموش کردن + پاک کردن داده‌ها (reset کامل)
```

## 5. متغیرهای محیطی (`.env`)

```dotenv
# App
NODE_ENV=development

# Backend
PORT_ORDER=3001
PORT_INVENTORY=3002
JWT_SECRET=change_me

# Frontend
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001

# Database (کاربر و رمز مشترک)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Order DB
POSTGRES_HOST=localhost
POSTGRES_PORT=15432
POSTGRES_DB=order_db

# Inventory DB
INVENTORY_DB_HOST=localhost
INVENTORY_DB_PORT=15433
INVENTORY_DB=inventory_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

| گروه | چه کسی می‌خواند |
|---|---|
| `POSTGRES_*` | Order Service و compose (سرویس `postgres`) |
| `INVENTORY_DB*` | Inventory Service و compose (سرویس `postgres-inventory`) |
| `REDIS_*` | هر دو سرویس (Throttler) |
| `RABBITMQ_*` | هر دو سرویس و compose |
| `JWT_SECRET` | هر دو سرویس؛ **باید یکسان باشد** (HS256) |
| `NEXT_PUBLIC_*` | فقط فرانت (در مرورگر قابل مشاهده است، secret نگذار) |

نکته‌ی مهم: چون اپ‌ها فعلاً بیرون از Docker اجرا می‌شوند، host همه‌ی سرویس‌ها `localhost` است. وقتی اپ‌ها داخل compose بروند، host باید نام سرویس باشد (`postgres`، `postgres-inventory`، `redis`، `rabbitmq`) و پورت‌ها پورت داخلی (`5432` و ...).

## 6. نکات و خطاهای رایج

- **`POSTGRES_DB` اعمال نشد:** نام دیتابیس فقط هنگام ساخته شدن اولین volume اعمال می‌شود. اگر قبلاً با نام دیگری بالا آمده، `docker compose down -v` بزن و دوباره اجرا کن.
- **خطای اشغال بودن پورت:** اگر Postgres یا Redis محلی روی همان پورت‌ها اجرا است، پورت host را در `compose.yml` عوض کن (سمت چپ `:`) و `.env` را هماهنگ کن.
- **اتصال به RabbitMQ رد می‌شود:** چند ثانیه صبر کن تا کامل بالا بیاید؛ وضعیت را با `docker compose logs rabbitmq` ببین.
- **`.env` را commit نکن.** فقط `.env.example` در Git باشد.

## 7. اتصال از اپ‌ها

- Order Service → `localhost:15432` / `order_db` + RabbitMQ + Redis
- Inventory Service → `localhost:15433` / `inventory_db` + RabbitMQ + Redis
- دو سرویس **مستقیم** به دیتابیس هم وصل نمی‌شوند و ارتباط دامنه‌ای فقط از RabbitMQ است.

## 8. تغییرات لازم قبل از تحویل

چالش می‌گوید ارزیاب همه‌چیز را با یک دستور بالا می‌آورد، با `--scale order=3` تست می‌کند و Inventory نباید پورت host داشته باشد. پس قبل از تحویل:

1. Dockerfile برای `api` (دو سرویس Order و Inventory) و `web` اضافه شود.
2. سرویس‌های `order`، `inventory` و `web` به compose اضافه شوند. `order` نباید پورت ثابت host داشته باشد، و `inventory` نباید اصلاً `ports` داشته باشد.
3. برای `--scale order=3` یک load balancer (مثلاً nginx) جلوی Order قرار گیرد.
4. به سرویس‌ها `healthcheck` و `depends_on: condition: service_healthy` اضافه شود تا شروع کمتر از ۲ دقیقه باشد.
5. پورت‌های host مربوط به Postgres، Redis و RabbitMQ (و پنل مدیریت) حذف یا محدود شوند.
6. دستور اجرا (`docker compose up --build` یا `make up-rabbit`) در `README.md` ثبت شود.
