import { auth } from "@/auth";
import { getAdminAuthorization } from "@/lib/auth/authorization";
import { ensureCustomerAccountById } from "@/lib/auth/provisioning";
import { getCustomerLoginPath } from "@/lib/auth/redirects";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { cache } from "react";

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function getAuthenticatedUser() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
    },
  });
}

export const getCustomerAccess = cache(async function getCustomerAccess() {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;

  return { user, role };
});

export const requireCustomer = cache(async function requireCustomer(
  intendedPath = "/account"
) {
  const { user, role } = await getCustomerAccess();

  if (!user) {
    redirect(getCustomerLoginPath(intendedPath));
  }

  if (role !== "CUSTOMER") {
    redirect("/");
  }

  return user;
});

export const getAdminAccess = cache(async function getAdminAccess() {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;

  return {
    user,
    role,
    authorization: getAdminAuthorization(user, role),
  };
});

export const requireAdmin = cache(async function requireAdmin(
  intendedPath = "/admin"
) {
  const { user, role } = await getAdminAccess();
  const authorization = getAdminAuthorization(user, role, intendedPath);

  if (!authorization.allowed) {
    redirect(authorization.redirectTo);
  }

  return user;
});

export const getKitchenAccess = cache(async function getKitchenAccess() {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;

  return { user, role, allowed: role === "ADMIN" || role === "CHEF" };
});

export const requireKitchen = cache(async function requireKitchen(
  intendedPath = "/kitchen"
) {
  const { user, allowed } = await getKitchenAccess();

  if (!user) {
    redirect(`/kitchen?next=${encodeURIComponent(intendedPath)}`);
  }

  if (!allowed) {
    redirect("/access-denied?area=kitchen");
  }

  return user;
});

export async function getUserRole(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return user?.role || null;
}

export async function getUserProfile(userId) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { displayName: true, phone: true, imageUrl: true },
  });

  if (!profile) {
    return null;
  }

  return {
    display_name: profile.displayName,
    phone: profile.phone,
    image_url: profile.imageUrl,
  };
}

export async function ensureCustomerProfile(user) {
  if (!user?.id) {
    return null;
  }

  const result = await ensureCustomerAccountById(user.id);

  if (!result?.profile) {
    return null;
  }

  return {
    display_name: result.profile.displayName,
    phone: result.profile.phone,
    image_url: result.profile.imageUrl,
  };
}
