import "server-only";

import { summarizeOrderMetrics } from "@/lib/analytics/order-metrics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getOrderMetrics() {
  const supabase = createSupabaseAdminClient();
  const [ordersResult, paymentsResult] = await Promise.all([
    supabase.from("orders").select("id, status"),
    supabase
      .from("payments")
      .select("order_id, method, status, amount_minor"),
  ]);

  if (ordersResult.error) {
    throw new Error("Unable to load order metrics", {
      cause: ordersResult.error,
    });
  }

  if (paymentsResult.error) {
    throw new Error("Unable to load payment metrics", {
      cause: paymentsResult.error,
    });
  }

  return summarizeOrderMetrics({
    orders: ordersResult.data || [],
    payments: paymentsResult.data || [],
  });
}
