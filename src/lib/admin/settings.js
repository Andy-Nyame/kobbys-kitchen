import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getAdminOrderingSettings() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ordering_settings")
    .select("accepting_orders, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load ordering settings", { cause: error });
  }

  return {
    acceptingOrders: data?.accepting_orders === true,
    updatedAt: data?.updated_at || null,
    configured: Boolean(data),
  };
}
