import assert from "node:assert/strict";
import { describe, it } from "node:test";

const integrationDescribe =
  process.env.RUN_DEVELOPMENT_INTEGRATION_TESTS === "1"
    ? describe
    : describe.skip;

integrationDescribe("development Prisma menu catalogue", () => {
  it("contains the imported active catalogue with integer GHS prices", async () => {
    const { prisma } = await import("../lib/prisma.js");
    assert.equal(process.env.APP_ENV, "development");

    const [categories, items] = await Promise.all([
      prisma.menuCategory.findMany({ where: { active: true } }),
      prisma.menuItem.findMany({ where: { active: true } }),
    ]);

    assert.equal(categories.length, 3);
    assert.equal(items.length, 5);
    assert.ok(
      items.every(
        (item) => Number.isInteger(item.priceMinor) && item.currency === "GHS"
      )
    );
  });
});
