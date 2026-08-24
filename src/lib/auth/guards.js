import { createClient } from "@/lib/supabase/server";
import { getAdminAuthorization } from "@/lib/auth/authorization";
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

export const requireCustomer = cache(async function requireCustomer() {
  const user = await requireAuthenticatedUser();
  const role = await getUserRole(user.id);

  if (role !== "CUSTOMER") {
    redirect("/");
  }

  return user;
});

export const requireAdmin = cache(async function requireAdmin() {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  const authorization = getAdminAuthorization(user, role);

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
