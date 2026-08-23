export function getAdminAuthorization(user, role) {
  if (!user) {
    return { allowed: false, redirectTo: "/login" };
  }

  if (role !== "ADMIN") {
    return { allowed: false, redirectTo: "/" };
  }

  return { allowed: true, redirectTo: null };
}
