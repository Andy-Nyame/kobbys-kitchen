import AdminPromoManager from "@/components/admin/AdminPromoManager";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { requireAdmin } from "@/lib/auth/guards";
import { getAdminPromoWorkspace } from "@/lib/promos/admin-server";

export const metadata = {
  title: "Admin Promo Codes | Kobby's Kitchen",
  description: "Manage Kobby's Kitchen promo-code eligibility and limits.",
};

export const dynamic = "force-dynamic";

export default async function AdminPromosPage() {
  await requireAdmin("/admin/promos");
  let workspace = null;
  try {
    workspace = await getAdminPromoWorkspace();
  } catch (error) {
    console.error("[admin-promos-page]", {
      category: error?.code || "query_failed",
    });
  }

  return (
    <>
      <PageIntro
        eyebrow="Admin marketing"
        title="Promo Codes"
        description="Create one-code-per-order discounts with trusted schedules, limits and customer restrictions."
      />
      <ContentSection
        className="admin-section"
        title="Promo code controls"
        description="Cart application is a preview. Usage is reserved at order creation and finalized by verified payment or Cash-order acceptance."
      >
        {workspace ? (
          <AdminPromoManager
            customers={workspace.customers}
            initialPromos={workspace.promos}
          />
        ) : (
          <p className="admin-data-error" role="alert">Promo controls are temporarily unavailable.</p>
        )}
      </ContentSection>
    </>
  );
}
