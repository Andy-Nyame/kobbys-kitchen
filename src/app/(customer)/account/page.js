import { redirect } from "next/navigation";

import ButtonLink from "@/components/ui/ButtonLink";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { ensureCustomerProfile, requireCustomer } from "@/lib/auth/guards";

export const metadata = {
  title: "Account | Kobby's Kitchen",
  description: "Manage your Kobby's Kitchen account.",
};

export default async function AccountPage() {
  const user = await requireCustomer("/account");
  const profile = await ensureCustomerProfile(user);

  if (!profile) {
    redirect("/");
  }

  return (
    <>
      <PageIntro
        eyebrow="Account"
        title="My Account"
        description={`Welcome back, ${profile.display_name}. Manage your pickup details and customer activity here.`}
      />

      <div className="account-overview-grid">
        <ContentSection
          className="account-overview-card"
          title="Your Profile"
          description="The contact details Kobby’s Kitchen will use for future pickup orders."
        >
          <dl className="account-summary-list">
            <div>
              <dt>Display name</dt>
              <dd>{profile.display_name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email || "Email unavailable"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{profile.phone || "Not added yet"}</dd>
            </div>
            <div>
              <dt>Account type</dt>
              <dd><span className="profile-role-badge">Customer</span></dd>
            </div>
          </dl>
          <div className="section-actions">
            <ButtonLink href="/account/profile" variant="secondary">
              Edit Profile
            </ButtonLink>
          </div>
        </ContentSection>

        <ContentSection
          className="account-overview-card"
          title="My Orders"
          description="Your order history and future pickup status will live here."
        >
          <div className="account-ordering-state">
            <span className="account-ordering-state__label">Online ordering</span>
            <strong>Coming Soon</strong>
            <p>
              WhatsApp ordering remains available while online pickup ordering is being prepared.
            </p>
          </div>
          <div className="section-actions">
            <ButtonLink href="/account/orders" variant="secondary">
              Open My Orders
            </ButtonLink>
            <ButtonLink href="/order" variant="primary">
              Order Now
            </ButtonLink>
          </div>
        </ContentSection>
      </div>
    </>
  );
}
