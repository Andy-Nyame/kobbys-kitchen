import { redirect } from "next/navigation";

import ButtonLink from "@/components/ui/ButtonLink";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { getUserProfile, requireCustomer } from "@/lib/auth/guards";

export const metadata = {
  title: "Account | Kobby's Kitchen",
  description: "Manage your Kobby's Kitchen account.",
};

export default async function AccountPage() {
  const user = await requireCustomer();
  const profile = await getUserProfile(user.id);

  if (!profile) {
    redirect("/");
  }

  return (
    <>
      <PageIntro
        eyebrow="Account"
        title="My Account"
        description={`Welcome, ${profile.display_name}.`}
      />

      <ContentSection
        title="Profile"
        description="View and update your profile information."
      >
        <p>
          <strong>Display Name:</strong> {profile.display_name}
        </p>
        <p>
          <strong>Phone:</strong> {profile.phone}
        </p>
        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <div className="section-actions">
          <ButtonLink href="/account/profile" variant="secondary">
            Edit Profile
          </ButtonLink>
        </div>
      </ContentSection>

      <ContentSection title="Orders" description="View your order history.">
        <p>No orders yet. Online ordering will be available soon.</p>
        <div className="section-actions">
          <ButtonLink href="/account/orders" variant="secondary">
            View Orders
          </ButtonLink>
        </div>
      </ContentSection>
    </>
  );
}
