import { createClient } from "@/lib/supabase/server";
import { getAdminAuthorization } from "@/lib/auth/authorization";
import { getCustomerProfileProvisioningDecision } from "@/lib/auth/customer-profile-provisioning";
import { getCustomerLoginPath } from "@/lib/auth/redirects";
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
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
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

export async function getUserRole(userId) {
  const supabase = await createClient();
  const { data: roleRow, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error || !roleRow) {
    return null;
  }

  return roleRow.role;
}

export async function getUserProfile(userId) {
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, phone")
    .eq("user_id", userId)
    .single();

  if (error || !profile) {
    return null;
  }

  return profile;
}

export async function ensureCustomerProfile(user) {
  if (!user?.id) {
    return null;
  }

  const existingProfile = await getUserProfile(user.id);

  if (existingProfile) {
    return existingProfile;
  }

  const role = await getUserRole(user.id);
  const decision = getCustomerProfileProvisioningDecision({
    user,
    role,
    profile: null,
  });

  if (decision !== "repair") {
    return null;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("ensure_current_customer_profile");

  if (error) {
    console.error("[ensure-customer-profile]", { reason: error.code || "rpc_failed" });
    return null;
  }

  return getUserProfile(user.id);
}
