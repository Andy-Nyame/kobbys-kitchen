export function getOrderingHubState(buildOrderingEnabled) {
  return {
    whatsappAvailable: true,
    onlinePickupAvailable: false,
    onlinePickupReason: buildOrderingEnabled
      ? "checkout_not_implemented"
      : "build_disabled",
  };
}
