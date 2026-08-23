import { NextResponse } from "next/server";

import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { validateProfileUpdatePayload } from "@/lib/validation/auth";

export async function PATCH(request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Authentication required.", errors: {} },
      { status: 401 }
    );
  }

  if ((await getUserRole(user.id)) !== "CUSTOMER") {
    return NextResponse.json(
      { ok: false, message: "Access denied.", errors: {} },
      { status: 403 }
    );
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

  const validation = validateProfileUpdatePayload(payload);

  if (Object.keys(validation.errors).length > 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "Please check the highlighted information.",
        errors: validation.errors,
      },
      { status: 400 }
    );
  }

  const { displayName, phone } = validation.data;

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      phone: phone,
    })
    .eq("user_id", user.id);

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
      profile: {
        display_name: displayName,
        phone: phone,
      },
    },
    { status: 200 }
  );
}
