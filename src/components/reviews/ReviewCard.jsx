import { REVIEW_RATING_OPTIONS } from "@/utils/reviewValidation";

export default function ReviewCard({ review }) {
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
        <h3>{review.name}</h3>
        <p>{review.category}</p>
      </div>

      <p className="review-card__comment">{review.comment}</p>
      <p className="review-card__date">{review.date}</p>
    </article>
  );
}
