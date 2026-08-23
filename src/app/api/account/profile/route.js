import { NextResponse } from "next/server";

import { requireCustomer } from "@/lib/auth/guards";
import { validateProfileUpdatePayload } from "@/lib/validation/auth";

export async function PATCH(request) {
  const { user } = await requireCustomer();

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
      { ok: false, message: "Please check the highlighted information.", errors: validation.errors },
      { status: 400 }
    );
  }

  const { displayName, phone } = validation.data;

  const supabase = await (await import("@/lib/supabase/server")).createClient();

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
      { ok: false, message: "Something went wrong.", errors: { profile: error.message } },
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
