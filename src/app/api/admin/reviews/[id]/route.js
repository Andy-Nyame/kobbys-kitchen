import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { moderateAdminReview } from "@/lib/admin/reviews";
import { getAdminAuthorization } from "@/lib/auth/authorization";
import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";
import {
  getReviewModerationSuccessMessage,
  isReviewId,
  isReviewModerationAction,
} from "@/lib/reviews/moderation";

export async function PATCH(request, context) {
  const user = await getAuthenticatedUser();
  const role = user ? await getUserRole(user.id) : null;
  const authorization = getAdminAuthorization(user, role);

  if (!authorization.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: user ? "Admin access is required." : "Authentication is required.",
      },
      { status: user ? 403 : 401 }
    );
  }

  const { id } = await context.params;
  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "The moderation request could not be read." },
      { status: 400 }
    );
  }

  if (
    !isReviewId(id) ||
    !isReviewModerationAction(payload?.action)
  ) {
    return NextResponse.json(
      { ok: false, message: "The moderation request was invalid." },
      { status: 400 }
    );
  }

  try {
    const review = await moderateAdminReview({
      reviewId: id,
      action: payload.action,
      adminUserId: user.id,
    });

    revalidatePath("/");
    revalidatePath("/reviews");
    revalidatePath("/admin/reviews");

    return NextResponse.json(
      {
        ok: true,
        message: getReviewModerationSuccessMessage(payload.action),
        review,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin-review-moderation]", error);

    const reviewNotFound = error?.message === "The review could not be found.";

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof TypeError || reviewNotFound
          ? error.message
          : "The review could not be updated. Refresh and try again.",
      },
      { status: error instanceof TypeError ? 400 : reviewNotFound ? 404 : 409 }
    );
  }
}
