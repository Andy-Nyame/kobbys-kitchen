CREATE TYPE "CampaignPopupFrequency" AS ENUM (
  'EVERY_VISIT',
  'ONCE_PER_SESSION',
  'ONCE_PER_CUSTOMER'
);

CREATE TABLE "campaigns" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "headline" TEXT,
  "altText" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "desktopImagePath" TEXT NOT NULL,
  "desktopImageWidth" INTEGER NOT NULL,
  "desktopImageHeight" INTEGER NOT NULL,
  "mobileImagePath" TEXT,
  "mobileImageWidth" INTEGER,
  "mobileImageHeight" INTEGER,
  "destinationPath" TEXT NOT NULL,
  "slideshowEnabled" BOOLEAN NOT NULL DEFAULT false,
  "popupEnabled" BOOLEAN NOT NULL DEFAULT false,
  "popupFrequency" "CampaignPopupFrequency" NOT NULL DEFAULT 'ONCE_PER_SESSION',
  "dismissible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaigns_priority_nonnegative_check" CHECK ("priority" >= 0),
  CONSTRAINT "campaigns_desktop_dimensions_positive_check" CHECK (
    "desktopImageWidth" > 0 AND "desktopImageHeight" > 0
  ),
  CONSTRAINT "campaigns_mobile_creative_complete_check" CHECK (
    ("mobileImagePath" IS NULL AND "mobileImageWidth" IS NULL AND "mobileImageHeight" IS NULL)
    OR
    ("mobileImagePath" IS NOT NULL AND "mobileImageWidth" > 0 AND "mobileImageHeight" > 0)
  ),
  CONSTRAINT "campaigns_schedule_valid_check" CHECK (
    "startAt" IS NULL OR "endAt" IS NULL OR "startAt" <= "endAt"
  )
);

CREATE INDEX "campaigns_active_startAt_endAt_priority_idx"
ON "campaigns"("active", "startAt", "endAt", "priority");

CREATE INDEX "campaigns_slideshowEnabled_active_priority_idx"
ON "campaigns"("slideshowEnabled", "active", "priority");

CREATE INDEX "campaigns_popupEnabled_active_priority_idx"
ON "campaigns"("popupEnabled", "active", "priority");

INSERT INTO "campaigns" (
  "id",
  "name",
  "headline",
  "altText",
  "active",
  "startAt",
  "endAt",
  "priority",
  "desktopImagePath",
  "desktopImageWidth",
  "desktopImageHeight",
  "destinationPath",
  "slideshowEnabled",
  "popupEnabled",
  "popupFrequency",
  "dismissible",
  "updatedAt"
) VALUES (
  '52f3d24b-01c9-4f9a-8992-54f21b3d2647',
  'Online Order Challenge',
  'Order Online. Win Big!',
  'Order Online. Win Big! Kobby''s Kitchen Online Order Challenge ending 26 September 2026.',
  true,
  CURRENT_TIMESTAMP,
  '2026-09-26 23:59:59.999',
  100,
  '/images/promotions/online-order-challenge.png',
  1254,
  1254,
  '/menu',
  true,
  true,
  'ONCE_PER_SESSION',
  true,
  CURRENT_TIMESTAMP
);
