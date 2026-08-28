export const MENU_ADMIN_ACTION = Object.freeze({
  CATEGORY_CREATE: "CATEGORY_CREATE",
  CATEGORY_UPDATE: "CATEGORY_UPDATE",
  ITEM_CREATE: "ITEM_CREATE",
  ITEM_UPDATE: "ITEM_UPDATE",
  IMAGE_ADD: "IMAGE_ADD",
  IMAGE_UPDATE: "IMAGE_UPDATE",
  IMAGE_REMOVE: "IMAGE_REMOVE",
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MENU_IMAGE_PATH_PATTERN =
  /^\/images\/[A-Za-z0-9/_-]+\.(?:avif|jpe?g|png|webp)$/i;

function normalizeText(value, { field, min = 0, max, required = false }) {
  const normalized =
    typeof value === "string"
      ? value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
      : "";

  if (required && normalized.length < Math.max(1, min)) {
    throw new TypeError(`${field} is required.`);
  }

  if (normalized && normalized.length < min) {
    throw new TypeError(`${field} is too short.`);
  }

  if (normalized.length > max) {
    throw new TypeError(`${field} is too long.`);
  }

  return normalized || null;
}

function normalizeId(value, field) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new TypeError(`${field} is invalid.`);
  }

  return value;
}

function normalizeBoolean(value, field) {
  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  throw new TypeError(`${field} is invalid.`);
}

function normalizeInteger(value, field, { max = 10000, nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === "")) {
    return null;
  }

  const normalized = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(normalized) || normalized < 0 || normalized > max) {
    throw new TypeError(`${field} is invalid.`);
  }

  return normalized;
}

export function parseGhsToMinor(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new TypeError("Price is invalid.");
  }

  const normalized = String(value).trim();

  if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(normalized)) {
    throw new TypeError("Price must be a valid Ghana cedi amount.");
  }

  const [cedis, pesewas = ""] = normalized.split(".");
  const minor = Number(cedis) * 100 + Number(pesewas.padEnd(2, "0"));

  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new TypeError("Price is invalid.");
  }

  return minor;
}

export function normalizeMenuImagePath(value) {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (
    !MENU_IMAGE_PATH_PATTERN.test(normalized) ||
    normalized.includes("..") ||
    normalized.includes("\\")
  ) {
    throw new TypeError(
      "Image path must reference an existing PNG, JPEG, WebP or AVIF file under /images/."
    );
  }

  return normalized;
}

function normalizeCategory(payload, includeId) {
  return {
    ...(includeId ? { id: normalizeId(payload?.id, "Category") } : {}),
    name: normalizeText(payload?.name, {
      field: "Category name",
      min: 2,
      max: 80,
      required: true,
    }),
    description: normalizeText(payload?.description, {
      field: "Category description",
      max: 300,
    }),
    sortOrder: normalizeInteger(payload?.sortOrder, "Category display order"),
    active: normalizeBoolean(payload?.active, "Category visibility"),
  };
}

function normalizeItem(payload, includeId) {
  return {
    ...(includeId ? { id: normalizeId(payload?.id, "Menu item") } : {}),
    categoryId: normalizeId(payload?.categoryId, "Category"),
    name: normalizeText(payload?.name, {
      field: "Item name",
      min: 2,
      max: 100,
      required: true,
    }),
    description: normalizeText(payload?.description, {
      field: "Item description",
      min: 4,
      max: 800,
      required: true,
    }),
    priceMinor: parseGhsToMinor(payload?.priceCedis),
    available: normalizeBoolean(payload?.available, "Availability"),
    active: normalizeBoolean(payload?.active, "Menu visibility"),
    featured: normalizeBoolean(payload?.featured, "Featured state"),
    sortOrder: normalizeInteger(payload?.sortOrder, "Item display order"),
    preparationMinutes: normalizeInteger(
      payload?.preparationMinutes,
      "Preparation time",
      { max: 1440, nullable: true }
    ),
    dietaryNotes: normalizeText(payload?.dietaryNotes, {
      field: "Dietary notes",
      max: 300,
    }),
  };
}

function normalizeImage(payload, includeId) {
  return {
    menuItemId: normalizeId(payload?.menuItemId, "Menu item"),
    ...(includeId ? { id: normalizeId(payload?.id, "Image") } : {}),
    imageUrl: normalizeMenuImagePath(payload?.imageUrl),
    altText: normalizeText(payload?.altText, {
      field: "Image alternative text",
      min: 2,
      max: 160,
      required: true,
    }),
    sortOrder: normalizeInteger(payload?.sortOrder ?? 0, "Image display order"),
    isPrimary: normalizeBoolean(payload?.isPrimary, "Primary image state"),
  };
}

export function prepareMenuAdminMutation(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("The menu request is invalid.");
  }

  switch (payload.action) {
    case MENU_ADMIN_ACTION.CATEGORY_CREATE:
      return { action: payload.action, data: normalizeCategory(payload, false) };
    case MENU_ADMIN_ACTION.CATEGORY_UPDATE:
      return { action: payload.action, data: normalizeCategory(payload, true) };
    case MENU_ADMIN_ACTION.ITEM_CREATE:
      return { action: payload.action, data: normalizeItem(payload, false) };
    case MENU_ADMIN_ACTION.ITEM_UPDATE:
      return { action: payload.action, data: normalizeItem(payload, true) };
    case MENU_ADMIN_ACTION.IMAGE_ADD:
      return { action: payload.action, data: normalizeImage(payload, false) };
    case MENU_ADMIN_ACTION.IMAGE_UPDATE:
      return { action: payload.action, data: normalizeImage(payload, true) };
    case MENU_ADMIN_ACTION.IMAGE_REMOVE:
      return {
        action: payload.action,
        data: {
          menuItemId: normalizeId(payload?.menuItemId, "Menu item"),
          id: normalizeId(payload?.id, "Image"),
        },
      };
    default:
      throw new TypeError("The menu action is not supported.");
  }
}

export function slugifyMenuName(value) {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  return slug || "menu-entry";
}
