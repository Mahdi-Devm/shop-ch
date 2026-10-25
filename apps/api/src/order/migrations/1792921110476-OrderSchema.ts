import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderSchema1792921110476 implements MigrationInterface {
  name = 'OrderSchema1792921110476';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "processed_events" (
                "consumer" character varying(64) NOT NULL,
                "event_id" uuid NOT NULL,
                "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_270df9e0013dff41bb91d555db4" PRIMARY KEY ("consumer", "event_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "outbox_events" (
                "event_id" uuid NOT NULL,
                "aggregate_id" character varying(64) NOT NULL,
                "aggregate_version" integer NOT NULL,
                "type" character varying(64) NOT NULL,
                "payload" jsonb NOT NULL,
                "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "exchange" character varying(128) NOT NULL,
                "routing_key" character varying(128) NOT NULL,
                "published_at" TIMESTAMP WITH TIME ZONE,
                "attempts" integer NOT NULL DEFAULT '0',
                "last_error" text,
                CONSTRAINT "PK_a82c439f9dab57e098be1d83291" PRIMARY KEY ("event_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_outbox_events_unpublished" ON "outbox_events" ("occurred_at")
            WHERE "published_at" IS NULL
        `);
    await queryRunner.query(`
            CREATE TABLE "idempotency_keys" (
                "user_id" character varying(64) NOT NULL,
                "idempotency_key" uuid NOT NULL,
                "order_id" uuid NOT NULL,
                "request_hash" character varying(64) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_7638cc418338a9a465d4423380a" PRIMARY KEY ("user_id", "idempotency_key")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_idempotency_keys_expires_at" ON "idempotency_keys" ("expires_at")
        `);
    await queryRunner.query(`
            CREATE TABLE "orders" (
                "id" uuid NOT NULL,
                "user_id" character varying(64) NOT NULL,
                "product_id" uuid NOT NULL,
                "quantity" integer NOT NULL,
                "status" character varying(16) NOT NULL,
                "version" integer NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "chk_orders_version_positive" CHECK ("version" > 0),
                CONSTRAINT "chk_orders_quantity_positive" CHECK ("quantity" > 0),
                CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_orders_user_id" ON "orders" ("user_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "product_stock_view" (
                "product_id" uuid NOT NULL,
                "stock" integer NOT NULL,
                "reserved" integer NOT NULL,
                "version" integer NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_e910bcf42f4c8afdf47e1adfc5b" PRIMARY KEY ("product_id")
            )
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TABLE "product_stock_view"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_orders_user_id"
        `);
    await queryRunner.query(`
            DROP TABLE "orders"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_idempotency_keys_expires_at"
        `);
    await queryRunner.query(`
            DROP TABLE "idempotency_keys"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_outbox_events_unpublished"
        `);
    await queryRunner.query(`
            DROP TABLE "outbox_events"
        `);
    await queryRunner.query(`
            DROP TABLE "processed_events"
        `);
  }
}
