-- Preserve the established application status name.
ALTER TYPE "OrderStatus" RENAME VALUE 'READY' TO 'READY_FOR_PICKUP';

-- One logical payment per order, with retry history stored separately.
CREATE UNIQUE INDEX "payments_orderId_key" ON "payments"("orderId");

ALTER TABLE "payment_attempts"
  ADD COLUMN "provider" TEXT NOT NULL,
  ADD COLUMN "amountMinor" INTEGER NOT NULL,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'GHS',
  ADD COLUMN "completedAt" TIMESTAMP(3);

-- Money and quantity invariants use integer minor units throughout.
ALTER TABLE "menu_items"
  ADD CONSTRAINT "menu_items_price_minor_nonnegative" CHECK ("priceMinor" >= 0);

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "reviews_featured_requires_approval" CHECK (NOT "featured" OR "status" = 'APPROVED');

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_subtotal_nonnegative" CHECK ("subtotalMinor" >= 0),
  ADD CONSTRAINT "orders_total_nonnegative" CHECK ("totalMinor" >= 0);

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_price_nonnegative" CHECK ("unitPriceMinor" >= 0),
  ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_items_line_total_valid" CHECK ("lineTotalMinor" = "unitPriceMinor" * "quantity");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_nonnegative" CHECK ("amountMinor" >= 0);

ALTER TABLE "payment_attempts"
  ADD CONSTRAINT "payment_attempts_amount_nonnegative" CHECK ("amountMinor" >= 0),
  ADD CONSTRAINT "payment_attempts_completion_valid" CHECK (
    ("status" IN ('CREATED', 'PENDING') AND "completedAt" IS NULL)
    OR ("status" IN ('SUCCEEDED', 'FAILED', 'ABANDONED') AND "completedAt" IS NOT NULL)
  );

-- A rejected or pending review can never remain featured, even if a future
-- trusted service changes the status without remembering the presentation flag.
CREATE FUNCTION enforce_review_feature_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" <> 'APPROVED' THEN
    NEW."featured" := false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_reviews_feature_state
BEFORE INSERT OR UPDATE OF "status", "featured" ON "reviews"
FOR EACH ROW EXECUTE FUNCTION enforce_review_feature_state();

INSERT INTO "ordering_settings" ("id", "acceptingOrders", "updatedAt")
VALUES ('default', false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
