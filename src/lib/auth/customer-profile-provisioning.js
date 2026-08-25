export function getCustomerProfileProvisioningDecision({ user, role, profile }) {
  if (!user?.id) {
    return "unavailable";
  }

  if (role !== "CUSTOMER") {
    return "not_customer";
  }

  return profile ? "existing" : "repair";
}
