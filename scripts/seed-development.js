import { menuItems } from "../src/data/menuData.js";
import { prisma } from "../src/lib/prisma.js";
import { verifyDevelopmentDatabase } from "./database-safety.js";

await verifyDevelopmentDatabase();

const categoryDefinitions = [
  { name: "Rice Meals", slug: "rice-meals", sortOrder: 10 },
  { name: "Noodles and Pasta", slug: "noodles-and-pasta", sortOrder: 20 },
  { name: "Sides and Snacks", slug: "sides-and-snacks", sortOrder: 30 },
];
const categorySlugByName = new Map(
  categoryDefinitions.map((category) => [category.name, category.slug])
);

try {
  await prisma.$transaction(async (transaction) => {
    for (const category of categoryDefinitions) {
      await transaction.menuCategory.upsert({
        where: { slug: category.slug },
        create: category,
        update: {
          name: category.name,
          sortOrder: category.sortOrder,
          active: true,
        },
      });
    }

    const categories = await transaction.menuCategory.findMany({
      where: { slug: { in: categoryDefinitions.map((category) => category.slug) } },
      select: { id: true, slug: true },
    });
    const categoryIdBySlug = new Map(
      categories.map((category) => [category.slug, category.id])
    );

    for (const [index, item] of menuItems.entries()) {
      const categorySlug = categorySlugByName.get(item.category);
      const categoryId = categoryIdBySlug.get(categorySlug);

      if (!categoryId || !Number.isInteger(item.priceMinor)) {
        throw new Error(`Existing menu entry ${item.id} cannot be seeded safely.`);
      }

      const values = {
        categoryId,
        name: item.name,
        description: item.description,
        imagePath: item.image,
        imageAlt: `${item.name} from Kobby’s Kitchen`,
        priceMinor: item.priceMinor,
        priceStepMinor: item.priceStepMinor,
        currency: "GHS",
        available: item.available,
        featured: item.featured,
        active: true,
        sortOrder: index + 1,
      };

      await transaction.menuItem.upsert({
        where: { slug: item.id },
        create: { slug: item.id, ...values },
        update: values,
      });
    }

    await transaction.orderingSetting.upsert({
      where: { id: "default" },
      create: { id: "default", acceptingOrders: false },
      update: {},
    });
  }, { maxWait: 30000, timeout: 120000 });

  console.log(JSON.stringify({
    seeded: true,
    categories: categoryDefinitions.length,
    items: menuItems.length,
    acceptingOrders: false,
  }));
} finally {
  await prisma.$disconnect();
}
