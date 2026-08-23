import Link from "next/link";

import AdminNavigation from "@/components/admin/AdminNavigation";
import ThemeControl from "@/components/theme/ThemeControl";
import { requireAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  await requireAdmin();

  return (
    <>
      <header className="admin-header">
        <div className="container admin-header__inner">
          <Link className="admin-header__brand" href="/admin">
            <span className="admin-header__name">Admin</span>
            <span className="admin-header__tagline">Kobby&rsquo;s Kitchen</span>
          </Link>

          <AdminNavigation />

          <div className="admin-header__actions">
            <span className="admin-header__role">Admin</span>
            <ThemeControl compact />
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="button-link button-link--secondary"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="page">
        <div className="container content-stack">
          {children}
        </div>
      </main>

      <footer className="site-footer">
        <div className="container site-footer__bottom">
          <p className="site-footer__copy">
            &copy; {new Date().getFullYear()} Kobby&rsquo;s Kitchen. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}
