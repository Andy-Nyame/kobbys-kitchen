import { REVIEW_RATING_OPTIONS } from "@/lib/validation/review";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function ReviewCard({ review }) {
  const formattedDate = review.createdAt
    ? dateFormatter.format(new Date(review.createdAt))
    : "";

  return (
    <article className="review-card">
      <div
        aria-label={`Rated ${review.rating} out of 5 stars`}
        className="review-card__rating"
      >
        <div aria-hidden="true" className="review-card__stars">
          {REVIEW_RATING_OPTIONS.map((option) => (
            <span
              key={option}
              className={`review-card__star${
                review.rating >= option ? " review-card__star--selected" : ""
              }`}
            >
              ★
            </span>
          ))}
        </div>
        <span className="review-card__rating-text">
          {review.rating} out of 5
        </span>
      </div>

      <div className="review-card__meta">
        <h3>{review.displayName}</h3>
        <p>{review.category}</p>
      </div>

      <p className="review-card__comment">{review.comment}</p>
      {formattedDate ? <p className="review-card__date">{formattedDate}</p> : null}
    </article>
  );
}
