import { NextResponse } from "next/server";

import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import { PickupWorkflowError } from "@/lib/pickup/domain";
import {
  assertPickupAttemptAllowed,
  clearPickupFailures,
  recordPickupFailure,
} from "@/lib/pickup/rate-limit";
import { completePickup, recordCashReceived, verifyPickupCode } from "@/lib/pickup/service";
import { prisma } from "@/lib/prisma";

const OPERATIONS = {
  VERIFY: verifyPickupCode,
  RECORD_CASH: recordCashReceived,
  COMPLETE: completePickup,
};

export async function POST(request) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  if (!user) return NextResponse.json({ ok: false, message: "Authentication is required." }, { status: 401 });
  if (role !== "ADMIN" && role !== "CHEF") {
    return NextResponse.json({ ok: false, message: "Kitchen access is required." }, { status: 403 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "The pickup request could not be read." }, { status: 400 });
  }
  const operation = OPERATIONS[payload?.action];
  if (!operation) return NextResponse.json({ ok: false, message: "The pickup action is not supported." }, { status: 400 });

  try {
    assertPickupAttemptAllowed(user.id);
    const order = await operation({ prismaClient: prisma, actorId: user.id, code: payload.code });
    clearPickupFailures(user.id);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    if (error?.code === "INVALID_PICKUP_CODE") recordPickupFailure(user.id);
    if (error instanceof PickupWorkflowError || error?.status === 429) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    }
    console.error("[pickup-operation]", { category: error?.code || error?.name || "operation_failed" });
    return NextResponse.json({ ok: false, message: "The pickup request could not be completed." }, { status: 500 });
  }
}
