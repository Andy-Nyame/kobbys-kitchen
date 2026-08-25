import Link from "next/link";

import AdminPagination from "@/components/admin/AdminPagination";
import AdminQueryNotice from "@/components/admin/AdminQueryNotice";
import AdminReviewTable from "@/components/admin/AdminReviewTable";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { parseReviewFilters } from "@/lib/admin/filters";
import { listAdminReviews } from "@/lib/admin/reviews";
import { formatStatusLabel } from "@/lib/admin/presentation";
import { requireAdmin } from "@/lib/auth/guards";
import { REVIEW_STATUS } from "@/lib/reviews/moderation";

export const metadata = {
  title: "Admin Reviews | Kobby's Kitchen",
  description: "Moderate Kobby's Kitchen customer reviews.",
};

export default async function AdminReviewsPage({ searchParams }) {
  await requireAdmin("/admin/reviews");

  const params = await searchParams;
  const { values: filters, errors } = parseReviewFilters(params);
  let result = null;

  try {
    result = await listAdminReviews(filters);
  } catch (error) {
    console.error("[admin-reviews]", error);
  }

  return (
    <>
      <PageIntro
        eyebrow="Admin operations"
        title="Reviews"
        description="Approve genuine customer feedback and control which approved reviews are featured publicly."
      />

      <ContentSection
        className="admin-section"
        description="Pending, approved, hidden and featured views use real review records."
        title="Review Filters"
      >
        <AdminQueryNotice errors={errors} />
        <form action="/admin/reviews" className="admin-filter-form" method="GET">
          <label className="form-field">
            <span>Moderation state</span>
            <select defaultValue={filters.status} name="status">
              <option value="">All states</option>
              {Object.values(REVIEW_STATUS).map((status) => (
                <option key={status} value={status}>
                  {formatStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Featured</span>
            <select defaultValue={filters.featured} name="featured">
              <option value="">All reviews</option>
              <option value="true">Featured only</option>
            </select>
          </label>
          <div className="admin-filter-form__actions">
            <button className="button-link button-link--primary" type="submit">
              Apply filters
            </button>
            <Link className="button-link button-link--secondary" href="/admin/reviews">
              Clear
            </Link>
          </div>
        </form>
      </ContentSection>

      <ContentSection
        className="admin-section"
        description={result
          ? `${result.total} matching review${result.total === 1 ? "" : "s"}.`
          : "Review data is currently unavailable."}
        title="Moderation Queue"
      >
        {result ? (
          <>
            <AdminReviewTable reviews={result.rows} />
            <AdminPagination
              basePath="/admin/reviews"
              page={result.page}
              pageSize={result.pageSize}
              query={filters}
              total={result.total}
            />
          </>
        ) : (
          <p className="admin-data-error">
            Reviews could not be loaded. No data has been changed.
          </p>
        )}
      </ContentSection>
    </>
  );
}
