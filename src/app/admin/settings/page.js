import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { getOrderingAvailability } from "@/lib/admin/ordering-status";
import { formatAdminDateTime } from "@/lib/admin/presentation";
import { getAdminOrderingSettings } from "@/lib/admin/settings";
import { requireAdmin } from "@/lib/auth/guards";
import { isOrderingEnabled } from "@/lib/feature-flags";

export const metadata = {
  title: "Admin Settings | Kobby's Kitchen",
  description: "Read-only Kobby's Kitchen operational settings.",
};

export default async function AdminSettingsPage() {
  await requireAdmin("/admin/settings");

  let settings = null;

  try {
    settings = await getAdminOrderingSettings();
  } catch (error) {
    console.error("[admin-settings]", error);
  }

  const featureEnabled = isOrderingEnabled();
  const orderingStatus = getOrderingAvailability({
    featureEnabled,
    acceptingOrders: settings?.acceptingOrders === true,
  });

  return (
    <>
      <PageIntro
        eyebrow="Admin operations"
        title="Settings"
        description="Read-only build and kitchen availability settings."
      />

      <ContentSection title="Online Ordering" description="The build flag is authoritative and cannot be bypassed by the operational setting." className="admin-section">
        <dl className="admin-settings-list">
          <div>
            <dt>Build feature</dt>
            <dd>{featureEnabled ? "Enabled" : "Disabled"}</dd>
          </div>
          <div>
            <dt>Accepting orders</dt>
            <dd>{settings ? (settings.acceptingOrders ? "Yes" : "No") : "Unavailable"}</dd>
          </div>
          <div>
            <dt>Effective state</dt>
            <dd>{orderingStatus.label}</dd>
          </div>
          <div>
            <dt>Last operational update</dt>
            <dd>{formatAdminDateTime(settings?.updatedAt)}</dd>
          </div>
        </dl>
        <div className="admin-notice admin-notice--info">
          <strong>{orderingStatus.message}</strong>
          <p>No setting changes are available in this visibility-only milestone.</p>
        </div>
      </ContentSection>

      <ContentSection title="Fulfillment" description="Current V2 fulfillment scope." className="admin-section">
        <dl className="admin-settings-list">
          <div><dt>Pickup</dt><dd>Foundation ready</dd></div>
          <div><dt>Delivery</dt><dd>Coming Soon</dd></div>
        </dl>
      </ContentSection>
    </>
  );
}
