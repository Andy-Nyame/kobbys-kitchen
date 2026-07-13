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

const REVIEW_TABLE_MISSING_CODES = new Set(["42P01", "PGRST205"]);
const REVIEW_COLUMN_MISMATCH_CODES = new Set(["42703", "PGRST204"]);
const REVIEW_CONSTRAINT_CODES = new Set([
  "22P02",
  "23502",
  "23503",
  "23505",
  "23514",
  "23P01",
]);
const REVIEW_PERMISSION_CODES = new Set(["42501"]);
const ADMIN_AUTH_CODES = new Set(["28000", "28P01", "PGRST301", "PGRST302"]);

function classifyReviewInsertError(error, status) {
  const code = error?.code || null;
  const message = typeof error?.message === "string" ? error.message : "";
  const hint = typeof error?.hint === "string" ? error.hint : "";
  const columnMismatch = REVIEW_COLUMN_MISMATCH_CODES.has(code);
  const constraintMismatch = REVIEW_CONSTRAINT_CODES.has(code);

  let category = "review_insert_error";

  if (
    ADMIN_AUTH_CODES.has(code) ||
    status === 401 ||
    /invalid api key|invalid jwt|jwt expired|unauthorized/i.test(
      `${message} ${hint}`
    )
  ) {
    category = "admin_auth_error";
  } else if (
    status === 0 ||
    /fetch failed|failed to fetch|networkerror|enotfound|econnrefused|timeout/i.test(
      `${message} ${hint}`
    )
  ) {
    category = "supabase_network_error";
  } else if (REVIEW_TABLE_MISSING_CODES.has(code)) {
    category = "review_table_missing";
  } else if (columnMismatch) {
    category = "review_column_mismatch";
  } else if (constraintMismatch) {
    category = "review_constraint_violation";
  } else if (REVIEW_PERMISSION_CODES.has(code) || status === 403) {
    category = "review_permission_error";
  }

  return {
    code,
    category,
    configurationMissing: false,
    columnMismatch,
    constraintMismatch,
  };
}

function logReviewPostFailure({ operation, category, code = null }) {
  console.error("[reviews-post]", {
    operation,
    category,
    code,
  });
}

function logUnexpectedException(error) {
  logReviewPostFailure({
    operation: "unexpected_exception",
    category:
      typeof error?.name === "string" && error.name
        ? error.name
        : "unknown_error",
  });
}

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

  let validationResult;

  try {
    validationResult = validateReviewSubmission(payload);
  } catch (error) {
    logUnexpectedException(error);
    return createServerErrorResponse();
  }

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
  } catch (error) {
    logReviewPostFailure({
      operation: "create_admin_client",
      category: error?.reason || "supabase_admin_client_creation_error",
    });

    return createServerErrorResponse();
  }

  const { data } = validationResult;
  let insertResult;

  try {
    insertResult = await supabase
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
  } catch (error) {
    logUnexpectedException(error);
    return createServerErrorResponse();
  }

  const { error, status } = insertResult;

  if (error) {
    const diagnostic = classifyReviewInsertError(error, status);

    logReviewPostFailure({
      operation: "insert_review",
      category: diagnostic.category,
      code: diagnostic.code,
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
