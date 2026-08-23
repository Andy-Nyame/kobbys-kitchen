import "server-only";

import { ADMIN_PAGE_SIZE, getDateRangeBounds } from "@/lib/admin/filters";
import { ORDER_STATUS } from "@/lib/orders/domain";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ORDER_FIELDS = `
  reference,
  customer_name_snapshot,
  phone_snapshot,
  total_minor,
  currency,
  status,
  created_at
`;

const PAYMENT_FIELDS = "method, status";
const ACTIVE_ORDER_STATUSES = [
  ORDER_STATUS.AWAITING_PAYMENT,
  ORDER_STATUS.PENDING,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY_FOR_PICKUP,
];

function normalizePayment(payment) {
  if (Array.isArray(payment)) {
    return payment[0] || null;
  }

  return payment || null;
}

function normalizeOrders(orders) {
  return (orders || []).map((order) => ({
    ...order,
    payment: normalizePayment(order.payment),
  }));
}

function applyOrderDateRange(query, filters) {
  const { fromIso, toExclusiveIso } = getDateRangeBounds(filters);
  let nextQuery = query;

  if (fromIso) {
    nextQuery = nextQuery.gte("created_at", fromIso);
  }

  if (toExclusiveIso) {
    nextQuery = nextQuery.lt("created_at", toExclusiveIso);
  }

  return nextQuery;
}

export async function getRecentAdminOrders(limit = 8) {
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);
  const supabase = createSupabaseAdminClient();
  const selectFields = `${ORDER_FIELDS}, payment:payments(${PAYMENT_FIELDS})`;
  const [activeResult, recentResult] = await Promise.all([
    supabase
      .from("orders")
      .select(selectFields)
      .in("status", ACTIVE_ORDER_STATUSES)
      .order("created_at", { ascending: false })
      .limit(safeLimit),
    supabase
      .from("orders")
      .select(selectFields)
      .order("created_at", { ascending: false })
      .limit(safeLimit),
  ]);

  if (activeResult.error || recentResult.error) {
    throw new Error("Unable to load recent admin orders", {
      cause: activeResult.error || recentResult.error,
    });
  }

  const prioritized = [...(activeResult.data || []), ...(recentResult.data || [])];
  const uniqueOrders = new Map();

  for (const order of prioritized) {
    if (!uniqueOrders.has(order.reference)) {
      uniqueOrders.set(order.reference, order);
    }
  }

  return normalizeOrders([...uniqueOrders.values()].slice(0, safeLimit));
}

export async function listAdminOrders(filters) {
  const supabase = createSupabaseAdminClient();
  const hasPaymentFilter = Boolean(
    filters.paymentMethod || filters.paymentStatus
  );
  const paymentRelation = hasPaymentFilter
    ? `payment:payments!inner(${PAYMENT_FIELDS})`
    : `payment:payments(${PAYMENT_FIELDS})`;
  const start = (filters.page - 1) * ADMIN_PAGE_SIZE;
  const end = start + ADMIN_PAGE_SIZE - 1;
  let query = supabase
    .from("orders")
    .select(`${ORDER_FIELDS}, ${paymentRelation}`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(start, end);

  if (filters.orderStatus) {
    query = query.eq("status", filters.orderStatus);
  }

  if (filters.paymentMethod) {
    query = query.eq("payments.method", filters.paymentMethod);
  }

  if (filters.paymentStatus) {
    query = query.eq("payments.status", filters.paymentStatus);
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    query = query.or(
      `reference.ilike.${pattern},customer_name_snapshot.ilike.${pattern},phone_snapshot.ilike.${pattern}`
    );
  }

  query = applyOrderDateRange(query, filters);
  const { data, error, count } = await query;

  if (error) {
    throw new Error("Unable to load admin orders", { cause: error });
  }

  return {
    rows: normalizeOrders(data),
    total: count || 0,
    page: filters.page,
    pageSize: ADMIN_PAGE_SIZE,
  };
}
