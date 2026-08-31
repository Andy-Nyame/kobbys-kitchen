import KitchenReadyButton from "@/components/kitchen/KitchenReadyButton";
import KitchenStartPreparingButton from "@/components/kitchen/KitchenStartPreparingButton";
import { formatOrderDateTime, formatOrderLabel, formatOrderMoney } from "@/lib/orders/presentation";

export default function KitchenOrderCard({ order, actionable = true }) {
  return (
    <article className="kitchen-order-card">
      <header className="kitchen-order-card__header">
        <div><p className="order-option-card__eyebrow">Order #{order.reference}</p><h2>{order.pickupName}</h2></div>
        <span className="kitchen-order-card__status">{formatOrderLabel(order.status)}</span>
      </header>
      <p className="kitchen-order-card__accepted">Accepted {formatOrderDateTime(order.acceptedAt)}</p>
      <ul className="kitchen-order-card__items">{order.items.map((item, index) => <li key={`${item.nameSnapshot}:${item.priceTier}:${index}`}><strong>{item.quantity} ×</strong><span>{item.nameSnapshot}</span>{item.priceTier ? <small>{formatOrderLabel(item.priceTier)}</small> : null}</li>)}</ul>
      {order.note ? <p className="kitchen-order-card__note"><strong>Customer note:</strong> {order.note}</p> : null}
      <dl className="kitchen-order-card__facts"><div><dt>Payment</dt><dd>{formatOrderLabel(order.payment?.method)} · {formatOrderLabel(order.payment?.status)}</dd></div><div><dt>Total</dt><dd>{formatOrderMoney(order.totalMinor, order.currency)}</dd></div></dl>
      {actionable && order.status === "CONFIRMED" ? (
        <KitchenStartPreparingButton reference={order.reference} />
      ) : null}
      {actionable && order.status === "PREPARING" ? (
        <KitchenReadyButton reference={order.reference} />
      ) : null}
    </article>
  );
}
