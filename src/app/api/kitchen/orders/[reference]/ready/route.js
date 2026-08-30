import { NextResponse } from "next/server";

import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import { PickupWorkflowError } from "@/lib/pickup/domain";
import { markOrderReadyForPickup } from "@/lib/pickup/service";
import { prisma } from "@/lib/prisma";

export async function POST(_request, { params }) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!user) return NextResponse.json({ ok: false, message: "Authentication is required." }, { status: 401 });
  if (role !== "ADMIN" && role !== "CHEF") {
    return NextResponse.json({ ok: false, message: "Kitchen access is required." }, { status: 403 });
  }
  try {
    const { reference } = await params;
    const result = await markOrderReadyForPickup({
      prismaClient: prisma,
      actorId: user.id,
      reference: String(reference || "").trim().toUpperCase(),
    });
    return NextResponse.json({ ok: true, order: result });
  } catch (error) {
    if (error instanceof PickupWorkflowError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    }
    console.error("[kitchen-mark-ready]", { category: error?.code || error?.name || "mutation_failed" });
    return NextResponse.json({ ok: false, message: "The order could not be marked ready." }, { status: 500 });
  }
}
