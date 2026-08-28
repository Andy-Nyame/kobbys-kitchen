import assert from "node:assert/strict";
import { describe, it } from "node:test";

const integrationDescribe =
  process.env.RUN_DEVELOPMENT_INTEGRATION_TESTS === "1"
    ? describe
    : describe.skip;

integrationDescribe("development Neon admin menu foundation", () => {
  it("preserves catalogue data and enforces image/catalogue constraints", async () => {
    const { verifyDevelopmentDatabase } = await import(
      "../../scripts/database-safety.js"
    );
    const { prisma } = await import("../lib/prisma.js");
    await verifyDevelopmentDatabase();

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const categorySlug = `integration-category-${suffix}`;
    const secondCategorySlug = `integration-second-category-${suffix}`;
    const itemSlug = `integration-item-${suffix}`;
    const before = await Promise.all([
      prisma.menuCategory.count(),
      prisma.menuItem.count(),
    ]);
    let categoryId = null;
    let secondCategoryId = null;
    let itemId = null;

    try {
      const category = await prisma.menuCategory.create({
        data: {
          name: "Integration Category",
          slug: categorySlug,
          description: "Disposable development verification.",
          active: true,
          sortOrder: 9000,
        },
      });
      categoryId = category.id;
      const secondCategory = await prisma.menuCategory.create({
        data: {
          name: "Integration Category Two",
          slug: secondCategorySlug,
          active: true,
          sortOrder: 9001,
        },
      });
      secondCategoryId = secondCategory.id;
      const item = await prisma.menuItem.create({
        data: {
          categoryId,
          slug: itemSlug,
          name: "Integration Meal",
          description: "Disposable development verification item.",
          priceMinor: 2550,
          currency: "GHS",
          available: true,
          active: true,
          featured: false,
          sortOrder: 9000,
        },
      });
      itemId = item.id;

      const primary = await prisma.menuItemImage.create({
        data: {
          menuItemId: itemId,
          imageUrl: `/images/food/integration-${suffix}.png`,
          altText: "Integration meal",
          sortOrder: 0,
          isPrimary: true,
        },
      });
      const secondary = await prisma.menuItemImage.create({
        data: {
          menuItemId: itemId,
          imageUrl: `/images/food/integration-${suffix}-two.webp`,
          altText: "Integration meal alternate view",
          sortOrder: 1,
          isPrimary: false,
        },
      });

      await assert.rejects(
        prisma.menuItemImage.update({
          where: { id: secondary.id },
          data: { isPrimary: true },
        })
      );

      await prisma.menuItem.update({
        where: { id: itemId },
        data: {
          name: "Updated Integration Meal",
          categoryId: secondCategoryId,
          priceMinor: 3100,
          available: false,
        },
      });
      const publicUnavailable = await prisma.menuItem.findMany({
        where: { active: true, category: { active: true } },
        include: { images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] } },
      });
      const resolved = publicUnavailable.find((entry) => entry.id === itemId);

      assert.equal(resolved.name, "Updated Integration Meal");
      assert.equal(resolved.categoryId, secondCategoryId);
      assert.equal(resolved.priceMinor, 3100);
      assert.equal(resolved.available, false);
      assert.equal(resolved.images[0].id, primary.id);

      await assert.rejects(prisma.menuCategory.delete({ where: { id: secondCategoryId } }));

      await prisma.menuItem.update({ where: { id: itemId }, data: { active: false } });
      assert.equal(
        await prisma.menuItem.count({
          where: { id: itemId, active: true, category: { active: true } },
        }),
        0
      );

      await prisma.menuItem.update({ where: { id: itemId }, data: { active: true } });
      await prisma.menuCategory.update({
        where: { id: secondCategoryId },
        data: { active: false },
      });
      assert.equal(
        await prisma.menuItem.count({
          where: { id: itemId, active: true, category: { active: true } },
        }),
        0
      );
    } finally {
      if (itemId) {
        await prisma.menuItem.deleteMany({ where: { id: itemId } });
      }
      if (secondCategoryId) {
        await prisma.menuCategory.deleteMany({ where: { id: secondCategoryId } });
      }
      if (categoryId) {
        await prisma.menuCategory.deleteMany({ where: { id: categoryId } });
      }

      assert.deepEqual(
        await Promise.all([prisma.menuCategory.count(), prisma.menuItem.count()]),
        before
      );
    }
  });
});
