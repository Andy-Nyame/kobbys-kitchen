import { formatOrderDateTime, formatOrderLabel, formatOrderMoney } from "@/lib/orders/presentation";

export default function ReceiptDocument({ receipt }) {
  const payment = receipt.payment;
  const order = payment.order;
  return (
    <article className="receipt-document" aria-labelledby="receipt-title">
      <header className="receipt-document__header">
        <p>Kobby&rsquo;s Kitchen</p>
        <h1 id="receipt-title">Payment Receipt</h1>
      </header>
      <dl className="receipt-document__facts">
        <div><dt>Receipt Number</dt><dd>{receipt.receiptNumber}</dd></div>
        <div><dt>Order Reference</dt><dd>{order.reference}</dd></div>
        <div><dt>Payment Date</dt><dd>{formatOrderDateTime(receipt.issuedAt)}</dd></div>
        <div><dt>Pickup Name</dt><dd>{order.customerNameSnapshot}</dd></div>
        <div><dt>Payment Method</dt><dd>{formatOrderLabel(payment.method)}</dd></div>
        <div><dt>Payment Status</dt><dd>Paid</dd></div>
        <div><dt>Fulfillment</dt><dd>{formatOrderLabel(order.fulfillmentType)}</dd></div>
        {payment.providerRef ? <div><dt>Provider Reference</dt><dd>{payment.providerRef}</dd></div> : null}
        {payment.refund ? <div><dt>Refund Status</dt><dd>{formatOrderLabel(payment.refund.status)}</dd></div> : null}
      </dl>
      <section aria-labelledby="receipt-items-title">
        <h2 id="receipt-items-title">Items</h2>
        <ul className="receipt-document__items">
          {order.items.map((item, index) => (
            <li key={`${item.nameSnapshot}:${item.priceTier}:${index}`}>
              <span>
                <strong>{item.quantity} × {item.nameSnapshot}</strong>
                <small>{formatOrderLabel(item.priceTier)} · {formatOrderMoney(item.unitPriceMinor, order.currency)} each</small>
              </span>
              <span>{formatOrderMoney(item.lineTotalMinor, order.currency)}</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="receipt-document__total"><span>Total</span><strong>{formatOrderMoney(order.totalMinor, order.currency)}</strong></p>
    </article>
  );
}
