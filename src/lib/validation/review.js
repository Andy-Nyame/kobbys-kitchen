export const REVIEW_RATING_OPTIONS = [1, 2, 3, 4, 5];

export const APPROVED_REVIEW_CATEGORIES = [
  "Food",
  "Customer Service",
  "Takeaway",
  "Event Order",
  "General Experience",
];

export const REVIEW_SUCCESS_MESSAGE =
  "Thank you. Your review has been submitted for approval.";
export const REVIEW_VALIDATION_MESSAGE =
  "Please check the highlighted information.";
export const REVIEW_INVALID_JSON_MESSAGE =
  "The review information could not be read.";
export const REVIEW_SERVER_ERROR_MESSAGE =
  "Your review could not be submitted right now. Please try again later.";
export const REVIEW_LOAD_ERROR_MESSAGE =
  "Customer reviews could not be loaded right now.";
export const REVIEW_RATING_ERROR =
  "Please select a rating from 1 to 5 stars.";

function sanitizeTextValue(value, { preserveLineBreaks = false } = {}) {
  if (typeof value !== "string") {
    return "";
  }

  const controlCharactersPattern = preserveLineBreaks
    ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g
    : /[\u0000-\u001F\u007F-\u009F]/g;

  const normalizedValue = preserveLineBreaks
    ? value.replace(/\r\n?/g, "\n")
    : value;

  return normalizedValue.replace(controlCharactersPattern, "").trim();
}

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

export function validateReviewSubmission(payload) {
  const errors = {};
  const displayName = sanitizeTextValue(payload?.displayName);
  const category = sanitizeTextValue(payload?.category);
  const comment = sanitizeTextValue(payload?.comment, {
    preserveLineBreaks: true,
  });
  const contactValue = payload?.contact;
  const contact = sanitizeTextValue(contactValue);
  const website = sanitizeTextValue(payload?.website);
  const rating = parseReviewRating(payload?.rating);

  if (website) {
    return {
      data: null,
      errors: {},
      isSpam: true,
    };
  }

  if (typeof payload?.displayName !== "string" || displayName.length < 2) {
    errors.displayName =
      "Please enter a display name with at least 2 characters.";
  } else if (displayName.length > 80) {
    errors.displayName = "Display name must be 80 characters or fewer.";
  }

  if (rating === null) {
    errors.rating = REVIEW_RATING_ERROR;
  }

  if (!APPROVED_REVIEW_CATEGORIES.includes(category)) {
    errors.category = "Please select an approved review category.";
  }

  if (typeof payload?.comment !== "string" || comment.length < 10) {
    errors.comment = "Please enter a comment with at least 10 characters.";
  } else if (comment.length > 1000) {
    errors.comment = "Comment must be 1000 characters or fewer.";
  }

  if (
    contactValue !== undefined &&
    contactValue !== null &&
    typeof contactValue !== "string"
  ) {
    errors.contact = "Optional contact information must be text only.";
  } else if (contact.length > 120) {
    errors.contact = "Contact information must be 120 characters or fewer.";
  }

  if (payload?.consent !== true) {
    errors.consent = "Please confirm the review consent checkbox.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      data: null,
      errors,
      isSpam: false,
    };
  }

  return {
    data: {
      displayName,
      rating,
      category,
      comment,
      contact: contact || null,
      consent: true,
      website: "",
    },
    errors: {},
    isSpam: false,
  };
}
