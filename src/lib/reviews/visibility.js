export function getPublicReviewVisibility(role) {
  return role === "CUSTOMER"
    ? { status: "APPROVED" }
    : { status: "APPROVED", featured: true };
}

export function canPublicViewerSeeReview(review, role) {
  if (review?.status !== "APPROVED") return false;
  return role === "CUSTOMER" || review.featured === true;
}
