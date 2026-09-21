import AdminCampaignManager from "@/components/admin/AdminCampaignManager";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { requireAdmin } from "@/lib/auth/guards";
import { getAdminCampaigns } from "@/lib/campaigns/server";

export const metadata = {
  title: "Admin Campaigns | Kobby's Kitchen",
  description: "Manage Kobby's Kitchen promotional campaign placements and schedules.",
};

export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  await requireAdmin("/admin/campaigns");

  let campaigns = null;
  try {
    campaigns = await getAdminCampaigns();
  } catch (error) {
    console.error("[admin-campaigns-page]", {
      category: error?.code || "query_failed",
    });
  }

  return (
    <>
      <PageIntro
        eyebrow="Admin marketing"
        title="Campaigns"
        description="Control promotional visibility, placements and scheduling without changing ordering or payment rules."
      />

      <ContentSection
        className="admin-section"
        title="Promotional campaigns"
        description="Dates use Ghana local time. Expired campaigns stop appearing automatically."
      >
        {campaigns ? (
          <AdminCampaignManager initialCampaigns={campaigns} />
        ) : (
          <div className="admin-notice admin-notice--warning" role="alert">
            <strong>Campaign settings are unavailable.</strong>
            <p>No changes can be saved until the current campaign data loads.</p>
          </div>
        )}
      </ContentSection>
    </>
  );
}
