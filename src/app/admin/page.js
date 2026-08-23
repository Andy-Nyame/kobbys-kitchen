import AdminMetricCard from "@/components/admin/AdminMetricCard";
import AdminOrderTable from "@/components/admin/AdminOrderTable";
import ButtonLink from "@/components/ui/ButtonLink";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { getRecentAdminOrders } from "@/lib/admin/orders";
import { getOrderingAvailability } from "@/lib/admin/ordering-status";
import { formatMoneyMinor } from "@/lib/admin/presentation";
import { getAdminOrderingSettings } from "@/lib/admin/settings";
import { getOrderMetrics } from "@/lib/analytics/order-queries";
import { requireAdmin } from "@/lib/auth/guards";
import { isOrderingEnabled } from "@/lib/feature-flags";
import { ORDER_STATUS } from "@/lib/orders/domain";

export const metadata = {
  title: "Admin Overview | Kobby's Kitchen",
  description: "Kobby's Kitchen operational overview.",
};

function logDashboardError(area, result) {
  if (result.status === "rejected") {
    console.error(`[admin-overview:${area}]`, result.reason);
  }
}

export default async function AdminDashboardPage() {
  await requireAdmin();

  const [metricsResult, ordersResult, settingsResult] = await Promise.allSettled([
    getOrderMetrics(),
    getRecentAdminOrders(8),
    getAdminOrderingSettings(),
  ]);

  logDashboardError("metrics", metricsResult);
  logDashboardError("orders", ordersResult);
  logDashboardError("settings", settingsResult);

  const metrics = metricsResult.status === "fulfilled" ? metricsResult.value : null;
  const recentOrders = ordersResult.status === "fulfilled" ? ordersResult.value : null;
  const settings = settingsResult.status === "fulfilled" ? settingsResult.value : null;
  const orderingStatus = getOrderingAvailability({
    featureEnabled: isOrderingEnabled(),
    acceptingOrders: settings?.acceptingOrders === true,
  });

  return (
    <>
      <PageIntro
        eyebrow="Admin operations"
        title="Overview"
        description="A read-only view of orders, payments, revenue and kitchen availability."
      />

      <section className="admin-operational-status" aria-labelledby="ordering-state-title">
        <div>
          <p className="admin-section-eyebrow">Ordering state</p>
          <h2 id="ordering-state-title">{orderingStatus.label}</h2>
          <p>{orderingStatus.message}</p>
          {settingsResult.status === "rejected" ? (
            <p className="admin-inline-error">The operational setting could not be loaded.</p>
          ) : null}
        </div>
        <span className={`admin-availability admin-availability--${orderingStatus.available ? "open" : "closed"}`}>
          {orderingStatus.available ? "Available" : "Unavailable"}
        </span>
      </section>

      <ContentSection
        title="Order Summary"
        description="Current order totals from the operational database."
        className="admin-section"
      >
        {metrics ? (
          <div className="admin-metric-grid">
            <AdminMetricCard label="Total orders" value={metrics.totalOrders} />
            <AdminMetricCard label="Awaiting payment" value={metrics.orderStatusCounts[ORDER_STATUS.AWAITING_PAYMENT]} tone="warning" />
            <AdminMetricCard label="Pending" value={metrics.orderStatusCounts[ORDER_STATUS.PENDING]} tone="warning" />
            <AdminMetricCard label="Preparing" value={metrics.orderStatusCounts[ORDER_STATUS.PREPARING]} tone="info" />
            <AdminMetricCard label="Ready for pickup" value={metrics.orderStatusCounts[ORDER_STATUS.READY_FOR_PICKUP]} tone="success" />
            <AdminMetricCard label="Completed" value={metrics.orderStatusCounts[ORDER_STATUS.COMPLETED]} tone="success" />
            <AdminMetricCard label="Cancelled" value={metrics.orderStatusCounts[ORDER_STATUS.CANCELLED]} tone="danger" />
            <AdminMetricCard label="Paid revenue" value={formatMoneyMinor(metrics.paidRevenueMinor)} note="Logical PAID payments only" />
            <AdminMetricCard label="Unpaid cash" value={formatMoneyMinor(metrics.unpaidCashValueMinor)} note="Not counted as revenue" tone="warning" />
          </div>
        ) : (
          <p className="admin-data-error">Order metrics are temporarily unavailable.</p>
        )}
      </ContentSection>

      <ContentSection title="Payment Summary" description="Collected cash, electronic payments and outstanding payment states." className="admin-section">
        {metrics ? (
          <div className="admin-metric-grid admin-metric-grid--payments">
            <AdminMetricCard label="Cash paid" value={formatMoneyMinor(metrics.paymentSummary.cashPaidMinor)} />
            <AdminMetricCard label="Cash unpaid" value={formatMoneyMinor(metrics.paymentSummary.cashUnpaidMinor)} note={`${metrics.paymentSummary.cashUnpaidCount} order${metrics.paymentSummary.cashUnpaidCount === 1 ? "" : "s"}`} tone="warning" />
            <AdminMetricCard label="Mobile Money paid" value={formatMoneyMinor(metrics.paymentSummary.mobileMoneyPaidMinor)} />
            <AdminMetricCard label="Card paid" value={formatMoneyMinor(metrics.paymentSummary.cardPaidMinor)} />
            <AdminMetricCard label="Electronic pending" value={metrics.paymentSummary.pendingElectronicCount} tone="warning" />
            <AdminMetricCard label="Electronic failed" value={metrics.paymentSummary.failedElectronicCount} tone="danger" />
          </div>
        ) : (
          <p className="admin-data-error">Payment metrics are temporarily unavailable.</p>
        )}
        <div className="section-actions">
          <ButtonLink href="/admin/payments" variant="secondary">View Payments</ButtonLink>
          <ButtonLink href="/admin/analytics" variant="secondary">View Analytics</ButtonLink>
        </div>
      </ContentSection>

      <ContentSection title="Active and Recent Orders" description="Active work is prioritized, followed by the newest orders." className="admin-section">
        {recentOrders ? (
          <AdminOrderTable orders={recentOrders} />
        ) : (
          <p className="admin-data-error">Recent orders are temporarily unavailable.</p>
        )}
        <div className="section-actions">
          <ButtonLink href="/admin/orders" variant="secondary">View All Orders</ButtonLink>
        </div>
      </ContentSection>
    </>
  );
}
