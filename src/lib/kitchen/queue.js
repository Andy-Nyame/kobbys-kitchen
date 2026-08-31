export const ACTIVE_KITCHEN_STATUSES = Object.freeze([
  "CONFIRMED",
  "PREPARING",
]);

export function isActiveKitchenOrder(order) {
  return ACTIVE_KITCHEN_STATUSES.includes(order?.status);
}

export function isReadyKitchenOrder(order) {
  return order?.status === "READY_FOR_PICKUP";
}

function compareDates(left, right) {
  return new Date(left).getTime() - new Date(right).getTime();
}

function compareReference(left, right) {
  return String(left.reference).localeCompare(String(right.reference));
}

export function sortActiveKitchenOrders(orders) {
  return [...orders]
    .filter(isActiveKitchenOrder)
    .sort(
      (left, right) =>
        compareDates(left.acceptedAt, right.acceptedAt) ||
        compareReference(left, right)
    );
}

export function sortReadyKitchenOrders(orders) {
  return [...orders]
    .filter(isReadyKitchenOrder)
    .sort(
      (left, right) =>
        compareDates(left.readyAt, right.readyAt) ||
        compareReference(left, right)
    );
}
