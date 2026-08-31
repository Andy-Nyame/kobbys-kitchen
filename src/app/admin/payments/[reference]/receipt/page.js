import Link from "next/link";
import { notFound } from "next/navigation";

import ReceiptDocument from "@/components/payments/ReceiptDocument";
import { requireAdmin } from "@/lib/auth/guards";
import { getAuthorizedReceipt } from "@/lib/payments/receipts";
import { RECEIPT_COPY } from "@/lib/payments/receipt-presentation";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Admin Payment Receipt | Kobby's Kitchen" };
export const dynamic = "force-dynamic";

export default async function AdminReceiptPage({ params }) {
  const { reference } = await params;
  const admin = await requireAdmin(`/admin/payments/${encodeURIComponent(reference)}/receipt`);
  const receipt = await getAuthorizedReceipt({ prismaClient: prisma, reference, userId: admin.id, role: "ADMIN" });
  if (!receipt) notFound();
  return (
    <div className="receipt-page">
      <ReceiptDocument receipt={receipt} copyType={RECEIPT_COPY.ORIGINAL} />
      <div className="section-actions receipt-page__actions">
        <Link className="button-link button-link--secondary" href="/admin/payments">Back to Payments</Link>
        <a className="button-link button-link--primary" href={`/api/receipts/${encodeURIComponent(reference)}/pdf`}>Download Original Receipt</a>
      </div>
    </div>
  );
}
