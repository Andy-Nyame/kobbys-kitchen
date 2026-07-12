import { headers } from "next/headers";

import ButtonLink from "@/components/ui/ButtonLink";
import ReviewCard from "@/components/reviews/ReviewCard";
import RatingSummary from "@/components/reviews/RatingSummary";
import { businessData } from "@/data/businessData";
import { REVIEW_LOAD_ERROR_MESSAGE } from "@/lib/validation/review";

async function getHomeReviewData() {
  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost || headerStore.get("host");

  if (!host) {
    throw new Error("Missing host header for reviews request.");
  }

  const forwardedProto = headerStore.get("x-forwarded-proto");
  const protocol = forwardedProto || (host.includes("localhost") ? "http" : "https");
  const response = await fetch(`${protocol}://${host}/api/reviews`, {
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || REVIEW_LOAD_ERROR_MESSAGE);
  }

  return payload;
}

function ReviewActions({ readFirst = false }) {
  const actions = readFirst
    ? [
        <ButtonLink key="read" href="/reviews" variant="secondary">
          Read All Reviews
        </ButtonLink>,
        <ButtonLink key="share" href="/reviews" variant="primary">
          Share Your Experience
        </ButtonLink>,
      ]
    : [
        <ButtonLink key="share" href="/reviews" variant="primary">
          Share Your Experience
        </ButtonLink>,
        <ButtonLink key="read" href="/reviews" variant="secondary">
          Read Reviews
        </ButtonLink>,
      ];

  return <div className="section-actions">{actions}</div>;
}

export default async function HomeReviewSummary() {
  let payload = null;

  try {
    payload = await getHomeReviewData();
  } catch (error) {
    console.error("[home-reviews] load_error", {
      message: error?.message || "unknown",
    });

    return (
      <div className="home-review-summary">
        <p className="review-status review-status--error">
          {REVIEW_LOAD_ERROR_MESSAGE}
        </p>
        <ReviewActions readFirst />
      </div>
    );
  }

  const { summary, featuredReview } = payload;

  if (!summary?.totalReviews) {
    return (
      <div className="home-review-summary">
        <p className="review-status">{businessData.reviewEmptyState}</p>
        <ReviewActions />
      </div>
    );
  }

  if (!featuredReview) {
    return (
      <div className="home-review-summary">
        <RatingSummary
          averageRating={summary.averageRating}
          totalReviews={summary.totalReviews}
        />
        <p className="review-status">
          Customer reviews are available. Read what customers have shared about
          Kobby’s Kitchen.
        </p>
        <ReviewActions readFirst />
      </div>
    );
  }

  return (
    <div className="home-review-summary home-review-summary--featured">
      <RatingSummary
        averageRating={summary.averageRating}
        totalReviews={summary.totalReviews}
      />
      <ReviewCard review={featuredReview} showDate={false} />
      <ReviewActions readFirst />
    </div>
  );
}
