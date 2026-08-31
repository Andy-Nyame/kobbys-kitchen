import {
  RECEIPT_COPY,
  createReceiptPresentation,
} from "@/lib/payments/receipt-presentation";

export default function ReceiptDocument({ receipt, copyType = RECEIPT_COPY.CUSTOMER }) {
  const model = createReceiptPresentation(receipt, copyType);
  return (
    <article className="receipt-document" aria-labelledby="receipt-title">
      <header className="receipt-document__header">
        <p>Kobby&rsquo;s Kitchen</p>
        <h1 id="receipt-title">Payment Receipt</h1>
      </header>
      <dl className="receipt-document__facts">
        <div><dt>Receipt Number</dt><dd>{model.receiptNumber}</dd></div>
        <div><dt>Order Reference</dt><dd>{model.orderReference}</dd></div>
        <div><dt>Payment Date</dt><dd>{model.paymentDate}</dd></div>
        <div><dt>Payment Time</dt><dd>{model.paymentTime}</dd></div>
        <div><dt>Pickup Name</dt><dd>{model.pickupName}</dd></div>
        <div><dt>Payment Method</dt><dd>{model.paymentMethod}</dd></div>
        <div><dt>Payment Status</dt><dd>{model.paymentStatus}</dd></div>
        <div><dt>Fulfillment</dt><dd>{model.fulfillment}</dd></div>
        {model.paymentProvider ? <div><dt>Payment Provider</dt><dd>{model.paymentProvider}</dd></div> : null}
        {model.providerReference ? <div><dt>Provider Reference</dt><dd>{model.providerReference}</dd></div> : null}
        {model.refundStatus ? <div><dt>Refund Status</dt><dd>{model.refundStatus}</dd></div> : null}
      </dl>
      <section aria-labelledby="receipt-items-title">
        <h2 id="receipt-items-title">Items</h2>
        <ul className="receipt-document__items">
          {model.items.map((item, index) => (
            <li key={`${item.name}:${item.priceTier}:${index}`}>
              <span>
                <strong>{item.quantity} × {item.name}</strong>
                <small>Unit price · {item.unitPrice} each</small>
              </span>
              <span>{item.lineTotal}</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="receipt-document__total"><span>Total</span><strong>{model.total}</strong></p>
      <footer className="receipt-document__footer">
        <strong>Approved</strong>
        {model.copyLabel === "CUSTOMER COPY" ? <span>Thank you</span> : null}
        <span>{model.copyLabel}</span>
      </footer>
    </article>
  );
}
