import "server-only";

import { ADMIN_PAGE_SIZE } from "@/lib/admin/filters";
import { getReviewModerationUpdate, isReviewId } from "@/lib/reviews/moderation";
import { prisma } from "@/lib/prisma";

const databaseStatus = {
  pending: "PENDING",
  approved: "APPROVED",
  hidden: "REJECTED",
};

const publicStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "hidden",
};

export async function listAdminReviews(filters) {
  const start = (filters.page - 1) * ADMIN_PAGE_SIZE;
  const where = {
    ...(filters.status ? { status: databaseStatus[filters.status] } : {}),
    ...(filters.featured ? { featured: true } : {}),
  };
  const [reviews, count] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: start,
      take: ADMIN_PAGE_SIZE,
      include: {
        moderationHistory: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    prisma.review.count({ where }),
  ]);

  return {
    rows: reviews.map((review) => ({
      id: review.id,
      display_name: review.displayName,
      rating: review.rating,
      category: review.category,
      comment: review.content,
      status: publicStatus[review.status],
      featured: review.featured,
      moderated_at: review.moderationHistory[0]?.createdAt || null,
      created_at: review.createdAt,
    })),
    total: count,
    page: filters.page,
    pageSize: ADMIN_PAGE_SIZE,
  };
}

export async function moderateAdminReview({ reviewId, action, adminUserId }) {
  if (!isReviewId(reviewId) || !isReviewId(adminUserId)) {
    throw new TypeError("A valid review and admin identity are required.");
  }

  return prisma.$transaction(async (transaction) => {
    const [currentReview, admin] = await Promise.all([
      transaction.review.findUnique({
        where: { id: reviewId },
        select: { id: true, status: true, featured: true },
      }),
      transaction.user.findUnique({
        where: { id: adminUserId },
        select: { role: true },
      }),
    ]);

    if (!currentReview) {
      throw new Error("The review could not be found.");
    }

    if (admin?.role !== "ADMIN") {
      throw new Error("Admin authorization is required.");
    }

    const update = getReviewModerationUpdate(
      { status: publicStatus[currentReview.status], featured: currentReview.featured },
      action
    );
    const nextStatus = databaseStatus[update.status];
    const changed = await transaction.review.updateMany({
      where: {
        id: reviewId,
        status: currentReview.status,
        featured: currentReview.featured,
      },
      data: { status: nextStatus, featured: update.featured },
    });

    if (changed.count !== 1) {
      throw new Error("The review changed before moderation completed.");
    }

    const updatedReview = await transaction.review.findUnique({
      where: { id: reviewId },
      select: { id: true, status: true, featured: true, updatedAt: true },
    });

    await transaction.reviewModeration.create({
      data: {
        reviewId,
        moderatorId: adminUserId,
        action,
        previousStatus: currentReview.status,
        nextStatus,
        previousFeatured: currentReview.featured,
        nextFeatured: updatedReview.featured,
      },
    });

    return {
      id: updatedReview.id,
      status: publicStatus[updatedReview.status],
      featured: updatedReview.featured,
      moderated_at: updatedReview.updatedAt,
    };
  });
}
