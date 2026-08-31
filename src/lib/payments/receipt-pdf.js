function escapePdfText(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function money(minor, currency = "GHS") {
  return `${currency} ${(Number(minor) / 100).toFixed(2)}`;
}

export function buildReceiptPdf(receipt, formatDateTime) {
  const order = receipt.payment.order;
  const rows = [
    ["Kobby's Kitchen", 18, true],
    ["Payment Receipt", 13, true],
    [`Receipt Number: ${receipt.receiptNumber}`, 10],
    [`Order Reference: ${order.reference}`, 10],
    [`Payment Date: ${formatDateTime(receipt.issuedAt)}`, 10],
    [`Pickup Name: ${order.customerNameSnapshot}`, 10],
    [`Payment Method: ${receipt.payment.method.replaceAll("_", " ")}`, 10],
    ["Payment Status: PAID", 10],
    ["Fulfillment: Pickup", 10],
    ["", 8],
    ["Items", 12, true],
    ...order.items.flatMap((item) => [
      [
        `${item.quantity} x ${item.nameSnapshot}  ${money(item.lineTotalMinor, order.currency)}`,
        10,
      ],
      [
        `${String(item.priceTier).replaceAll("_", " ")} at ${money(item.unitPriceMinor, order.currency)} each`,
        8,
      ],
    ]),
    ["", 8],
    [`TOTAL: ${money(order.totalMinor, order.currency)}`, 13, true],
    ...(receipt.payment.providerRef
      ? [[`Provider Reference: ${receipt.payment.providerRef}`, 9]]
      : []),
    ...(receipt.payment.refund
      ? [[`Refund Status: ${receipt.payment.refund.status.replaceAll("_", " ")}`, 9]]
      : []),
  ];
  let y = 760;
  const content = rows
    .map(([text, size, bold]) => {
      const line = `BT /${bold ? "F2" : "F1"} ${size} Tf 54 ${y} Td (${escapePdfText(text)}) Tj ET`;
      y -= text ? Math.max(size + 7, 18) : 10;
      return line;
    })
    .join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  output += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, "binary");
}
