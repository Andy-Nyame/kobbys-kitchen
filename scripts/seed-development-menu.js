import { createClient } from "@supabase/supabase-js";

import { menuItems } from "../src/data/menuData.js";

if (process.env.APP_ENV !== "development") {
  throw new Error("Development menu seed may only run when APP_ENV=development.");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  throw new Error("Development Supabase server credentials are required.");
}

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const categoryDefinitions = [
  { name: "Rice Meals", slug: "rice-meals", sort_order: 10 },
  { name: "Noodles and Pasta", slug: "noodles-and-pasta", sort_order: 20 },
  { name: "Sides and Snacks", slug: "sides-and-snacks", sort_order: 30 },
];

const categorySlugByName = new Map(
  categoryDefinitions.map((category) => [category.name, category.slug])
);

const { error: categoryUpsertError } = await supabase
  .from("menu_categories")
  .upsert(categoryDefinitions, { onConflict: "slug" });

if (categoryUpsertError) {
  throw new Error(`Could not seed menu categories: ${categoryUpsertError.message}`);
}

const { data: categories, error: categoryReadError } = await supabase
  .from("menu_categories")
  .select("id, slug");

if (categoryReadError) {
  throw new Error(`Could not read menu categories: ${categoryReadError.message}`);
}

const categoryIdBySlug = new Map(categories.map((category) => [category.slug, category.id]));

const catalogueItems = menuItems.map((item, index) => {
  const categorySlug = categorySlugByName.get(item.category);
  const categoryId = categoryIdBySlug.get(categorySlug);

  if (!categoryId || !Number.isInteger(item.priceMinor)) {
    throw new Error(`Existing menu entry ${item.id} cannot be seeded safely.`);
  }

  return {
    category_id: categoryId,
    slug: item.id,
    name: item.name,
    description: item.description,
    image_path: item.image,
    image_alt: `${item.name} from Kobby’s Kitchen`,
    price_minor: item.priceMinor,
    currency: "GHS",
    available: item.available,
    featured: item.featured,
    active: true,
    sort_order: index + 1,
  };
});

const { error: itemUpsertError } = await supabase
  .from("menu_items")
  .upsert(catalogueItems, { onConflict: "slug" });

if (itemUpsertError) {
  throw new Error(`Could not seed menu items: ${itemUpsertError.message}`);
}

console.log(
  JSON.stringify({
    seeded: true,
    categories: categoryDefinitions.length,
    items: catalogueItems.length,
  })
);
