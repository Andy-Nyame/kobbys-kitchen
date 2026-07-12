import { REVIEW_RATING_OPTIONS } from "@/lib/validation/review";

export default function RatingDistribution({ ratingDistribution, totalReviews }) {
  if (!totalReviews) {
    return null;
  }

  return (
    <section className="rating-distribution" aria-label="Rating distribution">
      <h3>Rating Distribution</h3>
      <ul className="rating-distribution__list">
        {REVIEW_RATING_OPTIONS.slice()
          .reverse()
          .map((rating) => {
            const count = ratingDistribution[String(rating)] || 0;
            const percentage = totalReviews
              ? `${(count / totalReviews) * 100}%`
              : "0%";

            return (
              <li key={rating} className="rating-distribution__item">
                <span className="rating-distribution__label">{rating} stars</span>
                <div
                  aria-hidden="true"
                  className="rating-distribution__track"
                >
                  <span
                    className="rating-distribution__fill"
                    style={{ width: percentage }}
                  />
                </div>
                <span className="rating-distribution__count">{count}</span>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
