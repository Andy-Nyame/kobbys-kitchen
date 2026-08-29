CREATE TABLE "business_hours_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "changedById" UUID,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_hours_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_hours_windows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "businessHoursSettingId" TEXT NOT NULL DEFAULT 'default',
  "dayOfWeek" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "endsNextDay" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_hours_windows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_hours_windows_day_valid" CHECK ("dayOfWeek" BETWEEN 1 AND 7),
  CONSTRAINT "business_hours_windows_start_valid" CHECK ("startMinute" BETWEEN 0 AND 1439),
  CONSTRAINT "business_hours_windows_end_valid" CHECK ("endMinute" BETWEEN 0 AND 1439),
  CONSTRAINT "business_hours_windows_range_valid" CHECK (
    (NOT "endsNextDay" AND "startMinute" < "endMinute")
    OR ("endsNextDay" AND "endMinute" < "startMinute")
  ),
  CONSTRAINT "business_hours_windows_sort_valid" CHECK ("sortOrder" >= 0)
);

CREATE INDEX "business_hours_settings_changedById_idx"
  ON "business_hours_settings"("changedById");

CREATE UNIQUE INDEX "business_hours_windows_businessHoursSettingId_dayOfWeek_startMinute_endMinute_endsNextDay_key"
  ON "business_hours_windows"("businessHoursSettingId", "dayOfWeek", "startMinute", "endMinute", "endsNextDay");

CREATE INDEX "business_hours_windows_businessHoursSettingId_dayOfWeek_sortOrder_idx"
  ON "business_hours_windows"("businessHoursSettingId", "dayOfWeek", "sortOrder");

ALTER TABLE "business_hours_settings"
  ADD CONSTRAINT "business_hours_settings_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "business_hours_windows"
  ADD CONSTRAINT "business_hours_windows_businessHoursSettingId_fkey"
  FOREIGN KEY ("businessHoursSettingId") REFERENCES "business_hours_settings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "business_hours_settings" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP);

INSERT INTO "business_hours_windows" (
  "businessHoursSettingId",
  "dayOfWeek",
  "startMinute",
  "endMinute",
  "endsNextDay",
  "sortOrder",
  "updatedAt"
)
SELECT
  'default',
  day_of_week,
  960,
  0,
  true,
  0,
  CURRENT_TIMESTAMP
FROM (VALUES (1), (3), (4), (5), (6), (7)) AS configured_days(day_of_week);
