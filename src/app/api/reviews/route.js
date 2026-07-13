import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  REVIEW_INVALID_JSON_MESSAGE,
  REVIEW_RATING_OPTIONS,
  REVIEW_LOAD_ERROR_MESSAGE,
  REVIEW_SERVER_ERROR_MESSAGE,
  REVIEW_SUCCESS_MESSAGE,
  REVIEW_VALIDATION_MESSAGE,
  validateReviewSubmission,
} from "@/lib/validation/review";

function createValidationErrorResponse(errors) {
  return NextResponse.json(
    {
      ok: false,
      message: REVIEW_VALIDATION_MESSAGE,
      errors,
    },
    { status: 400 }
  );
}

function createServerErrorResponse() {
  return NextResponse.json(
    {
      ok: false,
      message: REVIEW_SERVER_ERROR_MESSAGE,
    },
    { status: 500 }
  );
}

function createReviewLoadErrorResponse() {
  return NextResponse.json(
    {
      ok: false,
      message: REVIEW_LOAD_ERROR_MESSAGE,
    },
    { status: 500 }
  );
}

function createRatingDistribution() {
  return REVIEW_RATING_OPTIONS.slice()
    .reverse()
    .reduce((distribution, rating) => {
      distribution[String(rating)] = 0;
      return distribution;
    }, {});
}

function normalizePublicReview(review) {
  return {
    id: review.id,
    displayName: review.display_name,
    rating: review.rating,
    category: review.category,
    comment: review.comment,
    createdAt: review.created_at,
  };
}

function getFeaturedReview(reviews) {
  const featuredReviews = reviews.filter((review) => review.featured === true);

  if (featuredReviews.length === 0) {
    return null;
  }

  if (featuredReviews.length > 1) {
    console.warn("[reviews-get] multiple_featured_approved_reviews", {
      count: featuredReviews.length,
    });
  }

  return normalizePublicReview(featuredReviews[0]);
}

function buildReviewSummary(reviews) {
  const totalReviews = reviews.length;
  const ratingDistribution = createRatingDistribution();

  if (totalReviews === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution,
    };
  }

  const totalRating = reviews.reduce((sum, review) => {
    ratingDistribution[String(review.rating)] += 1;
    return sum + review.rating;
  }, 0);

  return {
    totalReviews,
    averageRating: Number((totalRating / totalReviews).toFixed(1)),
    ratingDistribution,
  };
}

export async function GET() {
  let supabase;

  try {
    supabase = createSupabaseAdminClient();
  } catch {
    console.error("[reviews-get]", {
      category: "supabase_admin_client_error",
      code: null,
    });

    return createReviewLoadErrorResponse();
  }

  const { data, error } = await supabase
    .schema("public")
    .from("reviews")
    .select("id, display_name, rating, category, comment, featured, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[reviews-get]", {
      category: "approved_review_select_error",
      code: error.code || null,
    });

    return createReviewLoadErrorResponse();
  }

  const approvedReviews = data || [];
  const reviews = approvedReviews.map(normalizePublicReview);

  return NextResponse.json(
    {
      ok: true,
      reviews,
      featuredReview: getFeaturedReview(approvedReviews),
      summary: buildReviewSummary(reviews),
    },
    { status: 200 }
  );
}

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: REVIEW_INVALID_JSON_MESSAGE,
      },
      { status: 400 }
    );
  }

  const validationResult = validateReviewSubmission(payload);

  if (validationResult.isSpam) {
    return NextResponse.json(
      {
        ok: true,
        message: REVIEW_SUCCESS_MESSAGE,
      },
      { status: 201 }
    );
  }

  if (Object.keys(validationResult.errors).length > 0) {
    return createValidationErrorResponse(validationResult.errors);
  }

  let supabase;

  try {
    supabase = createSupabaseAdminClient();
  } catch {
    console.error("[reviews-post]", {
      category: "supabase_admin_client_error",
      code: null,
    });

    return createServerErrorResponse();
  }

  const { data } = validationResult;
  const { error } = await supabase
    .schema("public")
    .from("reviews")
    .insert({
      display_name: data.displayName,
      rating: data.rating,
      category: data.category,
      comment: data.comment,
      contact: data.contact,
      status: "pending",
      featured: false,
    });

  if (error) {
    console.error("[reviews-post]", {
      category: "review_insert_error",
      code: error.code || null,
    });

    return createServerErrorResponse();
  }

  return NextResponse.json(
    {
      ok: true,
      message: REVIEW_SUCCESS_MESSAGE,
    },
    { status: 201 }
  );
}
