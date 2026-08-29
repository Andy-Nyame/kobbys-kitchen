import AdminOperationsManager from "@/components/admin/AdminOperationsManager";
import PageIntro from "@/components/ui/PageIntro";
import { getAdminOrderingOperations } from "@/lib/admin/operations";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata = {
  title: "Ordering Operations | Kobby's Kitchen",
  description: "Manage Kobby's Kitchen online ordering hours and operational state.",
};

export const dynamic = "force-dynamic";

export default async function AdminOperationsPage() {
  await requireAdmin("/admin/operations");
  let operations = null;

  try {
    operations = await getAdminOrderingOperations();
  } catch (error) {
    console.error("[admin-ordering-operations-page]", {
      category: error?.code || "query_failed",
    });
  }

  return (
    <>
      <PageIntro
        eyebrow="Admin operations"
        title="Online Ordering Operations"
        description="Control when customers may submit website pickup orders. Physical restaurant hours are managed separately in Settings, and existing accepted orders are never changed here."
      />

      {operations ? (
        <AdminOperationsManager initialOperations={operations} />
      ) : (
        <p className="admin-data-error">
          Ordering operations could not be loaded. No settings have been changed.
        </p>
      )}
    </>
  );
}
