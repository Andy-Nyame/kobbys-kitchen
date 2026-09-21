import { NextResponse } from "next/server";

import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import {
  CheckoutDomainError,
  deriveTrustedOrderLines,
  validateCheckoutLines,
} from "@/lib/orders/checkout-domain";
import { prisma } from "@/lib/prisma";
import { PromoDomainError } from "@/lib/promos/domain";
import { previewPromo } from "@/lib/promos/service";

export async function POST(request) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!user || role !== "CUSTOMER") {
    return NextResponse.json(
      {
        ok: false,
        code: "PROMO_CUSTOMER_REQUIRED",
        message: "Sign in with a customer account to use a promo code.",
      },
      { status: user ? 403 : 401 }
    );
  }

  try {
    const payload = await request.json();
    const lines = validateCheckoutLines(payload?.lines);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: [...new Set(lines.map((line) => line.menuItemId))] } },
      select: {
        id: true,
        name: true,
        priceMinor: true,
        priceStepMinor: true,
        currency: true,
        available: true,
        active: true,
        category: { select: { active: true } },
      },
    });
    const cart = deriveTrustedOrderLines(
      lines.map(({ expectedUnitPriceMinor: _ignored, ...line }) => line),
      menuItems
    );
    const promo = await previewPromo({
      prismaClient: prisma,
      userId: user.id,
      code: payload?.code,
      subtotalMinor: cart.subtotalMinor,
    });
    return NextResponse.json({ ok: true, promo });
  } catch (error) {
    if (error instanceof PromoDomainError || error instanceof CheckoutDomainError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.status || 400 }
      );
    }
    console.error("[promo-preview]", {
      category: error?.code || error?.name || "preview_failed",
    });
    return NextResponse.json(
      {
        ok: false,
        code: "PROMO_PREVIEW_FAILED",
        message: "This promo could not be checked right now. Try again.",
      },
      { status: 500 }
    );
  }
}
