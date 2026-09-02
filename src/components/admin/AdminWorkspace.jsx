import Link from "next/link";

import AdminNavigation from "@/components/admin/AdminNavigation";
import AdminAccountMenu from "@/components/admin/AdminAccountMenu";
import NotificationBell from "@/components/notifications/NotificationBell";
import ThemeControl from "@/components/theme/ThemeControl";
import { ADMIN_SOUND_NOTIFICATION_TYPES } from "@/lib/notifications/domain";

function AdminUtility({ presentation }) {
  return (
    <div className="admin-workspace__utility">
      <ThemeControl className="admin-workspace__theme" />

      <AdminAccountMenu presentation={presentation} />
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

export default function AdminWorkspace({
  children,
  notificationSnapshot,
  presentation,
  pendingOrderCount = 0,
}) {
  return (
    <div className="admin-workspace">
      <aside className="admin-sidebar" aria-label="Administration workspace">
        <AdminBrand />
        <AdminNavigation pendingOrderCount={pendingOrderCount} />
        <AdminUtility presentation={presentation} />
        <p className="admin-workspace__copyright">
          &copy; {new Date().getFullYear()}{" "}Kobby&rsquo;s Kitchen
        </p>
      </aside>

      <div className="admin-workspace__body">
        <header className="admin-mobile-header">
          <AdminBrand />
          <div className="admin-mobile-header__actions">
            <NotificationBell
              initialSnapshot={notificationSnapshot}
              soundPreferenceKey="kobbys-admin-notification-sound"
              soundTypes={ADMIN_SOUND_NOTIFICATION_TYPES}
              toastTypes={ADMIN_SOUND_NOTIFICATION_TYPES}
              variant="admin"
            />
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
                <AdminNavigation closeDetailsOnClick pendingOrderCount={pendingOrderCount} />
                <AdminUtility presentation={presentation} />
              </div>
            </details>
          </div>
        </header>

        <main className="admin-workspace__main">
          <div className="admin-workspace__content content-stack">{children}</div>
        </main>
      </div>
    </div>
  );
}
