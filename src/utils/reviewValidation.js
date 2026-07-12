export const REVIEW_RATING_OPTIONS = [1, 2, 3, 4, 5];

export const REVIEW_RATING_ERROR =
  "Please select a rating from 1 to 5 stars.";

export function parseReviewRating(value) {
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const parsedValue = typeof value === "number" ? value : Number(String(value));

  if (
    !Number.isInteger(parsedValue) ||
    !REVIEW_RATING_OPTIONS.includes(parsedValue)
  ) {
    return null;
  }

  return parsedValue;
}

export function validateReviewPayload(payload) {
  const rating = parseReviewRating(payload.rating);

  if (rating === null) {
    return {
      data: null,
      errors: {
        rating: REVIEW_RATING_ERROR,
      },
    };
  }

  return {
    data: {
      ...payload,
      rating,
    },
    errors: {},
  };
}
