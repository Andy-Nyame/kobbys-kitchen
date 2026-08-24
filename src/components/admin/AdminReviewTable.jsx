import AdminReviewActions from "@/components/admin/AdminReviewActions";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import { formatAdminDateTime } from "@/lib/admin/presentation";

export default function AdminReviewTable({ reviews }) {
  if (!reviews.length) {
    return <p className="admin-empty-state">No reviews match these filters.</p>;
  }

  return (
    <div
      aria-label="Reviews moderation table"
      className="admin-table-shell"
      role="region"
      tabIndex="0"
    >
      <table className="admin-table admin-table--reviews">
        <thead>
          <tr>
            <th scope="col">Reviewer</th>
            <th scope="col">Review</th>
            <th scope="col">Submitted</th>
            <th scope="col">State</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((review) => (
            <tr key={review.id}>
              <td data-label="Reviewer">
                <strong>{review.display_name}</strong>
                <span className="admin-table__secondary">
                  {review.rating} / 5 · {review.category}
                </span>
              </td>
              <td data-label="Review">
                <p className="admin-review-comment">{review.comment}</p>
              </td>
              <td data-label="Submitted">
                {formatAdminDateTime(review.created_at)}
              </td>
              <td data-label="State">
                <AdminStatusBadge status={review.status} type="review" />
                <span className="admin-table__secondary">
                  {review.featured ? "Featured" : "Not featured"}
                </span>
              </td>
              <td data-label="Actions">
                <AdminReviewActions review={review} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
