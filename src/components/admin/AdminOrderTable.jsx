import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import {
  formatAdminDateTime,
  formatMoneyMinor,
  formatStatusLabel,
} from "@/lib/admin/presentation";

export default function AdminOrderTable({ orders, emptyMessage = "No orders yet." }) {
  if (orders.length === 0) {
    return <p className="admin-empty-state">{emptyMessage}</p>;
  }

  return (
    <div className="admin-table-shell" tabIndex="0" role="region" aria-label="Orders table">
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">Customer</th>
            <th scope="col">Items</th>
            <th scope="col">Total</th>
            <th scope="col">Payment</th>
            <th scope="col">Order status</th>
            <th scope="col">Created</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.reference}>
              <td data-label="Order">
                <strong>#{order.reference}</strong>
              </td>
              <td data-label="Customer">
                <strong>{order.customer_name_snapshot}</strong>
                <span className="admin-table__secondary">{order.phone_snapshot}</span>
              </td>
              <td data-label="Items">
                <ul className="admin-order-items">
                  {order.items.map((item, index) => (
                    <li key={`${item.nameSnapshot}:${item.priceTier}:${index}`}>
                      <span>{item.quantity} × {item.nameSnapshot}</span>
                      <small>{formatMoneyMinor(item.unitPriceMinor, order.currency)} each</small>
                    </li>
                  ))}
                </ul>
              </td>
              <td data-label="Total">
                {formatMoneyMinor(order.total_minor, order.currency)}
              </td>
              <td data-label="Payment">
                <span>{formatStatusLabel(order.payment?.method)}</span>
                <AdminStatusBadge status={order.payment?.status} type="payment" />
              </td>
              <td data-label="Order status">
                <AdminStatusBadge status={order.status} />
              </td>
              <td data-label="Created">{formatAdminDateTime(order.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
