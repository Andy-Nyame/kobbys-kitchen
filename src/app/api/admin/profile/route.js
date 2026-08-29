import { NextResponse } from "next/server";

import { prepareAdminProfileUpdate } from "@/lib/admin/profile";
import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export async function PATCH(request) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  let payload;

  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const preparation = prepareAdminProfileUpdate({ user, role, payload });

  if (!preparation.ok) {
    const { status, ...body } = preparation;
    return NextResponse.json(body, { status });
  }

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const trustedAdmin = await transaction.user.findUnique({
        where: { id: preparation.targetUserId },
        select: { role: true },
      });

      if (trustedAdmin?.role !== "ADMIN") {
        return null;
      }

      await transaction.user.update({
        where: { id: preparation.targetUserId },
        data: { name: preparation.values.displayName },
      });

      return transaction.profile.upsert({
        where: { userId: preparation.targetUserId },
        create: { userId: preparation.targetUserId, ...preparation.values },
        update: preparation.values,
        select: { displayName: true, phone: true },
      });
    });

    if (!updated) {
      return NextResponse.json({ ok: false, message: "Access denied.", errors: {} }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      message: "Profile updated successfully.",
      profile: { display_name: updated.displayName, phone: updated.phone || "" },
    });
  } catch (error) {
    console.error("[admin-profile-update]", { reason: error?.code || "update_failed" });
    return NextResponse.json({ ok: false, message: "Something went wrong.", errors: {} }, { status: 500 });
  }
}
