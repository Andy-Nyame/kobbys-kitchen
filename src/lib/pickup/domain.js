import { randomInt } from "node:crypto";

export const PICKUP_CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const PICKUP_CODE_PATTERN = /^[A-HJ-NP-Z0-9]{4}$/;
export const PICKUP_ACTOR_ROLES = Object.freeze(["ADMIN", "CHEF"]);

export class PickupWorkflowError extends Error {
  constructor(message, status = 409, code = "PICKUP_CONFLICT") {
    super(message);
    this.name = "PickupWorkflowError";
    this.status = status;
    this.code = code;
  }
}

export function normalizePickupCode(value) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/\s+/g, "").toUpperCase();
}

export function isValidPickupCode(value) {
  const normalized = normalizePickupCode(value);
  return (
    PICKUP_CODE_PATTERN.test(normalized) &&
    normalized.replace(/[0-9]/g, "").length === 1 &&
    normalized.replace(/[A-HJ-NP-Z]/g, "").length === 3
  );
}

export function generatePickupCode(random = randomInt) {
  const letter = PICKUP_CODE_LETTERS[random(PICKUP_CODE_LETTERS.length)];
  const digits = [random(10), random(10), random(10)].map(String);
  const position = random(4);
  const characters = [...digits];
  characters.splice(position, 0, letter);
  return characters.join("");
}

export function assertPickupActorRole(role) {
  if (!PICKUP_ACTOR_ROLES.includes(role)) {
    throw new PickupWorkflowError("Kitchen authorization is required.", 403, "KITCHEN_REQUIRED");
  }
}

export function getPickupPresentation(order) {
  return {
    reference: order.reference,
    pickupName: order.customerNameSnapshot,
    status: order.status,
    totalMinor: order.totalMinor,
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    items: (order.items || []).map((item) => ({
      name: item.nameSnapshot,
      quantity: item.quantity,
      priceTier: item.priceTier,
    })),
  };
}
