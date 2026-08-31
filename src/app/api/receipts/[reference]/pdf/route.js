import { NextResponse } from "next/server";

import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import { buildReceiptPdf } from "@/lib/payments/receipt-pdf";
import { getAuthorizedReceipt } from "@/lib/payments/receipts";
import { RECEIPT_COPY } from "@/lib/payments/receipt-presentation";
import { prisma } from "@/lib/prisma";

export async function GET(_request, { params }) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { reference } = await params;
  const receipt = await getAuthorizedReceipt({ prismaClient: prisma, reference, userId: user.id, role });
  if (!receipt) return NextResponse.json({ ok: false }, { status: 404 });
  const copyType = role === "ADMIN" ? RECEIPT_COPY.ORIGINAL : RECEIPT_COPY.CUSTOMER;
  const pdf = buildReceiptPdf(receipt, { copyType });
  const filenameSuffix = copyType === RECEIPT_COPY.ORIGINAL ? "-original" : "";
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${receipt.receiptNumber}${filenameSuffix}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
