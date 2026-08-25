import Link from "next/link";

import AdminOrderTable from "@/components/admin/AdminOrderTable";
import AdminPagination from "@/components/admin/AdminPagination";
import AdminQueryNotice from "@/components/admin/AdminQueryNotice";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { parseOrderFilters } from "@/lib/admin/filters";
import { listAdminOrders } from "@/lib/admin/orders";
import { formatStatusLabel } from "@/lib/admin/presentation";
import { requireAdmin } from "@/lib/auth/guards";
import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
} from "@/lib/orders/domain";

export const metadata = {
  title: "Admin Orders | Kobby's Kitchen",
  description: "Read-only Kobby's Kitchen order operations.",
};

export default async function AdminOrdersPage({ searchParams }) {
  await requireAdmin("/admin/orders");

  const params = await searchParams;
  const { values: filters, errors } = parseOrderFilters(params);
  let result = null;

  try {
    result = await listAdminOrders(filters);
  } catch (error) {
    console.error("[admin-orders]", error);
  }

  return (
    <>
      <PageIntro
        eyebrow="Admin operations"
        title="Orders"
        description="Search and filter the read-only order queue. Newest orders appear first."
      />

      <ContentSection
        title="Order Filters"
        description="Filter by operational, payment and creation details."
        className="admin-section"
      >
        <AdminQueryNotice errors={errors} />
        <form className="admin-filter-form" action="/admin/orders" method="GET">
          <label className="form-field admin-filter-form__search">
            <span>Reference, customer or phone</span>
            <input name="search" type="search" defaultValue={filters.search} maxLength="80" />
          </label>
          <label className="form-field">
            <span>Order status</span>
            <select name="orderStatus" defaultValue={filters.orderStatus}>
              <option value="">All statuses</option>
              {Object.values(ORDER_STATUS).map((status) => (
                <option key={status} value={status}>{formatStatusLabel(status)}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Payment method</span>
            <select name="paymentMethod" defaultValue={filters.paymentMethod}>
              <option value="">All methods</option>
              {Object.values(PAYMENT_METHOD).map((method) => (
                <option key={method} value={method}>{formatStatusLabel(method)}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Payment status</span>
            <select name="paymentStatus" defaultValue={filters.paymentStatus}>
              <option value="">All payment states</option>
              {Object.values(PAYMENT_STATUS).map((status) => (
                <option key={status} value={status}>{formatStatusLabel(status)}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>From</span>
            <input name="from" type="date" defaultValue={filters.from} />
          </label>
          <label className="form-field">
            <span>To</span>
            <input name="to" type="date" defaultValue={filters.to} />
          </label>
          <div className="admin-filter-form__actions">
            <button className="button-link button-link--primary" type="submit">Apply filters</button>
            <Link className="button-link button-link--secondary" href="/admin/orders">Clear</Link>
          </div>
        </form>
      </ContentSection>

      <ContentSection title="Order Queue" description={result ? `${result.total} matching order${result.total === 1 ? "" : "s"}.` : "Order data is currently unavailable."} className="admin-section">
        {result ? (
          <>
            <AdminOrderTable orders={result.rows} emptyMessage="No orders match these filters." />
            <AdminPagination basePath="/admin/orders" page={result.page} pageSize={result.pageSize} total={result.total} query={filters} />
          </>
        ) : (
          <p className="admin-data-error">Orders could not be loaded. No data has been changed.</p>
        )}
      </ContentSection>
    </>
  );
}
