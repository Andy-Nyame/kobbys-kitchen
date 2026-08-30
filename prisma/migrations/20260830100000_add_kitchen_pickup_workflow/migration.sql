ALTER TYPE "AppRole" ADD VALUE IF NOT EXISTS 'CHEF';

ALTER TABLE "orders"
ADD COLUMN "pickupCode" VARCHAR(4),
ADD COLUMN "pickupCodeGeneratedAt" TIMESTAMP(3),
ADD COLUMN "pickedUpAt" TIMESTAMP(3),
ADD COLUMN "pickupCompletedById" UUID;

ALTER TABLE "payments"
ADD COLUMN "cashReceivedById" UUID;

CREATE UNIQUE INDEX "orders_pickupCode_key" ON "orders"("pickupCode");
CREATE INDEX "orders_pickupCompletedById_idx" ON "orders"("pickupCompletedById");
CREATE INDEX "payments_cashReceivedById_idx" ON "payments"("cashReceivedById");

ALTER TABLE "orders"
ADD CONSTRAINT "orders_pickupCompletedById_fkey"
FOREIGN KEY ("pickupCompletedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments"
ADD CONSTRAINT "payments_cashReceivedById_fkey"
FOREIGN KEY ("cashReceivedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orders"
ADD CONSTRAINT "orders_pickup_code_format_check"
CHECK (
  "pickupCode" IS NULL OR (
    char_length("pickupCode") = 4
    AND "pickupCode" ~ '^[A-HJ-NP-Z0-9]{4}$'
    AND regexp_replace("pickupCode", '[0-9]', '', 'g') ~ '^[A-HJ-NP-Z]$'
    AND regexp_replace("pickupCode", '[A-HJ-NP-Z]', '', 'g') ~ '^[0-9]{3}$'
  )
);

ALTER TABLE "orders"
ADD CONSTRAINT "orders_active_pickup_code_status_check"
CHECK ("pickupCode" IS NULL OR "status" = 'READY_FOR_PICKUP');

ALTER TABLE "orders"
ADD CONSTRAINT "orders_pickup_completion_state_check"
CHECK (
  ("pickedUpAt" IS NULL AND "pickupCompletedById" IS NULL)
  OR
  ("pickedUpAt" IS NOT NULL AND "pickupCompletedById" IS NOT NULL AND "status" = 'COMPLETED')
);
