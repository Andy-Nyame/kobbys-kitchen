ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED' BEFORE 'PREPARING';

ALTER TABLE "orders"
ADD COLUMN "cancelledById" UUID,
ADD COLUMN "cancellationReason" TEXT;

CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "fromStatus" "OrderStatus" NOT NULL,
    "toStatus" "OrderStatus" NOT NULL,
    "changedById" UUID NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "orders_cancelledById_idx" ON "orders"("cancelledById");
CREATE INDEX "order_status_history_orderId_changedAt_idx" ON "order_status_history"("orderId", "changedAt");
CREATE INDEX "order_status_history_changedById_changedAt_idx" ON "order_status_history"("changedById", "changedAt");

ALTER TABLE "orders"
ADD CONSTRAINT "orders_cancelledById_fkey"
FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_status_history"
ADD CONSTRAINT "order_status_history_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_status_history"
ADD CONSTRAINT "order_status_history_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orders"
ADD CONSTRAINT "orders_cancellation_reason_length_check"
CHECK ("cancellationReason" IS NULL OR char_length("cancellationReason") <= 160);
