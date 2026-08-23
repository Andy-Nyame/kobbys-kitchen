import "server-only";

import { getDateRangeBounds } from "@/lib/admin/filters";
import { normalizeOrderMetricsRecord } from "@/lib/analytics/order-metrics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getOrderMetrics(dateRange = {}) {
  const supabase = createSupabaseAdminClient();
  const { fromIso, toExclusiveIso } = getDateRangeBounds(dateRange);
  const { data, error } = await supabase.rpc("get_admin_dashboard_metrics", {
    p_from: fromIso,
    p_to: toExclusiveIso,
  });

  if (error) {
    throw new Error("Unable to load admin analytics", { cause: error });
  }

  return normalizeOrderMetricsRecord(data);
}
