ALTER TYPE "PaymentMethod" ADD VALUE 'PROMO';

CREATE TYPE "PromoDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
CREATE TYPE "PromoRedemptionStatus" AS ENUM ('RESERVED', 'REDEEMED', 'RELEASED');

ALTER TABLE "orders"
  ADD COLUMN "discountMinor" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "promoCodeId" UUID,
  ADD COLUMN "promoCodeSnapshot" TEXT,
  ADD COLUMN "promoDiscountTypeSnapshot" "PromoDiscountType",
  ADD COLUMN "promoDiscountValueSnapshot" INTEGER;

CREATE TABLE "promo_codes" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT,
  "discountType" "PromoDiscountType" NOT NULL,
  "discountValue" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "minimumSubtotalMinor" INTEGER,
  "maximumDiscountMinor" INTEGER,
  "totalUsageLimit" INTEGER,
  "perCustomerUsageLimit" INTEGER,
  "restrictedCustomerId" UUID,
  "claimedUsageCount" INTEGER NOT NULL DEFAULT 0,
  "redeemedUsageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "promo_codes_code_canonical_check" CHECK ("code" = UPPER(BTRIM("code")) AND "code" ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  CONSTRAINT "promo_codes_discount_value_check" CHECK (
    ("discountType" = 'PERCENTAGE' AND "discountValue" BETWEEN 1 AND 10000)
    OR ("discountType" = 'FIXED_AMOUNT' AND "discountValue" > 0)
  ),
  CONSTRAINT "promo_codes_percentage_max_check" CHECK ("discountType" = 'PERCENTAGE' OR "maximumDiscountMinor" IS NULL),
  CONSTRAINT "promo_codes_money_nonnegative_check" CHECK (
    ("minimumSubtotalMinor" IS NULL OR "minimumSubtotalMinor" >= 0)
    AND ("maximumDiscountMinor" IS NULL OR "maximumDiscountMinor" > 0)
  ),
  CONSTRAINT "promo_codes_usage_limits_positive_check" CHECK (
    ("totalUsageLimit" IS NULL OR "totalUsageLimit" > 0)
    AND ("perCustomerUsageLimit" IS NULL OR "perCustomerUsageLimit" > 0)
  ),
  CONSTRAINT "promo_codes_usage_counts_valid_check" CHECK (
    "claimedUsageCount" >= 0
    AND "redeemedUsageCount" >= 0
    AND "redeemedUsageCount" <= "claimedUsageCount"
  ),
  CONSTRAINT "promo_codes_schedule_valid_check" CHECK (
    "startAt" IS NULL OR "endAt" IS NULL OR "startAt" <= "endAt"
  )
);

CREATE TABLE "promo_redemptions" (
  "id" UUID NOT NULL,
  "promoCodeId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "status" "PromoRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
  "redeemedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "promo_redemptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "promo_redemptions_lifecycle_check" CHECK (
    ("status" = 'RESERVED' AND "redeemedAt" IS NULL AND "releasedAt" IS NULL)
    OR ("status" = 'REDEEMED' AND "redeemedAt" IS NOT NULL AND "releasedAt" IS NULL)
    OR ("status" = 'RELEASED' AND "releasedAt" IS NOT NULL)
  )
);

CREATE TABLE "promo_customer_usage" (
  "id" UUID NOT NULL,
  "promoCodeId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "claimedUsageCount" INTEGER NOT NULL DEFAULT 0,
  "redeemedUsageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "promo_customer_usage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "promo_customer_usage_counts_valid_check" CHECK (
    "claimedUsageCount" >= 0
    AND "redeemedUsageCount" >= 0
    AND "redeemedUsageCount" <= "claimedUsageCount"
  )
);

CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");
CREATE INDEX "promo_codes_active_startAt_endAt_idx" ON "promo_codes"("active", "startAt", "endAt");
CREATE INDEX "promo_codes_restrictedCustomerId_active_idx" ON "promo_codes"("restrictedCustomerId", "active");
CREATE UNIQUE INDEX "promo_redemptions_orderId_key" ON "promo_redemptions"("orderId");
CREATE INDEX "promo_redemptions_promoCodeId_status_idx" ON "promo_redemptions"("promoCodeId", "status");
CREATE INDEX "promo_redemptions_promoCodeId_userId_status_idx" ON "promo_redemptions"("promoCodeId", "userId", "status");
CREATE INDEX "promo_redemptions_userId_createdAt_idx" ON "promo_redemptions"("userId", "createdAt");
CREATE UNIQUE INDEX "promo_customer_usage_promoCodeId_userId_key" ON "promo_customer_usage"("promoCodeId", "userId");
CREATE INDEX "promo_customer_usage_userId_idx" ON "promo_customer_usage"("userId");
CREATE INDEX "orders_promoCodeId_idx" ON "orders"("promoCodeId");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_promoCodeId_fkey"
  FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "promo_codes"
  ADD CONSTRAINT "promo_codes_restrictedCustomerId_fkey"
  FOREIGN KEY ("restrictedCustomerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promo_redemptions"
  ADD CONSTRAINT "promo_redemptions_promoCodeId_fkey"
  FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promo_redemptions"
  ADD CONSTRAINT "promo_redemptions_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promo_redemptions"
  ADD CONSTRAINT "promo_redemptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promo_customer_usage"
  ADD CONSTRAINT "promo_customer_usage_promoCodeId_fkey"
  FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promo_customer_usage"
  ADD CONSTRAINT "promo_customer_usage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
