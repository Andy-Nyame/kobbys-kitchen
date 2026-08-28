import AdminLoginForm from "@/components/admin/AdminLoginForm";
import AdminMetricCard from "@/components/admin/AdminMetricCard";
import AdminOrderTable from "@/components/admin/AdminOrderTable";
import ButtonLink from "@/components/ui/ButtonLink";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { getRecentAdminOrders } from "@/lib/admin/orders";
import { getAccountMetrics } from "@/lib/analytics/account-queries";
import { getAdminAccess } from "@/lib/auth/guards";
import { getSafeAdminRedirectPath } from "@/lib/auth/redirects";
import { getEffectiveOrderingState } from "@/lib/ordering/server";
import { formatGmtTransition } from "@/lib/ordering/presentation";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Admin Overview | Kobby's Kitchen", description: "Kobby's Kitchen operational overview." };

const orderingReasonLabels = {
  BUILD_DISABLED: "Online ordering is disabled by the deployment switch",
  EMERGENCY_PAUSED: "Emergency pause active",
  FORCED_OPEN: "Open by temporary override",
  FORCED_CLOSED: "Closed by temporary override",
  SCHEDULE_OPEN: "Open by weekly schedule",
  SCHEDULE_CLOSED: "Closed by weekly schedule",
  NO_SCHEDULE: "No ordering hours configured",
  CONFIGURATION_INVALID: "Ordering configuration requires attention",
};

export default async function AdminDashboardPage({ searchParams }) {
  const { authorization } = await getAdminAccess();
  if (!authorization.allowed) {
    const params = await searchParams;
    return <AdminLoginForm initialError={params?.error === "oauth_unavailable" ? "We could not complete that authentication request. Please try again." : ""} nextPath={getSafeAdminRedirectPath(params?.next)} />;
  }

  const [stateResult, accountsResult, ordersResult, reviewsResult] = await Promise.allSettled([
    getEffectiveOrderingState(), getAccountMetrics(), getRecentAdminOrders(5), prisma.review.count({ where: { status: "PENDING" } }),
  ]);
  for (const [area, result] of [["ordering", stateResult], ["accounts", accountsResult], ["orders", ordersResult], ["reviews", reviewsResult]]) if (result.status === "rejected") console.error(`[admin-overview:${area}]`, result.reason);
  const state = stateResult.status === "fulfilled" ? stateResult.value : null;
  const accounts = accountsResult.status === "fulfilled" ? accountsResult.value : null;
  const orders = ordersResult.status === "fulfilled" ? ordersResult.value : null;
  const pendingReviews = reviewsResult.status === "fulfilled" ? reviewsResult.value : null;
  const transition = state?.acceptingOrders ? formatGmtTransition(state.nextCloseAt, state.currentTime, "Closes") : formatGmtTransition(state?.nextOpenAt, state?.currentTime, "Opens");

  return <>
    <PageIntro eyebrow="Admin operations" title="Overview" description="A concise view of ordering, active work, customer accounts and review activity." />
    <section className="admin-operational-status" aria-labelledby="ordering-state-title"><div><p className="admin-section-eyebrow">Current ordering status</p><h2 id="ordering-state-title">{state ? state.acceptingOrders ? "OPEN" : "CLOSED" : "Unavailable"}</h2><p>{state ? `${orderingReasonLabels[state.reason] || "Ordering state resolved"}${transition ? ` · ${transition}` : ""}` : "The authoritative ordering state could not be loaded."}</p></div><span className={`admin-availability admin-availability--${state?.acceptingOrders ? "open" : "closed"}`}>{state?.acceptingOrders ? "Open" : "Closed"}</span></section>
    <ContentSection title="At a Glance" description="High-level indicators link to their detailed administrative domains." className="admin-section">
      <div className="admin-metric-grid"><AdminMetricCard label="Registered customers" value={accounts?.customerCount ?? "—"} /><AdminMetricCard label="New accounts (7 days)" value={accounts?.registrationsSevenDays ?? "—"} /><AdminMetricCard label="Pending reviews" value={pendingReviews ?? "—"} tone={pendingReviews ? "warning" : "default"} /><AdminMetricCard label="Orders shown" value={orders?.length ?? "—"} note="Active work prioritized" /></div>
      <div className="section-actions"><ButtonLink href="/admin/operations" variant="secondary">Manage Operations</ButtonLink><ButtonLink href="/admin/analytics" variant="secondary">Account Analytics</ButtonLink><ButtonLink href="/admin/reviews" variant="secondary">Review Moderation</ButtonLink></div>
    </ContentSection>
    <ContentSection title="Active and Recent Orders" description="Active work is prioritized, followed by the newest records." className="admin-section">{orders ? <AdminOrderTable orders={orders} /> : <p className="admin-data-error">Recent orders are temporarily unavailable.</p>}<div className="section-actions"><ButtonLink href="/admin/orders" variant="secondary">Open Orders</ButtonLink><ButtonLink href="/admin/orders?view=analytics" variant="secondary">Revenue &amp; Analytics</ButtonLink></div></ContentSection>
  </>;
}
