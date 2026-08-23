import Link from "next/link";

function createPageHref(basePath, query, page) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value && key !== "page") {
      searchParams.set(key, String(value));
    }
  }

  searchParams.set("page", String(page));
  return `${basePath}?${searchParams.toString()}`;
}

export default function AdminPagination({
  basePath,
  page,
  pageSize,
  total,
  query,
}) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="admin-pagination" aria-label="Results pages">
      {page > 1 ? (
        <Link
          className="button-link button-link--secondary"
          href={createPageHref(basePath, query, page - 1)}
        >
          Previous
        </Link>
      ) : (
        <span className="button-link button-link--secondary button-link--disabled">
          Previous
        </span>
      )}
      <span>
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          className="button-link button-link--secondary"
          href={createPageHref(basePath, query, page + 1)}
        >
          Next
        </Link>
      ) : (
        <span className="button-link button-link--secondary button-link--disabled">
          Next
        </span>
      )}
    </nav>
  );
}
