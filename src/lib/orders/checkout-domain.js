import { randomBytes } from "node:crypto";

import { MAX_CART_ITEM_QUANTITY, isMenuItemId } from "../cart/domain.js";
import { deriveMenuPriceMinor, normalizePriceTier } from "../menu/pricing.js";
import {
  MAX_CHECKOUT_LINES,
  MAX_ORDER_NOTE_LENGTH,
} from "./checkout-constants.js";
import { PAYMENT_METHOD } from "./domain.js";
import {
  normalizeDisplayName,
  normalizeGhanaPhone,
  sanitizeTextValue,
} from "../validation/auth.js";

const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class CheckoutDomainError extends Error {
  constructor(code, message, { fieldErrors = {}, details = null } = {}) {
    super(message);
    this.name = "CheckoutDomainError";
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.details = details;
  }
}

export function getCheckoutAuthorization(user, role) {
  if (!user) {
    return { allowed: false, status: 401, code: "AUTHENTICATION_REQUIRED" };
  }

  if (role !== "CUSTOMER") {
    return { allowed: false, status: 403, code: "CUSTOMER_REQUIRED" };
  }

  return { allowed: true, status: 200, code: "CUSTOMER_AUTHORIZED" };
}

function normalizeCheckoutNote(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new CheckoutDomainError(
      "CHECKOUT_INVALID",
      "Please check the pickup details.",
      { fieldErrors: { note: "Order note must be plain text." } }
    );
  }

  const note = sanitizeTextValue(value.replace(/\s+/g, " "));

  if (note.length > MAX_ORDER_NOTE_LENGTH) {
    throw new CheckoutDomainError(
      "CHECKOUT_INVALID",
      "Please check the pickup details.",
      {
        fieldErrors: {
          note: `Order note must be ${MAX_ORDER_NOTE_LENGTH} characters or fewer.`,
        },
      }
    );
  }

  return note || null;
}

function validateCustomerDetails(payload) {
  const customerName = normalizeDisplayName(payload?.customerName);
  const customerPhone = normalizeGhanaPhone(payload?.customerPhone);
  const fieldErrors = {};

  if (!customerName || customerName.length < 2 || customerName.length > 80) {
    fieldErrors.customerName =
      "Enter a pickup name between 2 and 80 characters.";
  }

  if (!customerPhone) {
    fieldErrors.customerPhone = "Enter a valid Ghana phone number.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new CheckoutDomainError(
      "CHECKOUT_INVALID",
      "Please check the pickup details.",
      { fieldErrors }
    );
  }

  return { customerName, customerPhone };
}

export function validateCheckoutLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new CheckoutDomainError(
      "CART_EMPTY",
      "Your cart is empty. Add at least one menu item before checkout."
    );
  }

  if (lines.length > MAX_CHECKOUT_LINES) {
    throw new CheckoutDomainError(
      "CART_INVALID",
      "The cart contains too many separate selections."
    );
  }

  const normalized = new Map();

  for (const line of lines) {
    const menuItemId = line?.menuItemId;
    const priceTier = normalizePriceTier(line?.priceTier);
    const quantity = line?.quantity;
    const expectedUnitPriceMinor = line?.expectedUnitPriceMinor;

    if (
      !isMenuItemId(menuItemId) ||
      priceTier === null ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_CART_ITEM_QUANTITY ||
      (expectedUnitPriceMinor !== undefined &&
        (!Number.isSafeInteger(expectedUnitPriceMinor) ||
          expectedUnitPriceMinor < 0))
    ) {
      throw new CheckoutDomainError(
        "CART_INVALID",
        "One or more cart selections are invalid. Review your cart and try again."
      );
    }

    const key = `${menuItemId}:${priceTier}`;
    const current = normalized.get(key);
    const combinedQuantity = (current?.quantity || 0) + quantity;

    if (combinedQuantity > MAX_CART_ITEM_QUANTITY) {
      throw new CheckoutDomainError(
        "QUANTITY_INVALID",
        `A menu selection cannot exceed ${MAX_CART_ITEM_QUANTITY} items.`
      );
    }

    if (
      current &&
      current.expectedUnitPriceMinor !== expectedUnitPriceMinor
    ) {
      throw new CheckoutDomainError(
        "CART_INVALID",
        "Duplicate cart selections have conflicting displayed prices."
      );
    }

    normalized.set(key, {
      menuItemId,
      priceTier,
      quantity: combinedQuantity,
      ...(expectedUnitPriceMinor === undefined
        ? {}
        : { expectedUnitPriceMinor }),
    });
  }

  return [...normalized.values()];
}

export function validateCheckoutPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new CheckoutDomainError(
      "CHECKOUT_INVALID",
      "The checkout request could not be read."
    );
  }

  if (
    typeof payload.idempotencyKey !== "string" ||
    !IDEMPOTENCY_KEY_PATTERN.test(payload.idempotencyKey)
  ) {
    throw new CheckoutDomainError(
      "IDEMPOTENCY_INVALID",
      "This checkout session is invalid. Refresh checkout and try again."
    );
  }

  if (payload.paymentMethod !== PAYMENT_METHOD.CASH) {
    throw new CheckoutDomainError(
      "PAYMENT_METHOD_UNAVAILABLE",
      "Mobile Money and Card checkout are coming soon. Choose Cash at Pickup."
    );
  }

  const customer = validateCustomerDetails(payload);

  return {
    ...customer,
    note: normalizeCheckoutNote(payload.note),
    paymentMethod: PAYMENT_METHOD.CASH,
    idempotencyKey: payload.idempotencyKey.toLowerCase(),
    lines: validateCheckoutLines(payload.lines),
  };
}

export function deriveTrustedOrderLines(lines, menuItems) {
  const itemById = new Map(
    (Array.isArray(menuItems) ? menuItems : []).map((item) => [item.id, item])
  );
  const trustedLines = [];
  let subtotalMinor = 0;
  let priceChanged = false;

  for (const line of lines) {
    const item = itemById.get(line.menuItemId);

    if (!item || item.active !== true || item.category?.active !== true) {
      throw new CheckoutDomainError(
        "ITEM_REMOVED",
        "A cart item is no longer on the current menu. Review your cart and try again."
      );
    }

    if (item.available !== true) {
      throw new CheckoutDomainError(
        "ITEM_UNAVAILABLE",
        `${item.name} is currently unavailable. Your cart has been kept.`
      );
    }

    if (item.currency !== "GHS") {
      throw new CheckoutDomainError(
        "CATALOGUE_INVALID",
        "A menu price could not be verified. No order was created."
      );
    }

    const unitPriceMinor = deriveMenuPriceMinor(item, line.priceTier);

    if (unitPriceMinor === null) {
      throw new CheckoutDomainError(
        "PRICE_TIER_INVALID",
        `The selected price for ${item.name} is no longer valid.`
      );
    }

    const lineTotalMinor = unitPriceMinor * line.quantity;

    if (!Number.isSafeInteger(lineTotalMinor)) {
      throw new CheckoutDomainError(
        "TOTAL_INVALID",
        "The order total could not be calculated safely."
      );
    }

    if (
      line.expectedUnitPriceMinor !== undefined &&
      line.expectedUnitPriceMinor !== unitPriceMinor
    ) {
      priceChanged = true;
    }

    trustedLines.push({
      menuItemId: item.id,
      nameSnapshot: item.name,
      priceTier: line.priceTier,
      unitPriceMinor,
      quantity: line.quantity,
      lineTotalMinor,
    });
    subtotalMinor += lineTotalMinor;
  }

  if (!Number.isSafeInteger(subtotalMinor)) {
    throw new CheckoutDomainError(
      "TOTAL_INVALID",
      "The order total could not be calculated safely."
    );
  }

  if (priceChanged) {
    throw new CheckoutDomainError(
      "PRICE_CHANGED",
      "One or more menu prices changed. The checkout summary has been refreshed; review it before placing your order.",
      { details: { lines: trustedLines, subtotalMinor } }
    );
  }

  return { lines: trustedLines, subtotalMinor, totalMinor: subtotalMinor };
}

export function createOrderReference(now = new Date(), random = randomBytes) {
  const date = now instanceof Date ? now : new Date(now);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Order reference date is invalid.");
  }

  const dateKey = date.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = random(4).toString("hex").toUpperCase();

  return `KK-${dateKey}-${suffix}`;
}
