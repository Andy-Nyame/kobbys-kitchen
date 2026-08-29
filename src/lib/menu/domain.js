export function normalizeCatalogueItem(item) {
  if (
    !item ||
    typeof item.id !== "string" ||
    typeof item.category_id !== "string" ||
    typeof item.name !== "string" ||
    !Number.isInteger(item.price_minor) ||
    item.price_minor < 0 ||
    !Number.isInteger(item.price_step_minor) ||
    item.price_step_minor <= 0 ||
    item.currency !== "GHS"
  ) {
    return null;
  }

  return {
    id: item.id,
    categoryId: item.category_id,
    slug: item.slug,
    name: item.name,
    description: item.description || "",
    image: item.image_path || null,
    imageAlt: item.image_alt || `${item.name} from Kobby’s Kitchen`,
    images: Array.isArray(item.images)
      ? item.images.map((image) => ({
          id: image.id,
          imageUrl: image.image_url,
          altText: image.alt_text,
          sortOrder: image.sort_order,
          isPrimary: image.is_primary === true,
        }))
      : [],
    priceMinor: item.price_minor,
    priceStepMinor: item.price_step_minor,
    currency: item.currency,
    available: item.available === true,
    featured: item.featured === true,
    preparationMinutes: Number.isInteger(item.preparation_minutes)
      ? item.preparation_minutes
      : null,
    dietaryNotes: item.dietary_notes || "",
  };
}

export function canAddMenuItemToCart(item) {
  return Boolean(item?.id && item.available === true);
}
