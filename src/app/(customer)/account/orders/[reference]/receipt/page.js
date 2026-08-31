import Link from "next/link";
import { notFound } from "next/navigation";

import ReceiptDocument from "@/components/payments/ReceiptDocument";
import { requireCustomer } from "@/lib/auth/guards";
import { getAuthorizedReceipt } from "@/lib/payments/receipts";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Payment Receipt | Kobby's Kitchen" };
export const dynamic = "force-dynamic";

export default async function CustomerReceiptPage({ params }) {
  const { reference } = await params;
  const user = await requireCustomer(`/account/orders/${encodeURIComponent(reference)}/receipt`);
  const receipt = await getAuthorizedReceipt({ prismaClient: prisma, reference, userId: user.id, role: "CUSTOMER" });
  if (!receipt) notFound();
  return (
    <div className="receipt-page">
      <ReceiptDocument receipt={receipt} />
      <div className="section-actions receipt-page__actions">
        <Link className="button-link button-link--secondary" href={`/account/orders/${encodeURIComponent(reference)}`}>Back to Order</Link>
        <a className="button-link button-link--primary" href={`/api/receipts/${encodeURIComponent(reference)}/pdf`}>Download PDF</a>
      </div>
    </div>
  );
}
