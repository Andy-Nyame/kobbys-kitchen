import Link from "next/link";

import AdminNavigation from "@/components/admin/AdminNavigation";
import ThemeControl from "@/components/theme/ThemeControl";

function AdminUtility({ email }) {
  return (
    <div className="admin-workspace__utility">
      <ThemeControl className="admin-workspace__theme" />

      <div className="admin-workspace__identity">
        <span>Signed in as Admin</span>
        <strong>{email || "Kobby’s Kitchen administrator"}</strong>
      </div>

      <Link className="admin-workspace__public-link" href="/">
        View public site
      </Link>

      <form action="/api/auth/logout?next=/admin" method="POST">
        <button className="button-link button-link--secondary" type="submit">
          Sign Out
        </button>
      </form>
    </div>
  );
}

function AdminBrand() {
  return (
    <Link className="admin-workspace__brand" href="/admin">
      <span className="admin-workspace__brand-name">Kobby&rsquo;s Kitchen</span>
      <span className="admin-workspace__brand-context">Administration</span>
    </Link>
  );
}

export default function AdminWorkspace({ children, user }) {
  return (
    <div className="admin-workspace">
      <aside className="admin-sidebar" aria-label="Administration workspace">
        <AdminBrand />
        <AdminNavigation />
        <AdminUtility email={user.email} />
        <p className="admin-workspace__copyright">
          &copy; {new Date().getFullYear()}{" "}Kobby&rsquo;s Kitchen
        </p>
      </aside>

      <div className="admin-workspace__body">
        <header className="admin-mobile-header">
          <AdminBrand />
          <details className="admin-mobile-drawer">
            <summary
              aria-controls="admin-mobile-drawer-panel"
              className="admin-mobile-drawer__toggle"
            >
              <span className="admin-mobile-drawer__label admin-mobile-drawer__label--closed sr-only">
                Open administration navigation
              </span>
              <span className="admin-mobile-drawer__label admin-mobile-drawer__label--open sr-only">
                Close administration navigation
              </span>
              <span aria-hidden="true" className="admin-mobile-drawer__icon">
                <span />
                <span />
                <span />
              </span>
            </summary>
            <div className="admin-mobile-drawer__panel" id="admin-mobile-drawer-panel">
              <AdminNavigation closeDetailsOnClick />
              <AdminUtility email={user.email} />
            </div>
          </details>
        </header>

        <main className="admin-workspace__main">
          <div className="admin-workspace__content content-stack">{children}</div>
        </main>
      </div>
    </div>
  );
}
