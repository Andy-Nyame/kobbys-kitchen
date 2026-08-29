export function getAuthSignInPolicy({ provider, userId, databaseUser }) {
  const isGoogle = provider === "google";

  if (!userId) {
    return { allowed: isGoogle, provisionCustomer: false };
  }

  if (!databaseUser) {
    return { allowed: isGoogle, provisionCustomer: false };
  }

  return {
    allowed: true,
    provisionCustomer: databaseUser.role === "CUSTOMER",
  };
}
