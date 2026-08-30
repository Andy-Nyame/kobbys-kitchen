import Link from "next/link";
import { notFound } from "next/navigation";

import PageIntro from "@/components/ui/PageIntro";
import OrderAgainButton from "@/components/orders/OrderAgainButton";
import OrderTracker from "@/components/orders/OrderTracker";
import PickupCodeCard from "@/components/orders/PickupCodeCard";
import { businessData } from "@/data/businessData";
import { requireCustomer } from "@/lib/auth/guards";
import { getCustomerOrderByReference } from "@/lib/orders/customer-orders";
import {
  formatOrderDateTime,
  formatOrderLabel,
  formatOrderMoney,
} from "@/lib/orders/presentation";
import { deriveMenuPriceMinor } from "@/lib/menu/pricing";

export const metadata = {
  title: "Order Details | Kobby's Kitchen",
  description: "Review a secure Kobby's Kitchen pickup order.",
};

export const dynamic = "force-dynamic";

export default async function CustomerOrderDetailPage({ params, searchParams }) {
  const { reference } = await params;
  const intendedPath = `/account/orders/${encodeURIComponent(reference)}`;
  const user = await requireCustomer(intendedPath);
  const order = await getCustomerOrderByReference(user.id, reference);
  const query = await searchParams;

  if (!order) {
    notFound();
  }
  const reorderLines = order.items
    .filter((item) => item.menuItem?.active && item.menuItem?.available && item.menuItem?.category?.active && deriveMenuPriceMinor(item.menuItem, item.priceTier) !== null)
    .map((item) => ({ menuItemId: item.menuItemId, priceTier: item.priceTier, quantity: item.quantity }));
  const unavailableReorderCount = order.items.length - reorderLines.length;

  return (
    <>
      {query?.placed === "1" ? (
        <div className="order-confirmation-banner" role="status">
          <strong>Order placed successfully.</strong>
          <span>We&rsquo;ve received your order and the restaurant will confirm it shortly.</span>
        </div>
      ) : null}
      <PageIntro
        eyebrow="Pickup order"
        title={`Order ${order.reference}`}
        description={`Placed ${formatOrderDateTime(order.placedAt)}. Keep this reference for pickup support.`}
      />

      <OrderTracker cancellationReason={order.cancellationReason} status={order.status} />

      {order.status === "READY_FOR_PICKUP" && order.pickupCode ? (
        <PickupCodeCard code={order.pickupCode} />
      ) : null}

      <div className="order-detail-grid">
        <section className="order-detail-card" aria-labelledby="order-items-title">
          <div className="checkout-card__heading">
            <p className="order-option-card__eyebrow">Order summary</p>
            <h2 id="order-items-title">Items</h2>
          </div>
          <ul className="order-detail-items">
            {order.items.map((item, index) => (
              <li key={`${item.nameSnapshot}:${item.priceTier}:${index}`}>
                <div>
                  <strong>{item.nameSnapshot}</strong>
                  <span>{formatOrderMoney(item.unitPriceMinor, order.currency)} × {item.quantity}</span>
                </div>
                <strong>{formatOrderMoney(item.lineTotalMinor, order.currency)}</strong>
              </li>
            ))}
          </ul>
          <dl className="order-detail-total">
            <div><dt>Subtotal</dt><dd>{formatOrderMoney(order.subtotalMinor, order.currency)}</dd></div>
            <div><dt>Total</dt><dd>{formatOrderMoney(order.totalMinor, order.currency)}</dd></div>
          </dl>
        </section>

        <aside className="order-detail-card" aria-labelledby="order-status-title">
          <div className="checkout-card__heading">
            <p className="order-option-card__eyebrow">Current state</p>
            <h2 id="order-status-title">Pickup details</h2>
          </div>
          <dl className="order-detail-facts">
            <div><dt>Order status</dt><dd>{formatOrderLabel(order.status)}</dd></div>
            <div><dt>Payment method</dt><dd>{formatOrderLabel(order.paymentMethod)}</dd></div>
            <div><dt>Payment status</dt><dd>{formatOrderLabel(order.paymentStatus)}</dd></div>
            <div><dt>Fulfillment</dt><dd>{formatOrderLabel(order.fulfillmentType)}</dd></div>
            <div><dt>Pickup name</dt><dd>{order.customerNameSnapshot}</dd></div>
            <div><dt>Phone</dt><dd>{order.customerPhoneSnapshot}</dd></div>
            <div><dt>Email</dt><dd>{order.customerEmailSnapshot}</dd></div>
            {order.note ? <div><dt>Order note</dt><dd>{order.note}</dd></div> : null}
            {order.cancellationReason ? <div><dt>Cancellation reason</dt><dd>{order.cancellationReason}</dd></div> : null}
          </dl>
          <div className="order-contact-actions">
            <a className="button-link button-link--secondary" href={businessData.phone.href}>Call Restaurant</a>
            <a className="button-link button-link--secondary" href={businessData.whatsapp.href} rel="noreferrer" target="_blank">WhatsApp</a>
          </div>
        </aside>
      </div>
      <div className="section-actions">
        <Link className="button-link button-link--secondary" href="/account/orders">All Orders</Link>
        {order.status === "COMPLETED" ? <OrderAgainButton lines={reorderLines} unavailableCount={unavailableReorderCount} /> : <Link className="button-link button-link--primary" href="/menu">Browse Menu</Link>}
      </div>
    </>
  );
}
