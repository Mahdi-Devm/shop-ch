COMPOSE := docker compose -f docker/compose.yml
COMPOSE_DEV := $(COMPOSE) -f docker/compose.dev.yml
REPLICAS ?= 3

.PHONY: env up up-rabbit up-scaled down logs ps infra load-test verify test

env:
	@test -f docker/.env || cp docker/.env.example docker/.env

up: env
	$(COMPOSE) up -d --build --wait

up-rabbit: up

up-scaled: env
	$(COMPOSE) up -d --build --wait --scale order=$(REPLICAS)

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

infra: env
	$(COMPOSE_DEV) up -d --wait postgres postgres-inventory redis rabbitmq

load-test:
	$(COMPOSE) --profile tools run --rm --no-deps load-test

verify:
	$(COMPOSE) exec -T postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c "SELECT status, count(*) FROM orders GROUP BY status ORDER BY status"'
	$(COMPOSE) exec -T postgres-inventory sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c "SELECT id, initial_stock, stock, reserved, sold FROM products"'

test:
	pnpm --filter api test
	pnpm --filter api test:e2e
