import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/guards";
import { normalizeNotificationMutation } from "@/lib/notifications/domain";
import { getNotificationSnapshot } from "@/lib/notifications/queries";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function unauthorized() {
  return NextResponse.json(
    { ok: false, message: "Authentication is required." },
    { status: 401, headers: NO_STORE_HEADERS }
  );
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  try {
    const snapshot = await getNotificationSnapshot(user.id);
    return NextResponse.json(
      { ok: true, ...snapshot },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[notification-read]", {
      reason: error?.code || "query_failed",
    });
    return NextResponse.json(
      { ok: false, message: "Notifications are temporarily unavailable." },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  let mutation;
  try {
    mutation = normalizeNotificationMutation(await request.json());
  } catch {
    return NextResponse.json(
      { ok: false, message: "The notification action is invalid." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  try {
    if (mutation.action === "MARK_ALL_READ") {
      await markAllNotificationsRead(prisma, user.id);
    } else {
      await markNotificationRead(
        prisma,
        user.id,
        mutation.notificationId
      );
    }

    const snapshot = await getNotificationSnapshot(user.id);
    return NextResponse.json(
      { ok: true, ...snapshot },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[notification-update]", {
      reason: error?.code || "update_failed",
    });
    return NextResponse.json(
      { ok: false, message: "The notification could not be updated." },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
}
