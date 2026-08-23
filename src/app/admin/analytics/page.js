import Link from "next/link";

import AdminMetricCard from "@/components/admin/AdminMetricCard";
import AdminQueryNotice from "@/components/admin/AdminQueryNotice";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { parseAnalyticsFilters } from "@/lib/admin/filters";
import {
  formatAdminDate,
  formatMoneyMinor,
  formatStatusLabel,
} from "@/lib/admin/presentation";
import { getOrderMetrics } from "@/lib/analytics/order-queries";
import { requireAdmin } from "@/lib/auth/guards";
import { ORDER_STATUS, PAYMENT_METHOD } from "@/lib/orders/domain";

export const metadata = {
  title: "Admin Analytics | Kobby's Kitchen",
  description: "Kobby's Kitchen order and paid-revenue analytics.",
};

function buildDailyRows(metrics) {
  const rows = new Map();

  for (const item of metrics.orderCountByDay) {
    rows.set(item.day, {
      day: item.day,
      orderCount: Number(item.count || 0),
      revenueMinor: 0,
    });
  }

  for (const item of metrics.revenueByDay) {
    const row = rows.get(item.day) || {
      day: item.day,
      orderCount: 0,
      revenueMinor: 0,
    };
    row.revenueMinor = Number(item.revenue_minor || 0);
    rows.set(item.day, row);
  }

  return [...rows.values()].sort((left, right) => right.day.localeCompare(left.day));
}

export default async function AdminAnalyticsPage({ searchParams }) {
  await requireAdmin();

  const params = await searchParams;
  const { values: filters, errors } = parseAnalyticsFilters(params);
  let metrics = null;

  try {
    metrics = await getOrderMetrics(filters);
  } catch (error) {
    console.error("[admin-analytics]", error);
  }

  const dailyRows = metrics ? buildDailyRows(metrics) : [];

  return (
    <>
      <PageIntro
        eyebrow="Admin operations"
        title="Analytics and Revenue"
        description="Order activity and current paid-revenue reporting from logical payment records."
      />

      <ContentSection title="Date Range" description="Order counts use order creation time; revenue uses the trusted paid timestamp." className="admin-section">
        <AdminQueryNotice errors={errors} />
        <form className="admin-filter-form admin-filter-form--dates" action="/admin/analytics" method="GET">
          <label className="form-field">
            <span>From</span>
            <input name="from" type="date" defaultValue={filters.from} />
          </label>
          <label className="form-field">
            <span>To</span>
            <input name="to" type="date" defaultValue={filters.to} />
          </label>
          <div className="admin-filter-form__actions">
            <button className="button-link button-link--primary" type="submit">Apply range</button>
            <Link className="button-link button-link--secondary" href="/admin/analytics">Clear</Link>
          </div>
        </form>
      </ContentSection>

      <ContentSection title="Revenue Summary" description="Refunded, unpaid, pending and failed payments are excluded from revenue." className="admin-section">
        {metrics ? (
          <div className="admin-metric-grid">
            <AdminMetricCard label="Paid revenue" value={formatMoneyMinor(metrics.paidRevenueMinor)} />
            <AdminMetricCard label="Paid orders" value={metrics.paidOrderCount} />
            <AdminMetricCard label="Average paid order" value={formatMoneyMinor(metrics.averagePaidOrderValueMinor)} />
            <AdminMetricCard label="Unpaid cash" value={formatMoneyMinor(metrics.unpaidCashValueMinor)} note="Not revenue" tone="warning" />
            {Object.values(PAYMENT_METHOD).map((method) => (
              <AdminMetricCard key={method} label={`${formatStatusLabel(method)} paid`} value={formatMoneyMinor(metrics.revenueByPaymentMethodMinor[method])} />
            ))}
          </div>
        ) : (
          <p className="admin-data-error">Revenue analytics are temporarily unavailable.</p>
        )}
      </ContentSection>

      <ContentSection title="Orders by Status" description="Counts for orders created in the selected range." className="admin-section">
        {metrics ? (
          <div className="admin-metric-grid">
            {Object.values(ORDER_STATUS).map((status) => (
              <AdminMetricCard key={status} label={formatStatusLabel(status)} value={metrics.orderStatusCounts[status]} />
            ))}
          </div>
        ) : (
          <p className="admin-data-error">Order analytics are temporarily unavailable.</p>
        )}
      </ContentSection>

      <ContentSection title="Daily Activity" description="Only dates with recorded order or paid-revenue activity are shown." className="admin-section">
        {metrics && dailyRows.length > 0 ? (
          <div className="admin-table-shell" tabIndex="0" role="region" aria-label="Daily analytics table">
            <table className="admin-table admin-table--compact">
              <thead><tr><th scope="col">Date</th><th scope="col">Orders</th><th scope="col">Paid revenue</th></tr></thead>
              <tbody>
                {dailyRows.map((row) => (
                  <tr key={row.day}>
                    <td data-label="Date">{formatAdminDate(row.day)}</td>
                    <td data-label="Orders">{row.orderCount}</td>
                    <td data-label="Paid revenue">{formatMoneyMinor(row.revenueMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : metrics ? (
          <p className="admin-empty-state">No order or paid-revenue activity exists for this range.</p>
        ) : (
          <p className="admin-data-error">Daily analytics are temporarily unavailable.</p>
        )}
      </ContentSection>

      <ContentSection title="Top Completed Items" description="Quantity and snapshot revenue from orders that are both completed and paid." className="admin-section">
        {metrics && metrics.topItems.length > 0 ? (
          <div className="admin-table-shell" tabIndex="0" role="region" aria-label="Top items table">
            <table className="admin-table admin-table--compact">
              <thead><tr><th scope="col">Item</th><th scope="col">Quantity</th><th scope="col">Item revenue</th></tr></thead>
              <tbody>
                {metrics.topItems.map((item) => (
                  <tr key={item.item_name}>
                    <td data-label="Item">{item.item_name}</td>
                    <td data-label="Quantity">{Number(item.quantity || 0)}</td>
                    <td data-label="Item revenue">{formatMoneyMinor(Number(item.revenue_minor || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : metrics ? (
          <p className="admin-empty-state">Top items will appear after paid orders are completed.</p>
        ) : (
          <p className="admin-data-error">Item analytics are temporarily unavailable.</p>
        )}
      </ContentSection>
    </>
  );
}
