import "server-only";

import { ADMIN_PAGE_SIZE } from "@/lib/admin/filters";
import { executeAdminReviewModeration } from "@/lib/reviews/admin-mutations";
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
  return executeAdminReviewModeration({
    prismaClient: prisma,
    reviewId,
    action,
    adminUserId,
  });
}
