import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseReviewFilters } from "../lib/admin/filters.js";
import { getAdminAuthorization } from "../lib/auth/authorization.js";
import {
  getReviewModerationUpdate,
  isReviewId,
  REVIEW_MODERATION_ACTION,
  REVIEW_STATUS,
} from "../lib/reviews/moderation.js";
import { canPublicViewerSeeReview, getPublicReviewVisibility } from "../lib/reviews/visibility.js";

describe("server-side public review visibility", () => {
  it("limits anonymous visitors to approved and featured reviews", () => {
    assert.deepEqual(getPublicReviewVisibility(null), { status: "APPROVED", featured: true });
    assert.equal(canPublicViewerSeeReview({ status: "APPROVED", featured: true }, null), true);
    assert.equal(canPublicViewerSeeReview({ status: "APPROVED", featured: false }, null), false);
    assert.equal(canPublicViewerSeeReview({ status: "PENDING", featured: true }, null), false);
    assert.equal(canPublicViewerSeeReview({ status: "REJECTED", featured: true }, null), false);
  });

  it("lets customers see all approved reviews and no private states", () => {
    assert.deepEqual(getPublicReviewVisibility("CUSTOMER"), { status: "APPROVED" });
    assert.equal(canPublicViewerSeeReview({ status: "APPROVED", featured: false }, "CUSTOMER"), true);
    assert.equal(canPublicViewerSeeReview({ status: "PENDING", featured: true }, "CUSTOMER"), false);
    assert.equal(canPublicViewerSeeReview({ status: "REJECTED", featured: false }, "CUSTOMER"), false);
  });
});

describe("review moderation transitions", () => {
  it("approves pending or hidden reviews without featuring them", () => {
    for (const status of [REVIEW_STATUS.PENDING, REVIEW_STATUS.HIDDEN]) {
      assert.deepEqual(
        getReviewModerationUpdate({ status, featured: false }, REVIEW_MODERATION_ACTION.APPROVE),
        { status: REVIEW_STATUS.APPROVED, featured: false }
      );
    }
  });

  it("hides reviews and always clears featured", () => {
    assert.deepEqual(
      getReviewModerationUpdate(
        { status: REVIEW_STATUS.APPROVED, featured: true },
        REVIEW_MODERATION_ACTION.HIDE
      ),
      { status: REVIEW_STATUS.HIDDEN, featured: false }
    );
  });

  it("features approved reviews only", () => {
    assert.deepEqual(
      getReviewModerationUpdate(
        { status: REVIEW_STATUS.APPROVED, featured: false },
        REVIEW_MODERATION_ACTION.FEATURE
      ),
      { status: REVIEW_STATUS.APPROVED, featured: true }
    );

    for (const status of [REVIEW_STATUS.PENDING, REVIEW_STATUS.HIDDEN]) {
      assert.throws(
        () => getReviewModerationUpdate(
          { status, featured: false },
          REVIEW_MODERATION_ACTION.FEATURE
        ),
        /Only an approved review/
      );
    }
  });

  it("unfeatures without changing moderation state", () => {
    assert.deepEqual(
      getReviewModerationUpdate(
        { status: REVIEW_STATUS.APPROVED, featured: true },
        REVIEW_MODERATION_ACTION.UNFEATURE
      ),
      { status: REVIEW_STATUS.APPROVED, featured: false }
    );
  });

  it("fails closed for unsupported actions and invalid identifiers", () => {
    assert.throws(
      () => getReviewModerationUpdate(
        { status: REVIEW_STATUS.PENDING, featured: false },
        "PUBLISH"
      ),
      /Unsupported/
    );
    assert.equal(isReviewId("not-an-id"), false);
    assert.equal(isReviewId("79d0bf40-9595-4d5f-a1e4-e2cc7df204fe"), true);
  });
});

describe("review admin boundaries and filters", () => {
  it("allows ADMIN and denies public or CUSTOMER moderation contexts", () => {
    assert.equal(getAdminAuthorization(null, null).allowed, false);
    assert.equal(
      getAdminAuthorization({ id: "customer" }, "CUSTOMER").allowed,
      false
    );
    assert.equal(
      getAdminAuthorization({ id: "admin" }, "ADMIN").allowed,
      true
    );
  });

  it("accepts supported filters and fails safely for injected values", () => {
    assert.deepEqual(parseReviewFilters({ status: "approved", featured: "true", page: "2" }), {
      values: { status: "approved", featured: "true", page: 2 },
      errors: {},
    });

    const invalid = parseReviewFilters({ status: "approved,hidden", featured: "yes" });
    assert.deepEqual(invalid.values, { status: "", featured: "", page: 1 });
    assert.ok(invalid.errors.status);
    assert.ok(invalid.errors.featured);
  });
});
