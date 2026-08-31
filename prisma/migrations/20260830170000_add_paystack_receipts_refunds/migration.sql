CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'NEEDS_ATTENTION', 'PROCESSED', 'FAILED');

ALTER TABLE "payment_attempts"
ADD COLUMN "authorizationUrl" TEXT,
ADD COLUMN "providerStatus" TEXT,
ADD COLUMN "providerTransactionId" TEXT,
ADD COLUMN "initializedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "payment_attempts_providerTransactionId_key"
ON "payment_attempts"("providerTransactionId");

CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "paymentId" UUID NOT NULL,
    "issuedById" UUID,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "receipts_receiptNumber_key" ON "receipts"("receiptNumber");
CREATE UNIQUE INDEX "receipts_paymentId_key" ON "receipts"("paymentId");
CREATE INDEX "receipts_issuedById_idx" ON "receipts"("issuedById");

ALTER TABLE "receipts"
ADD CONSTRAINT "receipts_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "receipts"
ADD CONSTRAINT "receipts_issuedById_fkey"
FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRefundId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "initiatedById" UUID NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refunds_amount_nonnegative_check" CHECK ("amountMinor" >= 0),
    CONSTRAINT "refunds_currency_check" CHECK ("currency" = 'GHS'),
    CONSTRAINT "refunds_reason_length_check" CHECK (char_length("reason") BETWEEN 1 AND 160)
);

CREATE UNIQUE INDEX "refunds_paymentId_key" ON "refunds"("paymentId");
CREATE UNIQUE INDEX "refunds_providerRefundId_key" ON "refunds"("providerRefundId");
CREATE INDEX "refunds_status_createdAt_idx" ON "refunds"("status", "createdAt");
CREATE INDEX "refunds_initiatedById_idx" ON "refunds"("initiatedById");

ALTER TABLE "refunds"
ADD CONSTRAINT "refunds_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "refunds"
ADD CONSTRAINT "refunds_initiatedById_fkey"
FOREIGN KEY ("initiatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
