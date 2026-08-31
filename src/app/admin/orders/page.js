import Link from "next/link";

import AdminOrderAnalytics from "@/components/admin/AdminOrderAnalytics";
import AdminOrderTable from "@/components/admin/AdminOrderTable";
import AdminPagination from "@/components/admin/AdminPagination";
import AdminQueryNotice from "@/components/admin/AdminQueryNotice";
import OperationalAutoRefresh from "@/components/operations/OperationalAutoRefresh";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { parseAnalyticsFilters, parseOrderFilters } from "@/lib/admin/filters";
import { HISTORY_ORDER_STATUSES, IN_PROGRESS_ORDER_STATUSES, NEW_ORDER_STATUSES, listAdminOrders } from "@/lib/admin/orders";
import { formatStatusLabel } from "@/lib/admin/presentation";
import { getOrderMetrics } from "@/lib/analytics/order-queries";
import { requireAdmin } from "@/lib/auth/guards";
import { PAYMENT_METHOD, PAYMENT_STATUS } from "@/lib/orders/domain";
import PickupVerification from "@/components/pickup/PickupVerification";

export const metadata = { title: "Admin Orders | Kobby's Kitchen", description: "Kobby's Kitchen active orders, history and revenue analytics." };

const VIEWS = {
  new: { label: "New Orders", statuses: NEW_ORDER_STATUSES },
  progress: { label: "In Progress", statuses: IN_PROGRESS_ORDER_STATUSES },
  history: { label: "History", statuses: HISTORY_ORDER_STATUSES },
  analytics: { label: "Revenue & Analytics", statuses: null },
};

function getView(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return Object.hasOwn(VIEWS, candidate) ? candidate : "new";
}

export default async function AdminOrdersPage({ searchParams }) {
  await requireAdmin("/admin/orders");
  const params = await searchParams;
  const view = getView(params?.view);
  const analytics = parseAnalyticsFilters(params);
  const orderFilters = parseOrderFilters(params);
  let result = null;
  let metrics = null;
  try {
    if (view === "analytics") metrics = await getOrderMetrics(analytics.values);
    else result = await listAdminOrders(orderFilters.values, { statuses: VIEWS[view].statuses });
  } catch (error) {
    console.error(`[admin-orders:${view}]`, error);
  }

  return <>
    {view === "analytics" ? null : <OperationalAutoRefresh exactPaths={["/admin/orders"]} />}
    <PageIntro eyebrow="Admin operations" title="Orders" description="Manage active work, review order history, and inspect server-authoritative revenue analytics." />
    <PickupVerification compact />
    <nav className="admin-domain-tabs" aria-label="Order sections">
      {Object.entries(VIEWS).map(([key, item]) => <Link key={key} href={`/admin/orders?view=${key}`} aria-current={view === key ? "page" : undefined} className={view === key ? "admin-domain-tabs__link admin-domain-tabs__link--current" : "admin-domain-tabs__link"}>{item.label}</Link>)}
    </nav>
    {view === "analytics" ? <AdminOrderAnalytics metrics={metrics} filters={analytics.values} errors={analytics.errors} /> : <>
      <ContentSection title={`${VIEWS[view].label} Filters`} description={view === "history" ? "Filter completed and cancelled order records." : "Find orders requiring operational attention."} className="admin-section">
        <AdminQueryNotice errors={orderFilters.errors} />
        <form className="admin-filter-form" action="/admin/orders" method="GET">
          <input type="hidden" name="view" value={view} />
          <label className="form-field admin-filter-form__search"><span>Reference, customer or phone</span><input name="search" type="search" defaultValue={orderFilters.values.search} maxLength="80" /></label>
          <label className="form-field"><span>Order status</span><select name="orderStatus" defaultValue={orderFilters.values.orderStatus}><option value="">All {view} statuses</option>{VIEWS[view].statuses.map((status) => <option key={status} value={status}>{formatStatusLabel(status)}</option>)}</select></label>
          <label className="form-field"><span>Payment method</span><select name="paymentMethod" defaultValue={orderFilters.values.paymentMethod}><option value="">All methods</option>{Object.values(PAYMENT_METHOD).map((method) => <option key={method} value={method}>{formatStatusLabel(method)}</option>)}</select></label>
          <label className="form-field"><span>Payment status</span><select name="paymentStatus" defaultValue={orderFilters.values.paymentStatus}><option value="">All payment states</option>{Object.values(PAYMENT_STATUS).map((status) => <option key={status} value={status}>{formatStatusLabel(status)}</option>)}</select></label>
          <label className="form-field"><span>From</span><input name="from" type="date" defaultValue={orderFilters.values.from} /></label><label className="form-field"><span>To</span><input name="to" type="date" defaultValue={orderFilters.values.to} /></label>
          <div className="admin-filter-form__actions"><button className="button-link button-link--primary" type="submit">Apply filters</button><Link className="button-link button-link--secondary" href={`/admin/orders?view=${view}`}>Clear</Link></div>
        </form>
      </ContentSection>
      <ContentSection title={view === "new" ? "New Order Queue" : view === "progress" ? "Orders In Progress" : "Order History"} description={result ? `${result.total} matching order${result.total === 1 ? "" : "s"}.` : "Order data is currently unavailable."} className="admin-section">
        {result ? <><AdminOrderTable orders={result.rows} showReceiptActions={view === "history"} emptyMessage={view === "new" ? "There are no new orders awaiting confirmation." : view === "progress" ? "There are no orders currently being prepared." : "There is no completed or cancelled order history yet."} /><AdminPagination basePath="/admin/orders" page={result.page} pageSize={result.pageSize} total={result.total} query={{ ...orderFilters.values, view }} /></> : <p className="admin-data-error">Orders could not be loaded. No data has been changed.</p>}
      </ContentSection>
    </>}
  </>;
}
