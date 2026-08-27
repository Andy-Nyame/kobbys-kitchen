import { NextResponse } from "next/server";

import {
  getCustomerProfileUpdateAuthorization,
  prepareCustomerProfileUpdate,
} from "@/lib/account/profile-update";
import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export async function PATCH(request) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  const authorization = getCustomerProfileUpdateAuthorization(user, role);

  if (!authorization.ok) {
    const { status, ...responseBody } = authorization;
    return NextResponse.json(responseBody, { status });
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "The request could not be read.", errors: {} },
      { status: 400 }
    );
  }

  const preparation = prepareCustomerProfileUpdate({ user, role, payload });

  if (!preparation.ok) {
    const { status, ...responseBody } = preparation;
    return NextResponse.json(responseBody, { status });
  }

  let updatedProfile;

  try {
    updatedProfile = await prisma.profile.update({
      where: { userId: preparation.targetUserId },
      data: preparation.values,
      select: { displayName: true, phone: true },
    });
  } catch (error) {
    console.error("[account-profile-update]", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong.", errors: {} },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Profile updated successfully.",
      profile: {
        display_name: updatedProfile.displayName,
        phone: updatedProfile.phone,
      },
    },
    { status: 200 }
  );
}
