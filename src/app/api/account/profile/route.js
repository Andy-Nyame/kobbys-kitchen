import { NextResponse } from "next/server";

import {
  getCustomerProfileUpdateAuthorization,
  prepareCustomerProfileUpdate,
} from "@/lib/account/profile-update";
import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();

  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update(preparation.values)
    .eq("user_id", preparation.targetUserId)
    .select("display_name, phone")
    .single();

  if (error) {
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
      profile: updatedProfile,
    },
    { status: 200 }
  );
}
