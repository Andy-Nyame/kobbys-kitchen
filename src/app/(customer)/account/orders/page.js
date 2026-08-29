import Link from "next/link";

import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { requireCustomer } from "@/lib/auth/guards";
import { listCustomerOrders } from "@/lib/orders/customer-orders";
import {
  formatOrderDateTime,
  formatOrderLabel,
  formatOrderMoney,
} from "@/lib/orders/presentation";

export const metadata = {
  title: "My Orders | Kobby's Kitchen",
  description: "View your Kobby's Kitchen order history.",
};

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await requireCustomer("/account/orders");
  let orderList = null;

  try {
    orderList = await listCustomerOrders(user.id);
  } catch (error) {
    console.error("[account-orders]", { reason: error?.code || "query_failed" });
  }

  return (
    <>
      <PageIntro
        eyebrow="Account"
        title="My Orders"
        description="Track active pickup orders and review your order history."
      />

      <ContentSection
        title="Order History"
        description={
          orderList === null
            ? "Order history is temporarily unavailable."
            : orderList.length === 0
              ? "You have no orders yet."
              : `You have ${orderList.length} order${orderList.length === 1 ? "" : "s"}.`
        }
      >
        {orderList === null ? (
          <p className="admin-data-error" role="alert">
            Your orders could not be loaded. Please try again shortly.
          </p>
        ) : orderList.length === 0 ? (
          <div className="order-empty-state">
            <p>Your first pickup order will appear here after checkout.</p>
            <Link className="button-link button-link--primary" href="/menu">
              Browse Menu
            </Link>
          </div>
        ) : (
          <ul className="order-list">
            {orderList.map((order) => (
              <li key={order.reference} className="order-list__item">
                <div className="order-list__header">
                  <div>
                    <strong>#{order.reference}</strong>
                    <p className="order-list__date">
                      {formatOrderDateTime(order.placedAt)}
                    </p>
                  </div>
                  <span className={`order-status order-status--${order.status.toLowerCase()}`}>
                    {formatOrderLabel(order.status)}
                  </span>
                </div>
                <dl className="order-list__summary">
                  <div><dt>Total</dt><dd>{formatOrderMoney(order.totalMinor, order.currency)}</dd></div>
                  <div><dt>Payment</dt><dd>{formatOrderLabel(order.paymentMethod)} · {formatOrderLabel(order.paymentStatus)}</dd></div>
                  <div><dt>Fulfillment</dt><dd>{formatOrderLabel(order.fulfillmentType)}</dd></div>
                </dl>
                <Link className="text-link" href={`/account/orders/${order.reference}`}>
                  View Order
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ContentSection>
    </>
  );
}
