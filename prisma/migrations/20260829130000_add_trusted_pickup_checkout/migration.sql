ALTER TABLE "orders"
  ADD COLUMN "note" TEXT;

DROP INDEX "orders_idempotencyKey_key";

CREATE UNIQUE INDEX "orders_userId_idempotencyKey_key"
  ON "orders"("userId", "idempotencyKey");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_note_length"
  CHECK ("note" IS NULL OR char_length("note") <= 500);

ALTER TABLE "order_items"
  ADD COLUMN "priceTier" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "order_items_price_tier_nonnegative"
  CHECK ("priceTier" >= 0);
