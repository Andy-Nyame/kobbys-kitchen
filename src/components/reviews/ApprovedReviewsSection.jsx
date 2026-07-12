"use client";

import { useEffect, useState } from "react";

import RatingDistribution from "@/components/reviews/RatingDistribution";
import RatingSummary from "@/components/reviews/RatingSummary";
import ReviewCard from "@/components/reviews/ReviewCard";
import { REVIEW_LOAD_ERROR_MESSAGE } from "@/lib/validation/review";

const initialState = {
  loading: true,
  error: "",
  reviews: [],
  summary: {
    totalReviews: 0,
    averageRating: 0,
    ratingDistribution: {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    },
  },
};

export default function ApprovedReviewsSection({ emptyMessage }) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let isActive = true;

    async function loadReviews() {
      try {
        const response = await fetch("/api/reviews", {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.message || REVIEW_LOAD_ERROR_MESSAGE);
        }

        if (!isActive) {
          return;
        }

        setState({
          loading: false,
          error: "",
          reviews: payload.reviews || [],
          summary: payload.summary || initialState.summary,
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState((current) => ({
          ...current,
          loading: false,
          error: REVIEW_LOAD_ERROR_MESSAGE,
        }));
      }
    }

    loadReviews();

    return () => {
      isActive = false;
    };
  }, []);

  if (state.loading) {
    return <p className="review-status">Loading customer reviews...</p>;
  }

  if (state.error) {
    return (
      <p className="review-status review-status--error" role="alert">
        {state.error}
      </p>
    );
  }

  if (state.summary.totalReviews === 0) {
    return <p className="review-status">{emptyMessage}</p>;
  }

  return (
    <div className="review-results">
      <div className="review-results__overview">
        <RatingSummary
          averageRating={state.summary.averageRating}
          totalReviews={state.summary.totalReviews}
        />
        <RatingDistribution
          ratingDistribution={state.summary.ratingDistribution}
          totalReviews={state.summary.totalReviews}
        />
      </div>

      <div className="review-list">
        {state.reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </div>
  );
}
