export const REVIEW_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  HIDDEN: "hidden",
});

export const REVIEW_MODERATION_ACTION = Object.freeze({
  APPROVE: "APPROVE",
  HIDE: "HIDE",
  FEATURE: "FEATURE",
  UNFEATURE: "UNFEATURE",
});

const REVIEW_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isReviewId(value) {
  return typeof value === "string" && REVIEW_ID_PATTERN.test(value);
}

export function getReviewModerationUpdate(review, action) {
  if (!review || !Object.values(REVIEW_STATUS).includes(review.status)) {
    throw new TypeError("A valid current review state is required.");
  }

  if (!Object.values(REVIEW_MODERATION_ACTION).includes(action)) {
    throw new TypeError("Unsupported review moderation action.");
  }

  switch (action) {
    case REVIEW_MODERATION_ACTION.APPROVE:
      return { status: REVIEW_STATUS.APPROVED, featured: false };
    case REVIEW_MODERATION_ACTION.HIDE:
      return { status: REVIEW_STATUS.HIDDEN, featured: false };
    case REVIEW_MODERATION_ACTION.FEATURE:
      if (review.status !== REVIEW_STATUS.APPROVED) {
        throw new TypeError("Only an approved review can be featured.");
      }

      return { status: REVIEW_STATUS.APPROVED, featured: true };
    case REVIEW_MODERATION_ACTION.UNFEATURE:
      return { status: review.status, featured: false };
    default:
      throw new TypeError("Unsupported review moderation action.");
  }
}
