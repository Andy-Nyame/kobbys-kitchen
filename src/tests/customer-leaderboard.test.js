import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  listCustomerLeaderboard,
  rankCustomerLeaderboard,
} from "../lib/admin/customer-leaderboard.js";

describe("Admin customer leaderboard", () => {
  it("queries only completed, paid pickup orders without an active refund", async () => {
    let query = null;
    const rows = await listCustomerLeaderboard({
      user: {
        findMany: async (options) => {
          query = options;
          return [{
            id: "customer-1",
            name: "Ama",
            email: "ama@example.test",
            profile: { displayName: "Ama Mensah" },
            _count: { orders: 2 },
            orders: [{ completedAt: new Date("2026-09-20T18:00:00Z") }],
          }];
        },
      },
    });

    const qualifying = query.where.orders.some;
    assert.equal(query.where.role, "CUSTOMER");
    assert.equal(qualifying.status, "COMPLETED");
    assert.equal(qualifying.fulfillmentType, "PICKUP");
    assert.equal(qualifying.payment.is.status, "PAID");
    assert.deepEqual(
      qualifying.payment.is.OR.map((condition) => condition.refund.is?.status || null),
      [null, "FAILED"]
    );
    assert.equal(rows[0].completedOrderCount, 2);
    assert.equal(rows[0].customer, "Ama Mensah");
  });

  it("sorts by count, latest completion, then customer identity", () => {
    const ranked = rankCustomerLeaderboard([
      { id: "b", customer: "Kojo", email: "kojo@example.test", completedOrderCount: 2, lastCompletedAt: "2026-09-20T10:00:00Z" },
      { id: "a", customer: "Ama", email: "ama@example.test", completedOrderCount: 3, lastCompletedAt: "2026-09-19T10:00:00Z" },
      { id: "c", customer: "Esi", email: "esi@example.test", completedOrderCount: 2, lastCompletedAt: "2026-09-21T10:00:00Z" },
    ]);
    assert.deepEqual(ranked.map((entry) => entry.id), ["a", "c", "b"]);
  });

  it("keeps the page Admin-only, ranked, empty-safe and free of extra insights", async () => {
    const [page, navigation] = await Promise.all([
      readFile("src/app/admin/customers/page.js", "utf8"),
      readFile("src/components/admin/AdminNavigation.jsx", "utf8"),
    ]);
    assert.match(page, /requireAdmin\("\/admin\/customers"\)/);
    assert.match(page, /#\{index \+ 1\}/);
    assert.match(page, /No completed customer orders yet\./);
    assert.match(navigation, /href: "\/admin\/customers", label: "Customers"/);
    assert.doesNotMatch(page, /Total spent|Average order|Favourite|Create Promo|Winner/);
  });
});
