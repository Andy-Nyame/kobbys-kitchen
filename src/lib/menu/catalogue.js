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
        where: { active: true, category: { active: true } },
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
          priceStepMinor: true,
          currency: true,
          available: true,
          featured: true,
          preparationMinutes: true,
          dietaryNotes: true,
          images: {
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              imageUrl: true,
              altText: true,
              sortOrder: true,
              isPrimary: true,
            },
          },
        },
      }),
    ]);

    return {
      ok: true,
      categories: categories.map(normalizeCategory),
      items: items
        .map((item) => {
          const primaryImage = item.images[0];

          return normalizeCatalogueItem({
            id: item.id,
            category_id: item.categoryId,
            slug: item.slug,
            name: item.name,
            description: item.description,
            image_path: primaryImage?.imageUrl || item.imagePath,
            image_alt: primaryImage?.altText || item.imageAlt,
            images: item.images.map((image) => ({
              id: image.id,
              image_url: image.imageUrl,
              alt_text: image.altText,
              sort_order: image.sortOrder,
              is_primary: image.isPrimary,
            })),
            price_minor: item.priceMinor,
            price_step_minor: item.priceStepMinor,
            currency: item.currency,
            available: item.available,
            featured: item.featured,
            preparation_minutes: item.preparationMinutes,
            dietary_notes: item.dietaryNotes,
          });
        })
        .filter(Boolean),
    };
  } catch (error) {
    console.error("[public-menu-catalogue]", { category: error?.code || "query_failed" });
    return { ok: false, categories: [], items: [] };
  }
}

export async function getPublicCartCatalogueItems() {
  try {
    return await prisma.menuItem.findMany({
      where: { active: true, category: { active: true } },
      select: {
        id: true,
        priceMinor: true,
        priceStepMinor: true,
        available: true,
      },
    });
  } catch (error) {
    console.error("[public-cart-catalogue]", {
      category: error?.code || "query_failed",
    });
    return [];
  }
}
