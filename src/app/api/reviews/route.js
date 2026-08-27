import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  REVIEW_INVALID_JSON_MESSAGE,
  REVIEW_RATING_OPTIONS,
  REVIEW_LOAD_ERROR_MESSAGE,
  REVIEW_SERVER_ERROR_MESSAGE,
  REVIEW_SUCCESS_MESSAGE,
  REVIEW_VALIDATION_MESSAGE,
  validateReviewSubmission,
} from "@/lib/validation/review";

function createRatingDistribution() {
  return REVIEW_RATING_OPTIONS.slice().reverse().reduce((distribution, rating) => {
    distribution[String(rating)] = 0;
    return distribution;
  }, {});
}

function normalizePublicReview(review) {
  return {
    id: review.id,
    displayName: review.displayName,
    rating: review.rating,
    category: review.category,
    comment: review.content,
    createdAt: review.createdAt,
  };
}

function buildReviewSummary(reviews) {
  const ratingDistribution = createRatingDistribution();

  if (reviews.length === 0) {
    return { totalReviews: 0, averageRating: 0, ratingDistribution };
  }

  const ratingTotal = reviews.reduce((sum, review) => {
    ratingDistribution[String(review.rating)] += 1;
    return sum + review.rating;
  }, 0);

  return {
    totalReviews: reviews.length,
    averageRating: Number((ratingTotal / reviews.length).toFixed(1)),
    ratingDistribution,
  };
}

export async function GET() {
  try {
    const approved = await prisma.review.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        displayName: true,
        rating: true,
        category: true,
        content: true,
        featured: true,
        createdAt: true,
      },
    });
    const reviews = approved.map(normalizePublicReview);
    const featured = approved.find((review) => review.featured) || null;

    return NextResponse.json({
      ok: true,
      reviews,
      featuredReview: featured ? normalizePublicReview(featured) : null,
      summary: buildReviewSummary(reviews),
    });
  } catch (error) {
    console.error("[reviews-get]", { category: error?.code || "query_failed" });
    return NextResponse.json(
      { ok: false, message: REVIEW_LOAD_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: REVIEW_INVALID_JSON_MESSAGE },
      { status: 400 }
    );
  }

  const validation = validateReviewSubmission(payload);

  if (validation.isSpam) {
    return NextResponse.json(
      { ok: true, message: REVIEW_SUCCESS_MESSAGE },
      { status: 201 }
    );
  }

  if (Object.keys(validation.errors).length > 0) {
    return NextResponse.json(
      { ok: false, message: REVIEW_VALIDATION_MESSAGE, errors: validation.errors },
      { status: 400 }
    );
  }

  try {
    const user = await getAuthenticatedUser();
    const data = validation.data;
    await prisma.review.create({
      data: {
        userId: user?.role === "CUSTOMER" ? user.id : null,
        displayName: data.displayName,
        rating: data.rating,
        category: data.category,
        content: data.comment,
        contact: data.contact,
        status: "PENDING",
        featured: false,
      },
    });

    return NextResponse.json(
      { ok: true, message: REVIEW_SUCCESS_MESSAGE },
      { status: 201 }
    );
  } catch (error) {
    console.error("[reviews-post]", { category: error?.code || "insert_failed" });
    return NextResponse.json(
      { ok: false, message: REVIEW_SERVER_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}
