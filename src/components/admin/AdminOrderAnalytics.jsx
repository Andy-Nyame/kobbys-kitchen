import Link from "next/link";

import AnalyticsBarChart from "@/components/admin/AnalyticsBarChart";
import AdminMetricCard from "@/components/admin/AdminMetricCard";
import AdminQueryNotice from "@/components/admin/AdminQueryNotice";
import ContentSection from "@/components/ui/ContentSection";
import {
  formatAdminDate,
  formatMoneyMinor,
  formatStatusLabel,
} from "@/lib/admin/presentation";
import { ORDER_STATUS, PAYMENT_METHOD } from "@/lib/orders/domain";

function buildDailyRows(metrics) {
  const rows = new Map();
  for (const item of metrics.orderCountByDay) {
    rows.set(item.day, { day: item.day, orderCount: Number(item.count || 0), revenueMinor: 0 });
  }
  for (const item of metrics.revenueByDay) {
    const row = rows.get(item.day) || { day: item.day, orderCount: 0, revenueMinor: 0 };
    row.revenueMinor = Number(item.revenue_minor || 0);
    rows.set(item.day, row);
  }
  return [...rows.values()].sort((left, right) => right.day.localeCompare(left.day));
}

export default function AdminOrderAnalytics({ metrics, filters, errors }) {
  const dailyRows = metrics ? buildDailyRows(metrics) : [];
  const chronologicalRows = [...dailyRows].reverse();

  return (
    <div className="analytics-dashboard">
      <section className="analytics-toolbar" aria-labelledby="analytics-range-title">
        <div>
          <p className="admin-section-eyebrow">Dashboard filters</p>
          <h2 id="analytics-range-title">Date Range</h2>
          <p>Order counts use creation time; recognized revenue uses the trusted paid timestamp.</p>
        </div>
        <AdminQueryNotice errors={errors} />
        <form className="admin-filter-form admin-filter-form--dates" action="/admin/orders" method="GET">
          <input type="hidden" name="view" value="analytics" />
          <label className="form-field"><span>From</span><input name="from" type="date" defaultValue={filters.from} /></label>
          <label className="form-field"><span>To</span><input name="to" type="date" defaultValue={filters.to} /></label>
          <div className="admin-filter-form__actions">
            <button className="button-link button-link--primary" type="submit">Apply range</button>
            <Link className="button-link button-link--secondary" href="/admin/orders?view=analytics">Clear</Link>
          </div>
        </form>
      </section>

      <ContentSection title="Order and Revenue Summary" description="Cancelled, refunded, unpaid, pending and failed payments are excluded from recognized revenue." className="admin-section">
        {metrics ? <div className="analytics-kpi-grid">
          <AdminMetricCard label="Recognized revenue" value={formatMoneyMinor(metrics.paidRevenueMinor)} note="Paid, non-cancelled orders" tone="success" />
          <AdminMetricCard label="Gross order value" value={formatMoneyMinor(metrics.grossOrderValueMinor)} note="Non-cancelled orders" />
          <AdminMetricCard label="Paid orders" value={metrics.paidOrderCount} note="Recognized payments" />
          <AdminMetricCard label="Average order value" value={formatMoneyMinor(metrics.averageOrderValueMinor)} note="All non-cancelled orders" />
          <AdminMetricCard label="Average paid order" value={formatMoneyMinor(metrics.averagePaidOrderValueMinor)} note="Paid orders only" />
        </div> : <p className="admin-data-error">Order analytics are temporarily unavailable.</p>}
      </ContentSection>

      <ContentSection title="Payment Breakdown" description="Recognized revenue by payment method, with unpaid cash shown separately." className="admin-section">
        {metrics ? <div className="analytics-kpi-grid analytics-kpi-grid--payments">
          {Object.values(PAYMENT_METHOD).map((method) => <AdminMetricCard key={method} label={`${formatStatusLabel(method)} paid`} value={formatMoneyMinor(metrics.revenueByPaymentMethodMinor[method])} note="Recognized revenue" tone="info" />)}
          <AdminMetricCard label="Unpaid cash" value={formatMoneyMinor(metrics.unpaidCashValueMinor)} note="Not recognized revenue" tone="warning" />
        </div> : <p className="admin-data-error">Payment analytics are temporarily unavailable.</p>}
      </ContentSection>

      <div className="analytics-chart-grid">
        <ContentSection title="Revenue Trend" description="Recognized revenue by trusted paid date." className="admin-section analytics-chart-card">
          {metrics ? <AnalyticsBarChart
            ariaLabel="Recognized revenue by date"
            data={chronologicalRows}
            emptyWhenZero
            emptyMessage="No recognized revenue exists for this range."
            formatValue={formatMoneyMinor}
            getKey={(row) => `revenue-${row.day}`}
            getLabel={(row) => formatAdminDate(row.day)}
            getShortLabel={(row) => row.day.slice(5)}
            getValue={(row) => row.revenueMinor}
          /> : <p className="admin-data-error">Revenue trends are temporarily unavailable.</p>}
        </ContentSection>

        <ContentSection title="Order Activity" description="Orders created on each recorded date." className="admin-section analytics-chart-card">
          {metrics ? <AnalyticsBarChart
            ariaLabel="Order activity by date"
            data={chronologicalRows}
            emptyMessage="No order activity exists for this range."
            getKey={(row) => `orders-${row.day}`}
            getLabel={(row) => formatAdminDate(row.day)}
            getShortLabel={(row) => row.day.slice(5)}
            getValue={(row) => row.orderCount}
          /> : <p className="admin-data-error">Order trends are temporarily unavailable.</p>}
        </ContentSection>
      </div>

      <ContentSection title="Orders by Status" description="Counts for orders created in the selected range." className="admin-section">
        {metrics ? <div className="analytics-kpi-grid analytics-kpi-grid--breakdown">{Object.values(ORDER_STATUS).map((status) => <AdminMetricCard key={status} label={formatStatusLabel(status)} value={metrics.orderStatusCounts[status]} />)}</div> : <p className="admin-data-error">Order analytics are temporarily unavailable.</p>}
      </ContentSection>

      <ContentSection title="Daily Activity" description="Only dates with recorded orders or recognized revenue are shown." className="admin-section">
        {metrics && dailyRows.length ? <div className="admin-table-shell" tabIndex="0" role="region" aria-label="Daily order analytics"><table className="admin-table admin-table--compact"><thead><tr><th scope="col">Date</th><th scope="col">Orders</th><th scope="col">Recognized revenue</th></tr></thead><tbody>{dailyRows.map((row) => <tr key={row.day}><td data-label="Date">{formatAdminDate(row.day)}</td><td data-label="Orders">{row.orderCount}</td><td data-label="Recognized revenue">{formatMoneyMinor(row.revenueMinor)}</td></tr>)}</tbody></table></div> : metrics ? <p className="admin-empty-state">No order or recognized-revenue activity exists for this range.</p> : <p className="admin-data-error">Daily analytics are temporarily unavailable.</p>}
      </ContentSection>

      <ContentSection title="Top Completed Items" description="Quantity and snapshot revenue from completed, paid orders." className="admin-section">
        {metrics && metrics.topItems.length ? <div className="admin-table-shell" tabIndex="0" role="region" aria-label="Top completed items"><table className="admin-table admin-table--compact"><thead><tr><th scope="col">Rank</th><th scope="col">Item</th><th scope="col">Quantity</th><th scope="col">Item revenue</th></tr></thead><tbody>{metrics.topItems.map((item, index) => <tr key={item.item_name}><td data-label="Rank">{index + 1}</td><td data-label="Item">{item.item_name}</td><td data-label="Quantity">{Number(item.quantity || 0)}</td><td data-label="Item revenue">{formatMoneyMinor(Number(item.revenue_minor || 0))}</td></tr>)}</tbody></table></div> : metrics ? <p className="admin-empty-state">Top items will appear after paid orders are completed.</p> : <p className="admin-data-error">Item analytics are temporarily unavailable.</p>}
      </ContentSection>
    </div>
  );
}
