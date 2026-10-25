import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventorySchema1792906810809 implements MigrationInterface {
  name = 'InventorySchema1792906810809';

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
            CREATE TABLE "products" (
                "id" uuid NOT NULL,
                "name" character varying(200) NOT NULL,
                "initial_stock" integer NOT NULL,
                "stock" integer NOT NULL,
                "reserved" integer NOT NULL,
                "sold" integer NOT NULL,
                "version" integer NOT NULL,
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "chk_products_quantities_balance" CHECK ("stock" + "reserved" + "sold" = "initial_stock"),
                CONSTRAINT "chk_products_sold_non_negative" CHECK ("sold" >= 0),
                CONSTRAINT "chk_products_reserved_non_negative" CHECK ("reserved" >= 0),
                CONSTRAINT "chk_products_stock_non_negative" CHECK ("stock" >= 0),
                CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "reservations" (
                "id" uuid NOT NULL,
                "order_id" uuid NOT NULL,
                "product_id" uuid NOT NULL,
                "quantity" integer NOT NULL,
                "status" character varying(16) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_da95cef71b617ac35dc5bcda243" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_reservations_order_id" ON "reservations" ("order_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_reservations_product_id" ON "reservations" ("product_id")
        `);
    await queryRunner.query(`
            ALTER TABLE "reservations"
            ADD CONSTRAINT "FK_48d25c3eba71013de1994839f86" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "reservations" DROP CONSTRAINT "FK_48d25c3eba71013de1994839f86"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_reservations_product_id"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."uq_reservations_order_id"
        `);
    await queryRunner.query(`
            DROP TABLE "reservations"
        `);
    await queryRunner.query(`
            DROP TABLE "products"
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
