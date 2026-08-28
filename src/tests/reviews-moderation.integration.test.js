import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeAdminReviewModeration } from "../lib/reviews/admin-mutations.js";
import { getPublicReviewVisibility } from "../lib/reviews/visibility.js";

const integrationDescribe = process.env.RUN_DEVELOPMENT_INTEGRATION_TESTS === "1" ? describe : describe.skip;
class RollbackAcceptance extends Error {}

integrationDescribe("Development review moderation acceptance", () => {
  it("verifies public visibility and ADMIN transitions in a rollback-only transaction", async () => {
    const { verifyDevelopmentDatabase } = await import("../../scripts/database-safety.js");
    const { prisma } = await import("../lib/prisma.js");
    await verifyDevelopmentDatabase();
    const actor = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, role: true } });
    assert.ok(actor?.id, "A Development identity is required for review acceptance.");
    const beforeCount = await prisma.review.count();

    await assert.rejects(prisma.$transaction(async (transaction) => {
      await transaction.user.update({ where: { id: actor.id }, data: { role: "ADMIN" } });
      const records = await Promise.all([
        transaction.review.create({ data: { displayName: "Acceptance Featured", rating: 5, content: "Disposable review acceptance record.", status: "APPROVED", featured: true } }),
        transaction.review.create({ data: { displayName: "Acceptance Approved", rating: 4, content: "Disposable review acceptance record.", status: "APPROVED", featured: false } }),
        transaction.review.create({ data: { displayName: "Acceptance Pending", rating: 4, content: "Disposable review acceptance record.", status: "PENDING", featured: false } }),
        transaction.review.create({ data: { displayName: "Acceptance Hidden", rating: 3, content: "Disposable review acceptance record.", status: "REJECTED", featured: false } }),
      ]);
      assert.equal((await transaction.review.findMany({ where: { id: { in: records.map((record) => record.id) }, ...getPublicReviewVisibility(null) } })).length, 1);
      assert.equal((await transaction.review.findMany({ where: { id: { in: records.map((record) => record.id) }, ...getPublicReviewVisibility("CUSTOMER") } })).length, 2);

      const transactionClient = { $transaction: async (callback) => callback(transaction) };
      const pendingId = records[2].id;
      assert.equal((await executeAdminReviewModeration({ prismaClient: transactionClient, reviewId: pendingId, action: "APPROVE", adminUserId: actor.id })).status, "approved");
      assert.equal((await executeAdminReviewModeration({ prismaClient: transactionClient, reviewId: pendingId, action: "FEATURE", adminUserId: actor.id })).featured, true);
      assert.equal((await executeAdminReviewModeration({ prismaClient: transactionClient, reviewId: pendingId, action: "UNFEATURE", adminUserId: actor.id })).featured, false);
      assert.equal((await executeAdminReviewModeration({ prismaClient: transactionClient, reviewId: pendingId, action: "HIDE", adminUserId: actor.id })).status, "hidden");

      await transaction.user.update({ where: { id: actor.id }, data: { role: "CUSTOMER" } });
      await assert.rejects(executeAdminReviewModeration({ prismaClient: transactionClient, reviewId: records[1].id, action: "HIDE", adminUserId: actor.id }), /Admin authorization/);
      throw new RollbackAcceptance("Rollback review acceptance data.");
    }, { maxWait: 10_000, timeout: 30_000 }), RollbackAcceptance);

    assert.equal(await prisma.review.count(), beforeCount);
    assert.equal((await prisma.user.findUnique({ where: { id: actor.id }, select: { role: true } })).role, actor.role);
  });
});
