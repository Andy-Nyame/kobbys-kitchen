import { REVIEW_RATING_OPTIONS } from "@/lib/validation/review";

export default function RatingSummary({ averageRating, totalReviews }) {
  const roundedAverage = Math.round(averageRating);

  if (!totalReviews) {
    return null;
  }

  return (
    <section className="review-summary" aria-label="Review summary">
      <div className="review-summary__score">
        <strong>{averageRating.toFixed(1)}</strong>
        <span>Average rating</span>
      </div>

      <div className="review-summary__details">
        <div
          aria-label={`Average rating ${averageRating.toFixed(1)} out of 5 stars`}
          className="review-summary__stars"
        >
          {REVIEW_RATING_OPTIONS.map((option) => (
            <span
              key={option}
              className={`review-summary__star${
                roundedAverage >= option ? " review-summary__star--selected" : ""
              }`}
            >
              ★
            </span>
          ))}
        </div>
        <p className="review-summary__meta">
          {totalReviews} approved review{totalReviews === 1 ? "" : "s"}
        </p>
      </div>
    </section>
  );
}
