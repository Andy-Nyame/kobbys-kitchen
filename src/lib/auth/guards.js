import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return user;
}

export async function requireCustomer() {
  const user = await requireAuthenticatedUser();

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "CUSTOMER") {
    redirect("/");
  }

  return { user, profile };
}

export async function requireAdmin() {
  const user = await requireAuthenticatedUser();

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "ADMIN") {
    redirect("/");
  }

  return { user, profile };
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

export async function getUserProfile(userId) {
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !profile) {
    return null;
  }

  return profile;
}

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
