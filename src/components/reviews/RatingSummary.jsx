import { REVIEW_RATING_OPTIONS } from "@/lib/validation/review";

export default function RatingSummary({ averageRating, totalReviews }) {
  const roundedAverage = Math.round(averageRating);
  const averageLabel = `${averageRating.toFixed(1)} out of 5`;

  if (!totalReviews) {
    return null;
  }

  return (
    <section className="review-summary" aria-label="Review summary">
      <div className="review-summary__score">
        <strong>{averageRating.toFixed(1)}</strong>
        <span>{averageLabel} average rating</span>
      </div>

      <div className="review-summary__details">
        <div
          aria-label={`Average rating ${averageLabel} stars`}
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
