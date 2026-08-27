import "server-only";

import { createClient } from "@/lib/supabase/server";
import { normalizeCatalogueItem } from "@/lib/menu/domain";

function normalizeCategory(category) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
  };
}

export async function getPublicMenuCatalogue() {
  const supabase = await createClient();
  const [categoryResult, itemResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name, slug")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("menu_items")
      .select(
        "id, category_id, slug, name, description, image_path, image_alt, price_minor, currency, available, featured"
      )
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (categoryResult.error || itemResult.error) {
    console.error("[public-menu-catalogue]", {
      category: categoryResult.error?.code || null,
      items: itemResult.error?.code || null,
    });
    return { ok: false, categories: [], items: [] };
  }

  return {
    ok: true,
    categories: (categoryResult.data || []).map(normalizeCategory),
    items: (itemResult.data || []).map(normalizeCatalogueItem).filter(Boolean),
  };
}
