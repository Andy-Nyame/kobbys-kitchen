import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createClient } from "@supabase/supabase-js";

const integrationDescribe =
  process.env.RUN_DEVELOPMENT_INTEGRATION_TESTS === "1"
    ? describe
    : describe.skip;

function createPublicClient() {
  assert.equal(process.env.APP_ENV, "development");

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

integrationDescribe("development public menu catalogue", () => {
  it("exposes the seeded active catalogue while denying anonymous mutation", async () => {
    const publicClient = createPublicClient();
    const [categories, items, mutation] = await Promise.all([
      publicClient.from("menu_categories").select("id, slug").order("sort_order"),
      publicClient
        .from("menu_items")
        .select("id, slug, price_minor, currency, available")
        .order("sort_order"),
      publicClient.from("menu_items").insert({
        category_id: "00000000-0000-4000-8000-000000000000",
        slug: "forbidden-catalogue-write",
        name: "Forbidden",
        price_minor: 1,
        currency: "GHS",
      }),
    ]);

    assert.equal(categories.error, null);
    assert.equal(categories.data.length, 3);
    assert.equal(items.error, null);
    assert.equal(items.data.length, 5);
    assert.ok(
      items.data.every(
        (item) => Number.isInteger(item.price_minor) && item.currency === "GHS"
      )
    );
    assert.ok(mutation.error, "anonymous catalogue writes must be denied");
  });
});
