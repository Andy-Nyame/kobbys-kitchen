export function getOrderingAvailability({
  featureEnabled,
  acceptingOrders,
}) {
  if (!featureEnabled) {
    return {
      code: "BUILD_DISABLED",
      available: false,
      label: "Not enabled",
      message: "Online ordering is not enabled for this build.",
    };
  }

  if (!acceptingOrders) {
    return {
      code: "KITCHEN_PAUSED",
      available: false,
      label: "Not accepting orders",
      message: "Online ordering is available but the kitchen is not accepting orders.",
    };
  }

  return {
    code: "ACCEPTING_ORDERS",
    available: true,
    label: "Accepting orders",
    message: "Online ordering is available and the kitchen is accepting orders.",
  };
}
