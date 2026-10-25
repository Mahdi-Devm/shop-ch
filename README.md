# Flash Sale — 01-challenge-v3-sendaaa

A flash sale for one product (`11111111-1111-1111-1111-111111111111`, 500 units) that must survive a burst of 50,000+ purchase requests without overselling, and show every order's status live without a page refresh.

- **Backend:** TypeScript + NestJS, two independent services: **Order** and **Inventory** (`apps/api`, entry points `src/order/main.ts` and `src/inventory/main.ts`).
- **Broker:** **RabbitMQ** (topic exchanges, TTL + dead-letter queues, publisher confirms, manual ack).
- **Databases:** **PostgreSQL**, one per service (`order_db` and `inventory_db` on two separate containers).
- **Cache / shared state:** **Redis** (rate-limit counters shared by all replicas, SSE fan-out between replicas via pub/sub).
- **Frontend:** **Next.js** (`apps/web`). The challenge names Nuxt 3; **using Next.js was approved by the organizer.** The "Pinia or Composables" requirement maps to React hooks + Context, with no extra state library.
- **Gateway:** nginx in front of the Order replicas and the web app.

Design, trade-offs and the exact lock location are in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Run everything

Requirements: Docker with Compose v2 and `make`.

```bash
make up-rabbit          # or: make up
```

This copies `docker/.env.example` to `docker/.env` on first run, builds the images and waits until every service is healthy. Then open **http://localhost:8080** (log in with any username).

Three Order replicas behind the gateway:

```bash
make up-scaled                                              # REPLICAS=3 by default
# or directly:
docker compose -f docker/compose.yml up -d --build --scale order=3
```

Other targets: `make ps`, `make logs`, `make down` (keeps data), `make verify` (order counts per status and inventory levels straight from both databases).

`docker ps` shows only the gateway publishing a port; Inventory, Postgres, Redis and RabbitMQ are reachable only inside the Docker network.

Measured here: with images already built, `up --wait --scale order=3` on empty volumes reaches all-healthy in about 20 seconds. The first image build downloads dependencies and depends on your network.

### Load test against three replicas

```bash
make up-scaled
make load-test          # BUYERS=200 by default
make verify
```

The load test runs inside the Docker network, spreads 200 parallel purchases from 200 distinct users and IPs across every Order replica, waits until no order is Pending and fails if `Paid + Reserved > 500` or stock is negative. Run it three times to exhaust the stock: the third run reserves exactly the remaining units and cancels the rest.

### Paying for an order

The Payment service is design-only (see `ARCHITECTURE.md`). With `ENABLE_DEV_PAYMENT=true` (the default in `docker/.env.example`) the order page shows "successful payment" / "failed payment" buttons that publish `PaymentSucceeded` / `PaymentFailed` through the outbox, exactly as a real payment service would. Set it to `false` for anything that is not a demo.

## Local development

```bash
pnpm install                      # pnpm 11.25.0, see package.json devEngines
make infra                        # postgres x2, redis, rabbitmq with localhost ports
pnpm --filter api dev             # order service on :3001
pnpm --filter api dev:inventory   # inventory service on :3002 (second terminal)
pnpm --filter frontend dev        # web on :3000, uses NEXT_PUBLIC_API_URL
```

All services read the single env file `docker/.env`.

## Tests

```bash
make test                         # unit + e2e
pnpm --filter api test            # unit tests
pnpm --filter api test:e2e        # integration tests, needs Docker
pnpm --filter api lint && pnpm --filter frontend lint
```

The e2e suite uses **Testcontainers**: it starts real PostgreSQL ×2, Redis and RabbitMQ containers and runs Order and Inventory as separate Nest applications (several replicas each) in the test process. Nothing in the infrastructure is mocked except where a test deliberately simulates a crash.

| Required test | File |
|---|---|
| Concurrency: 50 buyers race for 30 units; 200 buyers on 3 Order replicas for 120 and 500 units | `apps/api/test/flash-sale-concurrency.e2e-spec.ts` |
| Idempotency: same key twice and five times in parallel → exactly one order | `apps/api/test/orders-api.e2e-spec.ts` |
| Outbox recovery: crash before publish, restart, event published and processed | `apps/api/test/outbox-recovery.e2e-spec.ts` |
| E2E: `POST /api/orders` → Inventory → SSE | `apps/api/test/purchase-flow.e2e-spec.ts` |

Also covered: missing / invalid / forged / `alg:none` JWT, per-IP and per-user rate limits shared across replicas, `quantity != 1`, invalid `Idempotency-Key`, duplicate `eventId` on both services, malformed messages to the dead-letter queue, reservation expiry with exact stock release, a late expiry after payment, owner-only reads.

## API

| Call | Notes |
|---|---|
| `POST /auth/login` | `{ "username", "password" }` → `{ access_token, userId }` (HS256, `JWT_SECRET`) |
| `POST /api/orders` | headers `Idempotency-Key` (UUID v4), `Authorization: Bearer`; body `{ productId, quantity: 1 }` → `201 { orderId, status: "Pending", version: 1 }`, `409 { code: "DUPLICATE_IDEMPOTENCY_KEY", orderId }`, `409 { code: "SOLD_OUT" }`, `429 { code: "RATE_LIMITED" }` + `Retry-After`, `401`, `400` |
| `GET /api/orders/:id` | owner only → `{ orderId, status, version, productId, quantity, createdAt }` |
| `GET /api/products/:id` | `{ id, stock, reserved }` from Order's local read model |
| `GET /api/orders/:id/events` | SSE; `Authorization: Bearer` or `?token=`; `data: {"status":"Reserved","version":2}` |
| `POST /api/dev/orders/:id/payment` | dev only, `{ outcome: "succeeded" \| "failed" }` |

Every error body carries a machine-readable `code`.

## Repository layout

```text
apps/api      NestJS: src/order, src/inventory, src/common (infrastructure only)
apps/web      Next.js: src/core/features/{auth,shop,orders}, pages in src/app
docker/       compose.yml, compose.dev.yml, nginx/, .env.example
docs/         backend, frontend and docker notes
scripts/      load-test.mjs
```

## AI-Usage Disclosure

This implementation was written by **Claude Code** (an Anthropic AI coding agent), working in this repository under the direction of the repository owner, who supplied the challenge brief, the architecture documents in `docs/`, the agent skills in `.agents/skills/` and the working rules (no code comments, small commits, verify before claiming). The owner made the product decision on how orders reach `Paid` / `Cancelled` while Payment is design-only.

The agent wrote the backend, frontend, Docker setup, tests and this documentation, ran every check it reports (lint, build, unit and e2e tests, the multi-replica load test and a browser walkthrough in Chromium) and fixed the failures those checks exposed. What was **not** verified: the first-time image build duration on a clean machine (builds here go through a sandbox proxy), and behaviour at the full 50,000-requests-in-10-seconds scale; the load tests exercised hundreds of concurrent purchases, not tens of thousands. Treat the code as reviewed by its author only until a human has reviewed it.
