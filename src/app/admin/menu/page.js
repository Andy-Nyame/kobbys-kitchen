import AdminMenuManager from "@/components/admin/AdminMenuManager";
import PageIntro from "@/components/ui/PageIntro";
import { listAdminMenu } from "@/lib/admin/menu";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata = {
  title: "Admin Menu | Kobby's Kitchen",
  description: "Manage Kobby's Kitchen menu categories, items and images.",
};

export default async function AdminMenuPage() {
  await requireAdmin("/admin/menu");
  let catalogue = null;

  try {
    catalogue = await listAdminMenu();
  } catch (error) {
    console.error("[admin-menu]", {
      category: error?.code || "query_failed",
    });
  }

  return (
    <>
      <PageIntro
        description="Manage catalogue structure, food details, prices, visibility and image galleries."
        eyebrow="Admin operations"
        title="Menu Management"
      />

      {catalogue ? (
        <AdminMenuManager
          categories={catalogue.categories}
          items={catalogue.items}
        />
      ) : (
        <p className="admin-data-error">
          Menu management data could not be loaded. No catalogue data has been changed.
        </p>
      )}
    </>
  );
}
