import ButtonLink from "@/components/ui/ButtonLink";
import {
  formatOrderDateTime,
  formatOrderLabel,
  formatOrderMoney,
} from "@/lib/orders/presentation";

function orderDetailPath(reference) {
  return `/account/orders/${encodeURIComponent(reference)}`;
}

export default function CustomerHomeOrders({ overview }) {
  const orders = overview?.orders || [];
  const totalCount = overview?.totalCount || 0;

  if (orders.length === 0) {
    return (
      <div className="customer-home-orders">
        <p className="hero__eyebrow">Welcome back</p>
        <h1>Ready to order?</h1>
        <p className="hero__description">
          {overview === null
            ? "Order updates are temporarily unavailable. You can still browse the menu or open My Orders."
            : "Order your favourites online for pickup."}
        </p>
        <div className="button-row">
          <ButtonLink href="/menu" variant="primary">
            Order Online
          </ButtonLink>
          <ButtonLink href="/account/orders" variant="secondary">
            My Orders
          </ButtonLink>
        </div>
      </div>
    );
  }

  const hasReadyOrder = orders.some(
    (order) => order.status === "READY_FOR_PICKUP"
  );

  return (
    <div className="customer-home-orders">
      <p className="hero__eyebrow">
        {hasReadyOrder ? "Pickup update" : "Your current order"}
      </p>
      <h1>
        {hasReadyOrder
          ? "Your order is ready for pickup"
          : totalCount === 1
            ? "Track your current order"
            : "Track your active orders"}
      </h1>
      <ul className="customer-home-orders__list">
        {orders.map((order, index) => {
          const isReady = order.status === "READY_FOR_PICKUP";
          const headingId = `customer-home-order-${index}`;

          return (
            <li key={order.reference}>
              <article
                aria-labelledby={headingId}
                className={`customer-home-order${isReady ? " customer-home-order--ready" : ""}`}
              >
                <div className="customer-home-order__summary">
                  <span
                    className={`order-status order-status--${order.status.toLowerCase()}`}
                  >
                    {formatOrderLabel(order.status)}
                  </span>
                  <h2 id={headingId}>Order {order.reference}</h2>
                  <p>Placed {formatOrderDateTime(order.placedAt)}</p>
                  <strong>{formatOrderMoney(order.totalMinor, order.currency)}</strong>
                </div>
                <ButtonLink
                  ariaLabel={`${isReady ? "View pickup code for" : "Track"} order ${order.reference}`}
                  className="customer-home-order__action"
                  href={orderDetailPath(order.reference)}
                  variant={isReady ? "primary" : "secondary"}
                >
                  {isReady ? "View Pickup Code" : "Track Order"}
                </ButtonLink>
              </article>
            </li>
          );
        })}
      </ul>
      <div className="button-row customer-home-orders__actions">
        <ButtonLink href="/menu" variant="primary">
          Order More
        </ButtonLink>
        {totalCount > 1 ? (
          <ButtonLink href="/account/orders" variant="secondary">
            View All Orders
          </ButtonLink>
        ) : null}
      </div>
    </div>
  );
}
