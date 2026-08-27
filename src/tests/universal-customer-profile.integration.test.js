import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

const integrationDescribe =
  process.env.RUN_DEVELOPMENT_INTEGRATION_TESTS === "1"
    ? describe
    : describe.skip;

integrationDescribe("universal Auth.js customer profile provisioning", () => {
  it("enforces exactly one profile and CUSTOMER role", async () => {
    const { prisma } = await import("../lib/prisma.js");
    assert.equal(process.env.APP_ENV, "development");
    const email = `profile-${randomUUID()}@example.test`;

    const user = await prisma.user.create({
      data: {
        email,
        emailVerified: new Date(),
        name: "Provider Independent Customer",
        role: "CUSTOMER",
        profile: {
          create: { displayName: "Provider Independent Customer" },
        },
      },
      select: { id: true },
    });

    try {
      await prisma.profile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, displayName: "Duplicate" },
        update: {},
      });

      const [storedUser, profiles] = await Promise.all([
        prisma.user.findUnique({ where: { id: user.id } }),
        prisma.profile.count({ where: { userId: user.id } }),
      ]);

      assert.equal(storedUser.role, "CUSTOMER");
      assert.equal(profiles, 1);
      await assert.rejects(
        prisma.profile.create({
          data: { userId: user.id, displayName: "Forbidden duplicate" },
        })
      );
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
