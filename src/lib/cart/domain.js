import { deriveMenuPriceMinor, normalizePriceTier } from "../menu/pricing.js";

export const CART_STORAGE_KEY = "kobbys-kitchen-cart";
export const CART_STORAGE_VERSION = 2;
export const LEGACY_CART_STORAGE_VERSION = 1;
export const MAX_CART_ITEM_QUANTITY = 20;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMenuItemId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function normalizeQuantity(value) {
  return Number.isInteger(value) && value > 0
    ? Math.min(value, MAX_CART_ITEM_QUANTITY)
    : null;
}

export function normalizeCartLines(lines) {
  if (!Array.isArray(lines)) {
    return [];
  }

  const quantities = new Map();

  for (const line of lines) {
    if (!line || !isMenuItemId(line.menuItemId)) {
      continue;
    }

    const quantity = normalizeQuantity(line.quantity);
    const priceTier = normalizePriceTier(line.priceTier);

    if (!quantity || priceTier === null) {
      continue;
    }

    const lineKey = `${line.menuItemId}:${priceTier}`;

    quantities.set(
      lineKey,
      {
        menuItemId: line.menuItemId,
        priceTier,
        quantity: Math.min(
          (quantities.get(lineKey)?.quantity || 0) + quantity,
          MAX_CART_ITEM_QUANTITY
        ),
      }
    );
  }

  return [...quantities.values()];
}

export function parsePersistedCart(value) {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!parsed || !Array.isArray(parsed.lines)) {
      return [];
    }

    if (parsed.version === LEGACY_CART_STORAGE_VERSION) {
      return normalizeCartLines(
        parsed.lines.map((line) => ({ ...line, priceTier: 0 }))
      );
    }

    return parsed.version === CART_STORAGE_VERSION
      ? normalizeCartLines(parsed.lines)
      : [];
  } catch {
    return [];
  }
}

export function serializeCart(lines) {
  return JSON.stringify({
    version: CART_STORAGE_VERSION,
    lines: normalizeCartLines(lines),
  });
}

export function addCartItem(lines, menuItemId, priceTier = 0) {
  const normalizedTier = normalizePriceTier(priceTier);

  if (!isMenuItemId(menuItemId) || normalizedTier === null) {
    return normalizeCartLines(lines);
  }

  const normalizedLines = normalizeCartLines(lines);
  const existingLine = normalizedLines.find(
    (line) =>
      line.menuItemId === menuItemId && line.priceTier === normalizedTier
  );

  if (!existingLine) {
    return [
      ...normalizedLines,
      { menuItemId, priceTier: normalizedTier, quantity: 1 },
    ];
  }

  return normalizedLines.map((line) =>
    line.menuItemId === menuItemId && line.priceTier === normalizedTier
      ? { ...line, quantity: Math.min(line.quantity + 1, MAX_CART_ITEM_QUANTITY) }
      : line
  );
}

export function setCartItemQuantity(lines, menuItemId, priceTier, quantity) {
  const normalizedTier = normalizePriceTier(priceTier);

  if (!isMenuItemId(menuItemId) || normalizedTier === null) {
    return normalizeCartLines(lines);
  }

  const normalizedLines = normalizeCartLines(lines);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return normalizedLines.filter(
      (line) =>
        line.menuItemId !== menuItemId || line.priceTier !== normalizedTier
    );
  }

  return normalizedLines.map((line) =>
    line.menuItemId === menuItemId && line.priceTier === normalizedTier
      ? { ...line, quantity: Math.min(quantity, MAX_CART_ITEM_QUANTITY) }
      : line
  );
}

export function removeCartItem(lines, menuItemId, priceTier) {
  const normalizedTier = normalizePriceTier(priceTier);

  if (normalizedTier === null) {
    return normalizeCartLines(lines);
  }

  return normalizeCartLines(lines).filter(
    (line) => line.menuItemId !== menuItemId || line.priceTier !== normalizedTier
  );
}

export function getCartItemCount(lines) {
  return normalizeCartLines(lines).reduce((total, line) => total + line.quantity, 0);
}

export function getCartSubtotalMinor(lines, catalogueItems) {
  return resolveCartLines(lines, catalogueItems).resolvedLines.reduce(
    (subtotal, line) => subtotal + line.lineTotalMinor,
    0
  );
}

export function resolveCartLines(lines, catalogueItems) {
  const items = new Map(
    (Array.isArray(catalogueItems) ? catalogueItems : []).map((item) => [
      item.id,
      item,
    ])
  );
  const resolvedLines = [];
  const unresolvedLines = [];

  for (const line of normalizeCartLines(lines)) {
    const item = items.get(line.menuItemId);
    const selectedPriceMinor = deriveMenuPriceMinor(item, line.priceTier);

    if (!item || selectedPriceMinor === null || item.active === false) {
      unresolvedLines.push({ ...line, reason: "ITEM_OR_TIER_UNAVAILABLE" });
      continue;
    }

    resolvedLines.push({
      ...line,
      item,
      selectedPriceMinor,
      lineTotalMinor: selectedPriceMinor * line.quantity,
      orderable: item.available === true,
    });
  }

  return { resolvedLines, unresolvedLines };
}

export function formatGhs(minorAmount) {
  const amount = Number.isInteger(minorAmount) && minorAmount >= 0 ? minorAmount : 0;
  return `GH₵${(amount / 100).toFixed(2)}`;
}
