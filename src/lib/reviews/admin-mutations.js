import { getReviewModerationUpdate, isReviewId } from "./moderation.js";

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

export async function executeAdminReviewModeration({
  prismaClient,
  reviewId,
  action,
  adminUserId,
}) {
  if (!isReviewId(reviewId) || !isReviewId(adminUserId)) {
    throw new TypeError("A valid review and admin identity are required.");
  }

  return prismaClient.$transaction(async (transaction) => {
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

    if (!currentReview) throw new Error("The review could not be found.");
    if (admin?.role !== "ADMIN") throw new Error("Admin authorization is required.");

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
