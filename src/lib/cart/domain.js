export const CART_STORAGE_KEY = "kobbys-kitchen-cart";
export const CART_STORAGE_VERSION = 1;
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

    if (!quantity) {
      continue;
    }

    quantities.set(
      line.menuItemId,
      Math.min((quantities.get(line.menuItemId) || 0) + quantity, MAX_CART_ITEM_QUANTITY)
    );
  }

  return [...quantities.entries()].map(([menuItemId, quantity]) => ({
    menuItemId,
    quantity,
  }));
}

export function parsePersistedCart(value) {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!parsed || parsed.version !== CART_STORAGE_VERSION) {
      return [];
    }

    return normalizeCartLines(parsed.lines);
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

export function addCartItem(lines, menuItemId) {
  if (!isMenuItemId(menuItemId)) {
    return normalizeCartLines(lines);
  }

  const normalizedLines = normalizeCartLines(lines);
  const existingLine = normalizedLines.find(
    (line) => line.menuItemId === menuItemId
  );

  if (!existingLine) {
    return [...normalizedLines, { menuItemId, quantity: 1 }];
  }

  return normalizedLines.map((line) =>
    line.menuItemId === menuItemId
      ? { ...line, quantity: Math.min(line.quantity + 1, MAX_CART_ITEM_QUANTITY) }
      : line
  );
}

export function setCartItemQuantity(lines, menuItemId, quantity) {
  if (!isMenuItemId(menuItemId)) {
    return normalizeCartLines(lines);
  }

  const normalizedLines = normalizeCartLines(lines);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return normalizedLines.filter((line) => line.menuItemId !== menuItemId);
  }

  return normalizedLines.map((line) =>
    line.menuItemId === menuItemId
      ? { ...line, quantity: Math.min(quantity, MAX_CART_ITEM_QUANTITY) }
      : line
  );
}

export function removeCartItem(lines, menuItemId) {
  return normalizeCartLines(lines).filter((line) => line.menuItemId !== menuItemId);
}

export function getCartItemCount(lines) {
  return normalizeCartLines(lines).reduce((total, line) => total + line.quantity, 0);
}

export function getCartSubtotalMinor(lines, catalogueItems) {
  const prices = new Map(
    (Array.isArray(catalogueItems) ? catalogueItems : []).map((item) => [
      item.id,
      item.priceMinor,
    ])
  );

  return normalizeCartLines(lines).reduce((subtotal, line) => {
    const priceMinor = prices.get(line.menuItemId);

    return Number.isInteger(priceMinor) && priceMinor >= 0
      ? subtotal + priceMinor * line.quantity
      : subtotal;
  }, 0);
}

export function formatGhs(minorAmount) {
  const amount = Number.isInteger(minorAmount) && minorAmount >= 0 ? minorAmount : 0;
  return `GH₵${(amount / 100).toFixed(2)}`;
}
