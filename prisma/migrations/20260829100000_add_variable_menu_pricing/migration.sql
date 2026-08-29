ALTER TABLE "menu_items"
ADD COLUMN "priceStepMinor" INTEGER;

UPDATE "menu_items"
SET "priceStepMinor" = CASE
  WHEN MOD("priceMinor", 1000) = 0 THEN 1000
  WHEN MOD("priceMinor", 1000) = 500 THEN 500
  ELSE NULL
END;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "menu_items"
    WHERE "priceStepMinor" IS NULL
  ) THEN
    RAISE EXCEPTION 'A menu item price does not match the approved GH₵5/GH₵10 backfill convention';
  END IF;
END $$;

ALTER TABLE "menu_items"
ALTER COLUMN "priceStepMinor" SET NOT NULL;

ALTER TABLE "menu_items"
ADD CONSTRAINT "menu_items_priceStepMinor_check"
CHECK ("priceStepMinor" > 0);
