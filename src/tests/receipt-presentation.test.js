import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { buildReceiptPdf } from "../lib/payments/receipt-pdf.js";
import {
  RECEIPT_COPY,
  createReceiptPresentation,
} from "../lib/payments/receipt-presentation.js";

function receiptFixture({ refundStatus = null, itemCount = 2 } = {}) {
  const items = Array.from({ length: itemCount }, (_, index) => ({
    nameSnapshot: index === 0 ? "Jollof Rice with Grilled Chicken" : `Side Item ${index + 1}`,
    priceTier: index,
    unitPriceMinor: index === 0 ? 3500 : 2000,
    quantity: index === 0 ? 1 : 2,
    lineTotalMinor: index === 0 ? 3500 : 4000,
  }));
  return {
    receiptNumber: "KKR-20260831-ABC123",
    issuedAt: new Date("2026-08-31T19:45:00.000Z"),
    payment: {
      method: "MOBILE_MONEY",
      status: refundStatus === "PROCESSED" ? "REFUNDED" : "PAID",
      provider: "PAYSTACK",
      providerRef: "KKP-safe-reference-1",
      refund: refundStatus ? { status: refundStatus } : null,
      order: {
        reference: "KK-20260831-ORDER1",
        customerNameSnapshot: "Ama Mensah",
        fulfillmentType: "PICKUP",
        totalMinor: items.reduce((total, item) => total + item.lineTotalMinor, 0),
        currency: "GHS",
        items,
      },
    },
  };
}

describe("thermal receipt presentation", () => {
  it("renders customer and original copies from the same trusted receipt snapshot", () => {
    const receipt = receiptFixture();
    const customer = createReceiptPresentation(receipt, RECEIPT_COPY.CUSTOMER);
    const original = createReceiptPresentation(receipt, RECEIPT_COPY.ORIGINAL);

    assert.equal(customer.copyLabel, "CUSTOMER COPY");
    assert.equal(original.copyLabel, "ORIGINAL COPY");
    assert.equal(customer.receiptNumber, original.receiptNumber);
    assert.equal(customer.orderReference, original.orderReference);
    assert.deepEqual(customer.items, original.items);
    assert.equal(customer.total, "GH₵75.00");
    assert.equal(original.total, "GH₵75.00");
    assert.equal(customer.items[0].name, "Jollof Rice with Grilled Chicken");
    assert.equal(customer.items[0].priceTier, 0);
  });

  it("builds a narrow thermal-style customer PDF with truthful fields only", () => {
    const pdf = buildReceiptPdf(receiptFixture(), { copyType: RECEIPT_COPY.CUSTOMER });
    const contents = pdf.toString("binary");

    assert.equal(pdf.subarray(0, 8).toString(), "%PDF-1.4");
    assert.match(contents, /\/MediaBox \[0 0 226\.77 396\]/);
    assert.match(contents, /KOBBY'S KITCHEN/);
    assert.match(contents, /PAYMENT RECEIPT/);
    assert.match(contents, /QTY/);
    assert.match(contents, /Jollof Rice with/);
    assert.match(contents, /TOTAL/);
    assert.match(contents, /75\.00/);
    assert.match(contents, /APPROVED/);
    assert.match(contents, /THANK YOU/);
    assert.match(contents, /CUSTOMER COPY/);
    assert.doesNotMatch(contents, /SUBTOTAL|TAX|TIP|VAT INVOICE|TAX INVOICE/);
  });

  it("renders the Admin variant as ORIGINAL COPY without changing receipt identity", () => {
    const pdf = buildReceiptPdf(receiptFixture(), { copyType: RECEIPT_COPY.ORIGINAL });
    const contents = pdf.toString("binary");

    assert.match(contents, /KKR-20260831-ABC123/);
    assert.match(contents, /KK-20260831-ORDER1/);
    assert.match(contents, /ORIGINAL COPY/);
    assert.doesNotMatch(contents, /CUSTOMER COPY/);
  });

  it("keeps a refunded original receipt available with a truthful refund label", () => {
    const processed = createReceiptPresentation(receiptFixture({ refundStatus: "PROCESSED" }));
    const processing = createReceiptPresentation(receiptFixture({ refundStatus: "PROCESSING" }));
    assert.equal(processed.refundStatus, "REFUNDED");
    assert.equal(processing.refundStatus, "PROCESSING");
    assert.match(buildReceiptPdf(receiptFixture({ refundStatus: "PROCESSED" })).toString(), /REFUND STATUS/);
    assert.match(buildReceiptPdf(receiptFixture({ refundStatus: "PROCESSED" })).toString(), /REFUNDED/);
  });

  it("paginates long receipts without changing item snapshots", () => {
    const receipt = receiptFixture({ itemCount: 40 });
    const pdf = buildReceiptPdf(receipt);
    const contents = pdf.toString("binary");
    const pageCount = Number(contents.match(/\/Type \/Pages .*\/Count (\d+)/)?.[1]);
    assert.ok(pageCount > 1);
    assert.match(contents, /Side Item 40/);
  });
});

describe("trusted receipt access wiring", () => {
  it("derives PDF copy mode from the trusted server role without a client copy parameter", async () => {
    const route = await readFile("src/app/api/receipts/[reference]/pdf/route.js", "utf8");
    assert.match(route, /role === "ADMIN" \? RECEIPT_COPY\.ORIGINAL : RECEIPT_COPY\.CUSTOMER/);
    assert.match(route, /getAuthorizedReceipt/);
    assert.doesNotMatch(route, /searchParams|get\("copy"\)|query\.copy/);
  });

  it("adds compact original-receipt access only to Admin History and preserves Payments access", async () => {
    const [ordersPage, orderTable, adminReceipt, customerReceipt] = await Promise.all([
      readFile("src/app/admin/orders/page.js", "utf8"),
      readFile("src/components/admin/AdminOrderTable.jsx", "utf8"),
      readFile("src/app/admin/payments/[reference]/receipt/page.js", "utf8"),
      readFile("src/app/(customer)/account/orders/[reference]/receipt/page.js", "utf8"),
    ]);

    assert.match(ordersPage, /showReceiptActions=\{view === "history"\}/);
    assert.match(orderTable, /View Receipt/);
    assert.match(orderTable, /Download Original Receipt/);
    assert.match(orderTable, /\["PAID", "REFUNDED"\]/);
    assert.match(adminReceipt, /RECEIPT_COPY\.ORIGINAL/);
    assert.match(adminReceipt, /Download Original Receipt/);
    assert.match(customerReceipt, /RECEIPT_COPY\.CUSTOMER/);
    assert.match(customerReceipt, /Download Receipt/);
  });

  it("retains the one-receipt-per-payment issuance contract", async () => {
    const [receiptService, schema] = await Promise.all([
      readFile("src/lib/payments/receipts.js", "utf8"),
      readFile("prisma/schema.prisma", "utf8"),
    ]);
    assert.match(receiptService, /if \(payment\.receipt\) return/);
    assert.match(schema, /paymentId\s+String\s+@unique/);
  });
});
