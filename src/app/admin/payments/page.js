import Link from "next/link";

import AdminPagination from "@/components/admin/AdminPagination";
import AdminPaymentTable from "@/components/admin/AdminPaymentTable";
import AdminQueryNotice from "@/components/admin/AdminQueryNotice";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { parsePaymentFilters } from "@/lib/admin/filters";
import { listAdminPayments } from "@/lib/admin/payments";
import { formatStatusLabel } from "@/lib/admin/presentation";
import { requireAdmin } from "@/lib/auth/guards";
import { PAYMENT_METHOD, PAYMENT_STATUS } from "@/lib/orders/domain";

export const metadata = {
  title: "Admin Payments | Kobby's Kitchen",
  description: "Kobby's Kitchen payment and receipt operations.",
};

export default async function AdminPaymentsPage({ searchParams }) {
  await requireAdmin("/admin/payments");

  const params = await searchParams;
  const { values: filters, errors } = parsePaymentFilters(params);
  let result = null;

  try {
    result = await listAdminPayments(filters);
  } catch (error) {
    console.error("[admin-payments]", error);
  }

  return (
    <>
      <PageIntro
        eyebrow="Admin operations"
        title="Payments"
        description="Review trusted payments, provider references, receipts and refund states without exposing provider secrets."
      />

      <ContentSection title="Payment Filters" description="Filter by order reference, method, state or creation date." className="admin-section">
        <AdminQueryNotice errors={errors} />
        <form className="admin-filter-form" action="/admin/payments" method="GET">
          <label className="form-field admin-filter-form__search">
            <span>Order reference</span>
            <input name="search" type="search" defaultValue={filters.search} maxLength="80" />
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
            <Link className="button-link button-link--secondary" href="/admin/payments">Clear</Link>
          </div>
        </form>
      </ContentSection>

      <ContentSection title="Payment Records" description={result ? `${result.total} matching payment${result.total === 1 ? "" : "s"}.` : "Payment data is currently unavailable."} className="admin-section">
        {result ? (
          <>
            <AdminPaymentTable payments={result.rows} />
            <AdminPagination basePath="/admin/payments" page={result.page} pageSize={result.pageSize} total={result.total} query={filters} />
          </>
        ) : (
          <p className="admin-data-error">Payments could not be loaded. No data has been changed.</p>
        )}
      </ContentSection>
    </>
  );
}
