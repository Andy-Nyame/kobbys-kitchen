import AdminBusinessHoursManager from "@/components/admin/AdminBusinessHoursManager";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { getOrderingAvailability } from "@/lib/admin/ordering-status";
import { formatAdminDateTime } from "@/lib/admin/presentation";
import { getAdminOrderingSettings } from "@/lib/admin/settings";
import { getAdminBusinessHours } from "@/lib/admin/business-hours";
import { requireAdmin } from "@/lib/auth/guards";
import { isOrderingEnabled } from "@/lib/feature-flags";

export const metadata = {
  title: "Admin Settings | Kobby's Kitchen",
  description: "Kobby's Kitchen business hours and operational settings.",
};

export default async function AdminSettingsPage() {
  await requireAdmin("/admin/settings");

  let settings = null;
  let businessHours = null;

  try {
    [settings, businessHours] = await Promise.all([
      getAdminOrderingSettings(),
      getAdminBusinessHours(),
    ]);
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
        description="Manage normal restaurant business hours separately from online ordering operations."
      />

      <ContentSection
        title="Business Hours"
        description="When the restaurant is physically open. These hours appear on the public site and form a hard safety boundary for online checkout."
        className="admin-section"
      >
        {businessHours ? (
          <AdminBusinessHoursManager initialSchedule={businessHours.schedule} />
        ) : (
          <div className="admin-notice admin-notice--warning" role="alert">
            <strong>Business hours are unavailable.</strong>
            <p>No changes can be saved until the current schedule loads.</p>
          </div>
        )}
      </ContentSection>

      <ContentSection title="Online Ordering" description="When customers may submit orders through the website. Manage the weekly online schedule and overrides from Operations." className="admin-section">
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
          <p>Online ordering hours and temporary controls are managed under Operations.</p>
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
