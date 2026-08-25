import { redirect } from "next/navigation";

import AdminWorkspace from "@/components/admin/AdminWorkspace";
import ThemeControl from "@/components/theme/ThemeControl";
import { getAdminAccess } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }) {
  const { user, role } = await getAdminAccess();

  if (user && role !== "ADMIN") {
    redirect("/");
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

  return <AdminWorkspace user={user}>{children}</AdminWorkspace>;
}
