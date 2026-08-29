import { redirect } from "next/navigation";

import AdminWorkspace from "@/components/admin/AdminWorkspace";
import ThemeControl from "@/components/theme/ThemeControl";
import { getAdminAccess } from "@/lib/auth/guards";
import { getUserProfile } from "@/lib/auth/guards";
import { getAdminPresentation } from "@/lib/admin/profile";

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

  return (
    <AdminWorkspace presentation={getAdminPresentation(user, profile)} user={user}>
      {children}
    </AdminWorkspace>
  );
}
