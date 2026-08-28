import "server-only";

import { MENU_ADMIN_ACTION, slugifyMenuName } from "@/lib/menu/admin-validation";
import { prisma } from "@/lib/prisma";

export class AdminMenuMutationError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.name = "AdminMenuMutationError";
    this.status = status;
  }
}

async function assertAdmin(transaction, adminUserId) {
  const admin = await transaction.user.findUnique({
    where: { id: adminUserId },
    select: { role: true },
  });

  if (admin?.role !== "ADMIN") {
    throw new AdminMenuMutationError("Admin authorization is required.", 403);
  }
}

async function getUniqueCategorySlug(transaction, name) {
  const base = slugifyMenuName(name);

  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const slug = suffix === 1 ? base : `${base}-${suffix}`;
    const existing = await transaction.menuCategory.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }
  }

  throw new AdminMenuMutationError("A unique category slug could not be generated.");
}

async function getUniqueItemSlug(transaction, name) {
  const base = slugifyMenuName(name);

  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const slug = suffix === 1 ? base : `${base}-${suffix}`;
    const existing = await transaction.menuItem.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }
  }

  throw new AdminMenuMutationError("A unique menu-item slug could not be generated.");
}

async function requireCategory(transaction, categoryId) {
  const category = await transaction.menuCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new AdminMenuMutationError("The selected category could not be found.", 400);
  }
}

async function requireMenuItem(transaction, menuItemId) {
  const item = await transaction.menuItem.findUnique({
    where: { id: menuItemId },
    select: { id: true },
  });

  if (!item) {
    throw new AdminMenuMutationError("The menu item could not be found.", 404);
  }
}

async function normalizeItemImages(
  transaction,
  menuItemId,
  preferredImageId = null,
  preferredSortOrder = null
) {
  let images = await transaction.menuItemImage.findMany({
    where: { menuItemId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { id: true, isPrimary: true },
  });

  if (preferredImageId && Number.isInteger(preferredSortOrder)) {
    const preferred = images.find((image) => image.id === preferredImageId);

    if (preferred) {
      images = images.filter((image) => image.id !== preferredImageId);
      images.splice(Math.min(preferredSortOrder, images.length), 0, preferred);
    }
  }

  for (const [sortOrder, image] of images.entries()) {
    await transaction.menuItemImage.update({
      where: { id: image.id },
      data: { sortOrder },
    });
  }

  if (images.length > 0 && !images.some((image) => image.isPrimary)) {
    await transaction.menuItemImage.update({
      where: { id: images[0].id },
      data: { isPrimary: true },
    });
  }
}

export async function listAdminMenu() {
  const [categories, items] = await Promise.all([
    prisma.menuCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { items: true } } },
    }),
    prisma.menuItem.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        category: { select: { id: true, name: true, active: true } },
        images: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    }),
  ]);

  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      active: category.active,
      sortOrder: category.sortOrder,
      itemCount: category._count.items,
    })),
    items: items.map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      categoryActive: item.category.active,
      slug: item.slug,
      name: item.name,
      description: item.description,
      priceMinor: item.priceMinor,
      priceCedis: (item.priceMinor / 100).toFixed(2),
      currency: item.currency,
      available: item.available,
      active: item.active,
      featured: item.featured,
      sortOrder: item.sortOrder,
      preparationMinutes: item.preparationMinutes,
      dietaryNotes: item.dietaryNotes || "",
      images: item.images.map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        altText: image.altText,
        sortOrder: image.sortOrder,
        isPrimary: image.isPrimary,
      })),
    })),
  };
}

export async function mutateAdminMenu({ adminUserId, mutation }) {
  return prisma.$transaction(async (transaction) => {
    await assertAdmin(transaction, adminUserId);
    const { action, data } = mutation;

    if (action === MENU_ADMIN_ACTION.CATEGORY_CREATE) {
      return transaction.menuCategory.create({
        data: {
          ...data,
          slug: await getUniqueCategorySlug(transaction, data.name),
        },
        select: { id: true },
      });
    }

    if (action === MENU_ADMIN_ACTION.CATEGORY_UPDATE) {
      const existing = await transaction.menuCategory.findUnique({
        where: { id: data.id },
        select: { id: true },
      });

      if (!existing) {
        throw new AdminMenuMutationError("The category could not be found.", 404);
      }

      return transaction.menuCategory.update({
        where: { id: data.id },
        data: {
          name: data.name,
          description: data.description,
          sortOrder: data.sortOrder,
          active: data.active,
        },
        select: { id: true },
      });
    }

    if (action === MENU_ADMIN_ACTION.ITEM_CREATE) {
      await requireCategory(transaction, data.categoryId);
      return transaction.menuItem.create({
        data: {
          ...data,
          slug: await getUniqueItemSlug(transaction, data.name),
          currency: "GHS",
        },
        select: { id: true },
      });
    }

    if (action === MENU_ADMIN_ACTION.ITEM_UPDATE) {
      await requireMenuItem(transaction, data.id);
      await requireCategory(transaction, data.categoryId);
      return transaction.menuItem.update({
        where: { id: data.id },
        data: {
          categoryId: data.categoryId,
          name: data.name,
          description: data.description,
          priceMinor: data.priceMinor,
          available: data.available,
          active: data.active,
          featured: data.featured,
          sortOrder: data.sortOrder,
          preparationMinutes: data.preparationMinutes,
          dietaryNotes: data.dietaryNotes,
        },
        select: { id: true },
      });
    }

    if (action === MENU_ADMIN_ACTION.IMAGE_ADD) {
      await requireMenuItem(transaction, data.menuItemId);
      const existingImages = await transaction.menuItemImage.findMany({
        where: { menuItemId: data.menuItemId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, sortOrder: true },
      });
      const makePrimary = existingImages.length === 0 || data.isPrimary;

      if (makePrimary && existingImages.length > 0) {
        await transaction.menuItemImage.updateMany({
          where: { menuItemId: data.menuItemId },
          data: { isPrimary: false },
        });
      }

      const image = await transaction.menuItemImage.create({
        data: {
          menuItemId: data.menuItemId,
          imageUrl: data.imageUrl,
          altText: data.altText,
          sortOrder: existingImages.length,
          isPrimary: makePrimary,
        },
        select: { id: true },
      });
      await normalizeItemImages(transaction, data.menuItemId);
      return image;
    }

    if (action === MENU_ADMIN_ACTION.IMAGE_UPDATE) {
      await requireMenuItem(transaction, data.menuItemId);
      const existing = await transaction.menuItemImage.findFirst({
        where: { id: data.id, menuItemId: data.menuItemId },
        select: { id: true },
      });

      if (!existing) {
        throw new AdminMenuMutationError("The image could not be found.", 404);
      }

      if (data.isPrimary) {
        await transaction.menuItemImage.updateMany({
          where: { menuItemId: data.menuItemId, id: { not: data.id } },
          data: { isPrimary: false },
        });
      }

      const image = await transaction.menuItemImage.update({
        where: { id: data.id },
        data: {
          imageUrl: data.imageUrl,
          altText: data.altText,
          sortOrder: data.sortOrder,
          isPrimary: data.isPrimary,
        },
        select: { id: true },
      });
      await normalizeItemImages(
        transaction,
        data.menuItemId,
        data.id,
        data.sortOrder
      );
      return image;
    }

    if (action === MENU_ADMIN_ACTION.IMAGE_REMOVE) {
      await requireMenuItem(transaction, data.menuItemId);
      const removed = await transaction.menuItemImage.deleteMany({
        where: { id: data.id, menuItemId: data.menuItemId },
      });

      if (removed.count !== 1) {
        throw new AdminMenuMutationError("The image could not be found.", 404);
      }

      await normalizeItemImages(transaction, data.menuItemId);
      return { id: data.id };
    }

    throw new AdminMenuMutationError("The menu action is not supported.", 400);
  });
}
