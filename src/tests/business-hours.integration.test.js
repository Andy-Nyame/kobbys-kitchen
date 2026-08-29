import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeAdminBusinessHoursMutation } from "../lib/business-hours/admin-mutations.js";
import {
  BUSINESS_HOURS_ADMIN_ACTION,
  prepareBusinessHoursMutation,
} from "../lib/business-hours/admin-validation.js";
import { resolveBusinessHoursState } from "../lib/business-hours/state.js";

const integrationDescribe =
  process.env.RUN_DEVELOPMENT_INTEGRATION_TESTS === "1" ? describe : describe.skip;

class RollbackAcceptance extends Error {}

integrationDescribe("Development Neon physical business hours", () => {
  it("starts with the approved week and saves independently in a rollback-only transaction", async () => {
    const { verifyDevelopmentDatabase } = await import("../../scripts/database-safety.js");
    const { prisma } = await import("../lib/prisma.js");
    await verifyDevelopmentDatabase();

    const [original, onlineBefore, ordersBefore, paymentsBefore] = await Promise.all([
      prisma.businessHoursSetting.findUnique({
        where: { id: "default" },
        include: { windows: { orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] } },
      }),
      prisma.orderingSetting.findUnique({
        where: { id: "default" },
        include: { scheduleWindows: { orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] } },
      }),
      prisma.order.findMany({ orderBy: { id: "asc" }, select: { id: true, status: true, updatedAt: true } }),
      prisma.payment.findMany({ orderBy: { id: "asc" }, select: { id: true, status: true, updatedAt: true } }),
    ]);

    assert.ok(original);
    assert.deepEqual(original.windows.map((window) => window.dayOfWeek), [1, 3, 4, 5, 6, 7]);
    assert.ok(original.windows.every((window) =>
      window.startMinute === 960 && window.endMinute === 0 && window.endsNextDay
    ));
    assert.equal(
      resolveBusinessHoursState({ windows: original.windows, now: new Date("2026-09-01T18:00:00Z") }).restaurantOpen,
      false
    );

    const actor = await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true },
    });
    assert.ok(actor?.id, "A Development identity is required for acceptance.");

    await assert.rejects(
      prisma.$transaction(async (transaction) => {
        if (actor.role !== "ADMIN") {
          await transaction.user.update({ where: { id: actor.id }, data: { role: "ADMIN" } });
        }
        const transactionClient = {
          $transaction: async (callback) => callback(transaction),
        };
        const mutation = prepareBusinessHoursMutation({
          action: BUSINESS_HOURS_ADMIN_ACTION.SAVE,
          windows: [
            { dayOfWeek: 1, startTime: "16:00", endTime: "00:00" },
            { dayOfWeek: 3, startTime: "16:00", endTime: "00:00" },
            { dayOfWeek: 4, startTime: "16:00", endTime: "00:00" },
            { dayOfWeek: 5, startTime: "16:00", endTime: "00:00" },
            { dayOfWeek: 6, startTime: "16:00", endTime: "00:00" },
            { dayOfWeek: 7, startTime: "16:00", endTime: "00:00" },
          ],
        });
        await executeAdminBusinessHoursMutation({
          prismaClient: transactionClient,
          adminUserId: actor.id,
          mutation,
        });

        const [onlineAfter, ordersAfter, paymentsAfter] = await Promise.all([
          transaction.orderingSetting.findUnique({
            where: { id: "default" },
            include: { scheduleWindows: { orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] } },
          }),
          transaction.order.findMany({ orderBy: { id: "asc" }, select: { id: true, status: true, updatedAt: true } }),
          transaction.payment.findMany({ orderBy: { id: "asc" }, select: { id: true, status: true, updatedAt: true } }),
        ]);
        assert.deepEqual(onlineAfter, onlineBefore);
        assert.deepEqual(ordersAfter, ordersBefore);
        assert.deepEqual(paymentsAfter, paymentsBefore);
        throw new RollbackAcceptance("Rollback business-hours acceptance changes.");
      }, { maxWait: 10_000, timeout: 30_000 }),
      RollbackAcceptance
    );

    const restored = await prisma.businessHoursSetting.findUnique({
      where: { id: "default" },
      include: { windows: { orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] } },
    });
    assert.deepEqual(restored.windows, original.windows);
  });
});
