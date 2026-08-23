import "server-only";

import { ADMIN_PAGE_SIZE, getDateRangeBounds } from "@/lib/admin/filters";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function listAdminPayments(filters) {
  const supabase = createSupabaseAdminClient();
  const start = (filters.page - 1) * ADMIN_PAGE_SIZE;
  const end = start + ADMIN_PAGE_SIZE - 1;
  const { fromIso, toExclusiveIso } = getDateRangeBounds(filters);
  let query = supabase
    .from("payments")
    .select(
      `
        method,
        status,
        amount_minor,
        currency,
        provider,
        provider_reference,
        paid_at,
        created_at,
        order:orders!inner(reference, customer_name_snapshot, status)
      `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(start, end);

  if (filters.paymentMethod) {
    query = query.eq("method", filters.paymentMethod);
  }

  if (filters.paymentStatus) {
    query = query.eq("status", filters.paymentStatus);
  }

  if (filters.search) {
    query = query.ilike("orders.reference", `%${filters.search}%`);
  }

  if (fromIso) {
    query = query.gte("created_at", fromIso);
  }

  if (toExclusiveIso) {
    query = query.lt("created_at", toExclusiveIso);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error("Unable to load admin payments", { cause: error });
  }

  return {
    rows: (data || []).map((payment) => ({
      ...payment,
      order: Array.isArray(payment.order)
        ? payment.order[0] || null
        : payment.order,
    })),
    total: count || 0,
    page: filters.page,
    pageSize: ADMIN_PAGE_SIZE,
  };
}
