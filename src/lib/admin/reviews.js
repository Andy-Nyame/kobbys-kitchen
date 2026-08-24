import "server-only";

import { ADMIN_PAGE_SIZE } from "@/lib/admin/filters";
import {
  getReviewModerationUpdate,
  isReviewId,
} from "@/lib/reviews/moderation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const REVIEW_FIELDS = `
  id,
  display_name,
  rating,
  category,
  comment,
  status,
  featured,
  moderated_at,
  created_at
`;

export async function listAdminReviews(filters) {
  const supabase = createSupabaseAdminClient();
  const start = (filters.page - 1) * ADMIN_PAGE_SIZE;
  const end = start + ADMIN_PAGE_SIZE - 1;
  let query = supabase
    .from("reviews")
    .select(REVIEW_FIELDS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(start, end);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.featured) {
    query = query.eq("featured", true);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error("Unable to load admin reviews", { cause: error });
  }

  return {
    rows: data || [],
    total: count || 0,
    page: filters.page,
    pageSize: ADMIN_PAGE_SIZE,
  };
}

export async function moderateAdminReview({ reviewId, action, adminUserId }) {
  if (!isReviewId(reviewId) || !isReviewId(adminUserId)) {
    throw new TypeError("A valid review and admin identity are required.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: currentReview, error: currentError } = await supabase
    .from("reviews")
    .select("id, status, featured")
    .eq("id", reviewId)
    .single();

  if (currentError || !currentReview) {
    throw new Error("The review could not be found.", { cause: currentError });
  }

  const update = getReviewModerationUpdate(currentReview, action);
  const { data: updatedReview, error: updateError } = await supabase
    .from("reviews")
    .update({
      ...update,
      moderated_by: adminUserId,
    })
    .eq("id", reviewId)
    .eq("status", currentReview.status)
    .eq("featured", currentReview.featured)
    .select("id, status, featured, moderated_at")
    .single();

  if (updateError || !updatedReview) {
    throw new Error("The review changed before moderation completed.", {
      cause: updateError,
    });
  }

  return updatedReview;
}
