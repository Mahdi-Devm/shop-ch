# api

NestJS backend of the flash sale: two independently deployed services built from this package.

| Service | Entry point | Database |
|---|---|---|
| Order | `src/order/main.ts` | `order_db` |
| Inventory | `src/inventory/main.ts` | `inventory_db` |

`src/common` holds shared infrastructure only (auth, throttling, RabbitMQ, outbox, inbox, health).

```bash
pnpm dev                 # order service with watch
pnpm dev:inventory       # inventory service with watch
pnpm build
pnpm start:order         # node dist/order/main
pnpm start:inventory     # node dist/inventory/main
pnpm seed                # idempotent seed of the flash sale product
pnpm lint
pnpm test                # unit
pnpm test:e2e            # integration with Testcontainers, needs Docker
```

Configuration is read from `docker/.env` (see `docs/DOCKER.md`). Architecture: `ARCHITECTURE.md` and `docs/BACKEND_ARCHITECTURE.md` at the repository root.
