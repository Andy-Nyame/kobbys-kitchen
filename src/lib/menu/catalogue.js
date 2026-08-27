import "server-only";

import { normalizeCatalogueItem } from "@/lib/menu/domain";
import { prisma } from "@/lib/prisma";

function normalizeCategory(category) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
  };
}

export async function getPublicMenuCatalogue() {
  try {
    const [categories, items] = await Promise.all([
      prisma.menuCategory.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true },
      }),
      prisma.menuItem.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          categoryId: true,
          slug: true,
          name: true,
          description: true,
          imagePath: true,
          imageAlt: true,
          priceMinor: true,
          currency: true,
          available: true,
          featured: true,
        },
      }),
    ]);

    return {
      ok: true,
      categories: categories.map(normalizeCategory),
      items: items
        .map((item) =>
          normalizeCatalogueItem({
            id: item.id,
            category_id: item.categoryId,
            slug: item.slug,
            name: item.name,
            description: item.description,
            image_path: item.imagePath,
            image_alt: item.imageAlt,
            price_minor: item.priceMinor,
            currency: item.currency,
            available: item.available,
            featured: item.featured,
          })
        )
        .filter(Boolean),
    };
  } catch (error) {
    console.error("[public-menu-catalogue]", { category: error?.code || "query_failed" });
    return { ok: false, categories: [], items: [] };
  }
}
