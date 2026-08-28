import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeAdminOrderingMutation } from "../lib/ordering/admin-mutations.js";
import {
  ORDERING_ADMIN_ACTION,
  prepareOrderingAdminMutation,
} from "../lib/ordering/admin-validation.js";
import { resolveEffectiveOrderingState } from "../lib/ordering/state.js";

const integrationDescribe =
  process.env.RUN_DEVELOPMENT_INTEGRATION_TESTS === "1" ? describe : describe.skip;

class RollbackAcceptance extends Error {}

function stableConfiguration(setting) {
  return JSON.stringify({
    id: setting.id,
    acceptingOrders: setting.acceptingOrders,
    emergencyPaused: setting.emergencyPaused,
    overrideMode: setting.overrideMode,
    overrideExpiresAt: setting.overrideExpiresAt,
    changedById: setting.changedById,
    updatedAt: setting.updatedAt,
    scheduleWindows: setting.scheduleWindows,
  });
}

integrationDescribe("development Neon admin ordering operations", () => {
  it("exercises operations in a rollback-only transaction without touching orders or payments", async () => {
    const { verifyDevelopmentDatabase } = await import("../../scripts/database-safety.js");
    const { prisma } = await import("../lib/prisma.js");
    await verifyDevelopmentDatabase();

    const actor = await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true },
    });
    assert.ok(actor?.id, "A Development identity is required for acceptance.");

    const original = await prisma.orderingSetting.findUnique({
      where: { id: "default" },
      include: {
        scheduleWindows: {
          orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
        },
      },
    });
    assert.ok(original, "The B2-B1 ordering setting must exist.");
    const originalConfiguration = stableConfiguration(original);
    const now = new Date("2026-08-31T10:30:00.000Z");

    await assert.rejects(
      prisma.$transaction(
        async (transaction) => {
          if (actor.role !== "ADMIN") {
            await transaction.user.update({
              where: { id: actor.id },
              data: { role: "ADMIN" },
            });
          }

          const transactionClient = {
            $transaction: async (callback) => callback(transaction),
          };
          const beforeOrders = await transaction.order.findMany({
            orderBy: { id: "asc" },
            select: { id: true, status: true, paymentStatus: true, updatedAt: true },
          });
          const beforePayments = await transaction.payment.findMany({
            orderBy: { id: "asc" },
            select: { id: true, status: true, updatedAt: true },
          });

          const schedule = prepareOrderingAdminMutation({
            action: ORDERING_ADMIN_ACTION.SAVE_SCHEDULE,
            windows: [
              { dayOfWeek: 1, startTime: "10:00", endTime: "12:00" },
              { dayOfWeek: 1, startTime: "13:00", endTime: "15:00" },
            ],
          });
          await executeAdminOrderingMutation({
            prismaClient: transactionClient,
            adminUserId: actor.id,
            mutation: schedule,
          });

          let setting = await transaction.orderingSetting.findUnique({
            where: { id: "default" },
            include: { scheduleWindows: true },
          });
          assert.equal(setting.scheduleWindows.length, 2);
          assert.equal(setting.changedById, actor.id);
          assert.equal(
            resolveEffectiveOrderingState({
              featureEnabled: true,
              setting,
              scheduleWindows: setting.scheduleWindows,
              now,
            }).acceptingOrders,
            true
          );

          assert.throws(
            () =>
              prepareOrderingAdminMutation({
                action: ORDERING_ADMIN_ACTION.SAVE_SCHEDULE,
                windows: [
                  { dayOfWeek: 1, startTime: "10:00", endTime: "13:00" },
                  { dayOfWeek: 1, startTime: "12:00", endTime: "14:00" },
                ],
              }),
            /overlap/
          );

          for (const mode of ["OPEN", "CLOSED"]) {
            await executeAdminOrderingMutation({
              prismaClient: transactionClient,
              adminUserId: actor.id,
              mutation: {
                action: ORDERING_ADMIN_ACTION.SET_OVERRIDE,
                data: { mode, expiresAt: null },
              },
            });
            setting = await transaction.orderingSetting.findUnique({
              where: { id: "default" },
              include: { scheduleWindows: true },
            });
            const state = resolveEffectiveOrderingState({
              featureEnabled: true,
              setting,
              scheduleWindows: setting.scheduleWindows,
              now,
            });
            assert.equal(state.acceptingOrders, mode === "OPEN");
            assert.equal(state.source, "OVERRIDE");
          }

          await executeAdminOrderingMutation({
            prismaClient: transactionClient,
            adminUserId: actor.id,
            mutation: { action: ORDERING_ADMIN_ACTION.CLEAR_OVERRIDE, data: {} },
          });
          setting = await transaction.orderingSetting.findUnique({
            where: { id: "default" },
            include: { scheduleWindows: true },
          });
          assert.equal(setting.overrideMode, "NONE");
          assert.equal(
            resolveEffectiveOrderingState({
              featureEnabled: true,
              setting,
              scheduleWindows: setting.scheduleWindows,
              now,
            }).source,
            "SCHEDULE"
          );

          await executeAdminOrderingMutation({
            prismaClient: transactionClient,
            adminUserId: actor.id,
            mutation: { action: ORDERING_ADMIN_ACTION.PAUSE, data: {} },
          });
          setting = await transaction.orderingSetting.findUnique({
            where: { id: "default" },
            include: { scheduleWindows: true },
          });
          assert.equal(
            resolveEffectiveOrderingState({
              featureEnabled: true,
              setting,
              scheduleWindows: setting.scheduleWindows,
              now,
            }).reason,
            "EMERGENCY_PAUSED"
          );

          await executeAdminOrderingMutation({
            prismaClient: transactionClient,
            adminUserId: actor.id,
            mutation: { action: ORDERING_ADMIN_ACTION.RESUME, data: {} },
          });
          setting = await transaction.orderingSetting.findUnique({
            where: { id: "default" },
            include: { scheduleWindows: true },
          });
          assert.equal(setting.emergencyPaused, false);
          assert.equal(
            resolveEffectiveOrderingState({
              featureEnabled: true,
              setting,
              scheduleWindows: setting.scheduleWindows,
              now,
            }).source,
            "SCHEDULE"
          );

          assert.deepEqual(
            await transaction.order.findMany({
              orderBy: { id: "asc" },
              select: { id: true, status: true, paymentStatus: true, updatedAt: true },
            }),
            beforeOrders
          );
          assert.deepEqual(
            await transaction.payment.findMany({
              orderBy: { id: "asc" },
              select: { id: true, status: true, updatedAt: true },
            }),
            beforePayments
          );

          throw new RollbackAcceptance("Rollback disposable ordering acceptance data.");
        },
        { maxWait: 10_000, timeout: 30_000 }
      ),
      RollbackAcceptance
    );

    const [restored, restoredActor] = await Promise.all([
      prisma.orderingSetting.findUnique({
        where: { id: "default" },
        include: {
          scheduleWindows: {
            orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
          },
        },
      }),
      prisma.user.findUnique({ where: { id: actor.id }, select: { role: true } }),
    ]);
    assert.equal(stableConfiguration(restored), originalConfiguration);
    assert.equal(restoredActor.role, actor.role);
  });
});
