-- CreateEnum
CREATE TYPE "OrderingOverrideMode" AS ENUM ('NONE', 'OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "ordering_settings"
ADD COLUMN "emergencyPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "overrideMode" "OrderingOverrideMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN "overrideExpiresAt" TIMESTAMP(3),
ADD COLUMN "changedById" UUID;

-- CreateTable
CREATE TABLE "ordering_schedule_windows" (
    "id" UUID NOT NULL,
    "orderingSettingId" TEXT NOT NULL DEFAULT 'default',
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordering_schedule_windows_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ordering_schedule_windows_day_check"
      CHECK ("dayOfWeek" BETWEEN 1 AND 7),
    CONSTRAINT "ordering_schedule_windows_start_check"
      CHECK ("startMinute" BETWEEN 0 AND 1439),
    CONSTRAINT "ordering_schedule_windows_end_check"
      CHECK ("endMinute" BETWEEN 1 AND 1440),
    CONSTRAINT "ordering_schedule_windows_range_check"
      CHECK ("startMinute" < "endMinute"),
    CONSTRAINT "ordering_schedule_windows_sort_order_check"
      CHECK ("sortOrder" >= 0)
);

-- CreateIndex
CREATE INDEX "ordering_settings_changedById_idx"
ON "ordering_settings"("changedById");

-- CreateIndex
CREATE UNIQUE INDEX "ordering_schedule_windows_orderingSettingId_dayOfWeek_startMinute_endMinute_key"
ON "ordering_schedule_windows"("orderingSettingId", "dayOfWeek", "startMinute", "endMinute");

-- CreateIndex
CREATE INDEX "ordering_schedule_windows_orderingSettingId_dayOfWeek_sortOrder_idx"
ON "ordering_schedule_windows"("orderingSettingId", "dayOfWeek", "sortOrder");

-- AddForeignKey
ALTER TABLE "ordering_settings"
ADD CONSTRAINT "ordering_settings_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordering_schedule_windows"
ADD CONSTRAINT "ordering_schedule_windows_orderingSettingId_fkey"
FOREIGN KEY ("orderingSettingId") REFERENCES "ordering_settings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
