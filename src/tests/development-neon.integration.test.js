import assert from "node:assert/strict";
import { describe, it } from "node:test";

const integrationDescribe =
  process.env.RUN_DEVELOPMENT_INTEGRATION_TESTS === "1"
    ? describe
    : describe.skip;

integrationDescribe("confirmed development Neon activation", () => {
  it("exposes the required Prisma-backed domain", async () => {
    const { prisma } = await import("../lib/prisma.js");
    assert.equal(process.env.APP_ENV, "development");

    const counts = [];

    for (const model of [
      prisma.user,
      prisma.profile,
      prisma.menuCategory,
      prisma.menuItem,
      prisma.review,
      prisma.order,
      prisma.payment,
    ]) {
      counts.push(await model.count());
    }

    assert.ok(counts.every(Number.isInteger));
  });

  it("keeps build and operational ordering disabled", async () => {
    const { prisma } = await import("../lib/prisma.js");
    const setting = await prisma.orderingSetting.findUnique({
      where: { id: "default" },
    });

    assert.equal(process.env.V2_ORDERING_ENABLED, "false");
    assert.equal(setting?.acceptingOrders, false);
  });

  it("keeps customer profiles and roles one-to-one on imported data", async () => {
    const { prisma } = await import("../lib/prisma.js");
    const customers = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      select: { profile: { select: { id: true } } },
    });

    assert.ok(customers.length > 0);
    assert.ok(customers.every((customer) => Boolean(customer.profile?.id)));
  });
});
