import { redirect } from "next/navigation";

import AdminWorkspace from "@/components/admin/AdminWorkspace";
import ThemeControl from "@/components/theme/ThemeControl";
import { getAdminAccess } from "@/lib/auth/guards";
import { getUserProfile } from "@/lib/auth/guards";
import { getAdminPresentation } from "@/lib/admin/profile";
import { countNewAdminOrders } from "@/lib/admin/orders";
import { getNotificationSnapshot } from "@/lib/notifications/queries";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  const { user, role } = await getAdminAccess();

  if (user && role !== "ADMIN") {
    redirect("/access-denied?area=admin");
  }

  if (!user) {
    return (
      <div className="admin-auth-shell">
        <header className="admin-auth-header">
          <ThemeControl />
        </header>
        <main className="admin-auth-main">{children}</main>
      </div>
    );
  }

  const profile = await getUserProfile(user.id);
  let pendingOrderCount = 0;
  let notificationSnapshot = { notifications: [], unreadCount: 0 };
  try {
    const [countResult, notificationResult] = await Promise.allSettled([
      countNewAdminOrders(),
      getNotificationSnapshot(user.id),
    ]);
    if (countResult.status === "fulfilled") pendingOrderCount = countResult.value;
    if (notificationResult.status === "fulfilled") notificationSnapshot = notificationResult.value;
    if (countResult.status === "rejected" || notificationResult.status === "rejected") {
      throw countResult.reason || notificationResult.reason;
    }
  } catch (error) {
    console.error("[admin-header-data]", { category: error?.code || "query_failed" });
  }

  return (
    <AdminWorkspace
      notificationSnapshot={notificationSnapshot}
      pendingOrderCount={pendingOrderCount}
      presentation={getAdminPresentation(user, profile)}
      user={user}
    >
      {children}
    </AdminWorkspace>
  );
}
