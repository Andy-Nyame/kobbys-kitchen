export function normalizeCatalogueItem(item) {
  if (
    !item ||
    typeof item.id !== "string" ||
    typeof item.category_id !== "string" ||
    typeof item.name !== "string" ||
    !Number.isInteger(item.price_minor) ||
    item.price_minor < 0 ||
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
    priceMinor: item.price_minor,
    currency: item.currency,
    available: item.available === true,
    featured: item.featured === true,
  };
}

export function canAddMenuItemToCart(item) {
  return Boolean(item?.id && item.available === true);
}
