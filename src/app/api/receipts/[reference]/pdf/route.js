import { NextResponse } from "next/server";

import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import { buildReceiptPdf } from "@/lib/payments/receipt-pdf";
import { getAuthorizedReceipt } from "@/lib/payments/receipts";
import { prisma } from "@/lib/prisma";
import { formatOrderDateTime } from "@/lib/orders/presentation";

export async function GET(_request, { params }) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { reference } = await params;
  const receipt = await getAuthorizedReceipt({ prismaClient: prisma, reference, userId: user.id, role });
  if (!receipt) return NextResponse.json({ ok: false }, { status: 404 });
  const pdf = buildReceiptPdf(receipt, formatOrderDateTime);
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${receipt.receiptNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
