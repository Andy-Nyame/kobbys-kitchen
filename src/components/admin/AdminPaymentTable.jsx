import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import {
  formatAdminDateTime,
  formatMoneyMinor,
  formatStatusLabel,
} from "@/lib/admin/presentation";

export default function AdminPaymentTable({ payments }) {
  if (payments.length === 0) {
    return (
      <p className="admin-empty-state">
        No payments yet. Payment records will appear after trusted order creation.
      </p>
    );
  }

  return (
    <div className="admin-table-shell" tabIndex="0" role="region" aria-label="Payments table">
      <table className="admin-table admin-table--payments">
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">Method</th>
            <th scope="col">Status</th>
            <th scope="col">Amount</th>
            <th scope="col">Provider reference</th>
            <th scope="col">Paid</th>
            <th scope="col">Created</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={`${payment.order?.reference}-${payment.created_at}`}>
              <td data-label="Order">
                <strong>#{payment.order?.reference || "Unavailable"}</strong>
                <span className="admin-table__secondary">
                  {payment.order?.customer_name_snapshot || "Customer unavailable"}
                </span>
              </td>
              <td data-label="Method">{formatStatusLabel(payment.method)}</td>
              <td data-label="Status">
                <AdminStatusBadge status={payment.status} type="payment" />
              </td>
              <td data-label="Amount">
                {formatMoneyMinor(payment.amount_minor, payment.currency)}
              </td>
              <td data-label="Provider reference">
                <span>{payment.provider || "Not applicable"}</span>
                <span className="admin-table__secondary">
                  {payment.provider_reference || "No reference"}
                </span>
              </td>
              <td data-label="Paid">{formatAdminDateTime(payment.paid_at)}</td>
              <td data-label="Created">{formatAdminDateTime(payment.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
