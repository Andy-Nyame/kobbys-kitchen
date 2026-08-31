import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("pickup checkout authorization and UI boundaries", () => {
  it("requires a trusted CUSTOMER for checkout and API submission", async () => {
    const [page, route] = await Promise.all([
      readFile("src/app/(customer)/checkout/page.js", "utf8"),
      readFile("src/app/api/orders/route.js", "utf8"),
    ]);

    assert.match(page, /requireCustomer\("\/checkout"\)/);
    assert.match(route, /getAuthenticatedUser\(\)/);
    assert.match(route, /getUserRole\(user\.id\)/);
    assert.match(route, /getCheckoutAuthorization\(user, role\)/);
    assert.doesNotMatch(route, /payload\.(userId|role)/);
  });

  it("keeps Cash as the safe fallback and gates Mobile Money/Card from server options", async () => {
    const source = await readFile(
      "src/components/checkout/CheckoutForm.jsx",
      "utf8"
    );

    assert.match(source, /disabled=\{!paymentOptions\.cashAvailable\}/);
    assert.match(source, /disabled=\{!paymentOptions\.methods\.MOBILE_MONEY\}/);
    assert.match(source, /disabled=\{!paymentOptions\.methods\.CARD\}/);
    assert.match(source, /Unavailable for online orders/);
    assert.match(source, /Delivery/);
    assert.match(source, /Coming soon/);
  });

  it("clears the cart only after a server-confirmed success and keeps failures", async () => {
    const source = await readFile(
      "src/components/checkout/CheckoutForm.jsx",
      "utf8"
    );
    const successCheck = source.indexOf("if (!response.ok || !result?.ok)");
    const clearPosition = source.indexOf("clearCart();");
    const redirectPosition = source.lastIndexOf("router.push(result.redirectTo)");

    assert.ok(successCheck > -1);
    assert.ok(clearPosition > successCheck);
    assert.ok(redirectPosition > clearPosition);
    assert.equal(source.match(/clearCart\(\)/g)?.length, 1);
  });

  it("uses the final server ordering guard inside the transaction before creation", async () => {
    const source = await readFile(
      "src/lib/orders/checkout-service.js",
      "utf8"
    );
    const guardPosition = source.indexOf("await assertOrderingOpen({ client: transaction })");
    const createPosition = source.indexOf("transaction.order.create");

    assert.ok(guardPosition > -1);
    assert.ok(createPosition > guardPosition);
    assert.match(source, /isolationLevel: "Serializable"/);
  });

  it("scopes customer order history and details by authenticated ownership", async () => {
    const source = await readFile(
      "src/lib/orders/customer-orders.js",
      "utf8"
    );

    assert.match(source, /where: \{ userId \}/);
    assert.match(source, /where: \{ userId, reference \}/);
    assert.doesNotMatch(source, /findUnique\(\{\s*where: \{ reference \}/);
  });

  it("feeds trusted item snapshots into the existing ADMIN active/history views", async () => {
    const [query, table] = await Promise.all([
      readFile("src/lib/admin/orders.js", "utf8"),
      readFile("src/components/admin/AdminOrderTable.jsx", "utf8"),
    ]);

    assert.match(query, /nameSnapshot: true/);
    assert.match(query, /unitPriceMinor: true/);
    assert.match(table, /order\.items\.map/);
    assert.match(table, /item\.quantity/);
  });

  it("does not add customer or admin status mutation endpoints in V2C-1", async () => {
    const route = await readFile("src/app/api/orders/route.js", "utf8");
    assert.match(route, /export async function POST/);
    assert.doesNotMatch(route, /export async function (PATCH|DELETE)/);
  });
});
