import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { getAdminAuthorization } from "../lib/auth/authorization.js";
import {
  MENU_ADMIN_ACTION,
  normalizeMenuImagePath,
  parseGhsToMinor,
  prepareMenuAdminMutation,
} from "../lib/menu/admin-validation.js";

const categoryId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const imageId = "33333333-3333-4333-8333-333333333333";

function itemPayload(overrides = {}) {
  return {
    action: MENU_ADMIN_ACTION.ITEM_CREATE,
    categoryId,
    name: "Waakye Special",
    description: "Rice and beans served with traditional accompaniments.",
    priceCedis: "25.50",
    priceStepCedis: "5.00",
    available: true,
    active: true,
    featured: false,
    sortOrder: "3",
    preparationMinutes: "20",
    dietaryNotes: "Ask about allergens",
    ...overrides,
  };
}

describe("admin menu validation", () => {
  it("converts Ghana cedis to integer pesewas without floating-point storage", () => {
    assert.equal(parseGhsToMinor("25"), 2500);
    assert.equal(parseGhsToMinor("25.5"), 2550);
    assert.equal(parseGhsToMinor("25.50"), 2550);
    assert.equal(parseGhsToMinor("0.01"), 1);
  });

  it("rejects negative, malformed, and over-precision prices", () => {
    for (const value of ["-1", "GH₵25", "25.005", "1e3", "", "NaN"]) {
      assert.throws(() => parseGhsToMinor(value), /Price/);
    }
  });

  it("normalizes category and item mutations from browser-shaped input", () => {
    const category = prepareMenuAdminMutation({
      action: MENU_ADMIN_ACTION.CATEGORY_CREATE,
      name: "  Main   Meals ",
      description: "  Hot favourites ",
      sortOrder: "2",
      active: "true",
    });
    const item = prepareMenuAdminMutation(itemPayload());

    assert.deepEqual(category.data, {
      name: "Main Meals",
      description: "Hot favourites",
      sortOrder: 2,
      active: true,
    });
    assert.equal(item.data.priceMinor, 2550);
    assert.equal(item.data.priceStepMinor, 500);
    assert.equal(item.data.preparationMinutes, 20);
    assert.equal(item.data.categoryId, categoryId);
    assert.equal(item.data.active, true);
  });

  it("rejects invalid identifiers, quantities, and unsupported mutation actions", () => {
    assert.throws(
      () => prepareMenuAdminMutation(itemPayload({ categoryId: "other-item" })),
      /Category is invalid/
    );
    assert.throws(
      () => prepareMenuAdminMutation(itemPayload({ sortOrder: "-1" })),
      /display order is invalid/
    );
    assert.throws(
      () => prepareMenuAdminMutation(itemPayload({ priceStepCedis: "0" })),
      /greater than zero/
    );
    assert.throws(
      () => prepareMenuAdminMutation({ action: "DELETE_ITEM", id: itemId }),
      /not supported/
    );
  });

  it("accepts only validated project image metadata", () => {
    assert.equal(
      normalizeMenuImagePath("/images/food/waakye-special.webp"),
      "/images/food/waakye-special.webp"
    );
    for (const value of [
      "https://example.com/image.png",
      "/images/../secret.png",
      "/uploads/image.svg",
      "data:image/png;base64,AAAA",
    ]) {
      assert.throws(() => normalizeMenuImagePath(value), /Image path/);
    }
  });

  it("validates add, reorder, primary, and remove image requests", () => {
    const update = prepareMenuAdminMutation({
      action: MENU_ADMIN_ACTION.IMAGE_UPDATE,
      id: imageId,
      menuItemId: itemId,
      imageUrl: "/images/food/waakye-special.png",
      altText: "Waakye special meal",
      sortOrder: "1",
      isPrimary: "true",
    });
    const remove = prepareMenuAdminMutation({
      action: MENU_ADMIN_ACTION.IMAGE_REMOVE,
      id: imageId,
      menuItemId: itemId,
    });

    assert.equal(update.data.sortOrder, 1);
    assert.equal(update.data.isPrimary, true);
    assert.deepEqual(remove.data, { id: imageId, menuItemId: itemId });
  });
});

describe("admin menu security and catalogue policies", () => {
  it("allows only ADMIN and denies CUSTOMER or signed-out authorization contexts", () => {
    assert.equal(getAdminAuthorization(null, null, "/admin/menu").allowed, false);
    assert.equal(
      getAdminAuthorization({ id: "customer" }, "CUSTOMER", "/admin/menu").allowed,
      false
    );
    assert.equal(
      getAdminAuthorization({ id: "admin" }, "ADMIN", "/admin/menu").allowed,
      true
    );
  });

  it("enforces the database role again inside the mutation transaction", async () => {
    const service = await readFile(new URL("../lib/admin/menu.js", import.meta.url), "utf8");
    const assertion = service.indexOf("await assertAdmin(transaction, adminUserId)");
    const firstMutation = service.indexOf("MENU_ADMIN_ACTION.CATEGORY_CREATE");

    assert.ok(assertion >= 0);
    assert.ok(assertion < firstMutation);
    assert.doesNotMatch(service, /adminEmail|PRIMARY_ADMIN_EMAIL/);
  });

  it("uses archive state instead of destructive category or item deletion", async () => {
    const service = await readFile(new URL("../lib/admin/menu.js", import.meta.url), "utf8");

    assert.doesNotMatch(service, /menuCategory\.delete/);
    assert.doesNotMatch(service, /menuItem\.delete/);
    assert.match(service, /active: data\.active/);
  });

  it("hides inactive categories/items publicly and resolves the primary image", async () => {
    const catalogue = await readFile(new URL("../lib/menu/catalogue.js", import.meta.url), "utf8");

    assert.match(catalogue, /where: \{ active: true, category: \{ active: true \} \}/);
    assert.match(catalogue, /isPrimary: "desc"/);
    assert.match(catalogue, /primaryImage\?\.imageUrl \|\| item\.imagePath/);
  });

  it("has a database constraint for one primary image per item", async () => {
    const migration = await readFile(
      new URL(
        "../../prisma/migrations/20260828090000_add_admin_menu_management/migration.sql",
        import.meta.url
      ),
      "utf8"
    );

    assert.match(migration, /menu_item_images_one_primary_per_item/);
    assert.match(migration, /WHERE "isPrimary" = true/);
    assert.match(migration, /INSERT INTO "menu_item_images"/);
  });
});
