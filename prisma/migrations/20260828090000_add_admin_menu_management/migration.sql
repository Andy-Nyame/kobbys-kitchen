-- Extend catalogue metadata without replacing existing categories or items.
ALTER TABLE "menu_categories"
  ADD COLUMN "description" TEXT;

ALTER TABLE "menu_items"
  ADD COLUMN "preparationMinutes" INTEGER,
  ADD COLUMN "dietaryNotes" TEXT;

CREATE TABLE "menu_item_images" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "menuItemId" UUID NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "altText" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "menu_item_images_pkey" PRIMARY KEY ("id")
);

-- Preserve current catalogue imagery as the first primary gallery image.
INSERT INTO "menu_item_images" (
  "menuItemId",
  "imageUrl",
  "altText",
  "sortOrder",
  "isPrimary"
)
SELECT
  "id",
  "imagePath",
  COALESCE(NULLIF(BTRIM("imageAlt"), ''), "name" || ' from Kobby''s Kitchen'),
  0,
  true
FROM "menu_items"
WHERE "imagePath" IS NOT NULL
  AND BTRIM("imagePath") <> '';

CREATE UNIQUE INDEX "menu_item_images_menuItemId_imageUrl_key"
  ON "menu_item_images"("menuItemId", "imageUrl");

CREATE INDEX "menu_item_images_menuItemId_sortOrder_idx"
  ON "menu_item_images"("menuItemId", "sortOrder");

CREATE UNIQUE INDEX "menu_item_images_one_primary_per_item"
  ON "menu_item_images"("menuItemId")
  WHERE "isPrimary" = true;

ALTER TABLE "menu_item_images"
  ADD CONSTRAINT "menu_item_images_menuItemId_fkey"
  FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "menu_categories"
  ADD CONSTRAINT "menu_categories_sort_order_nonnegative"
  CHECK ("sortOrder" >= 0);

ALTER TABLE "menu_items"
  ADD CONSTRAINT "menu_items_sort_order_nonnegative"
  CHECK ("sortOrder" >= 0),
  ADD CONSTRAINT "menu_items_preparation_minutes_valid"
  CHECK ("preparationMinutes" IS NULL OR ("preparationMinutes" >= 0 AND "preparationMinutes" <= 1440));

ALTER TABLE "menu_item_images"
  ADD CONSTRAINT "menu_item_images_sort_order_nonnegative"
  CHECK ("sortOrder" >= 0);
