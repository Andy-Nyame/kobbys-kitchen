import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, getUserProfile } from "@/lib/auth/guards";
import Link from "next/link";
import ButtonLink from "@/components/ui/ButtonLink";

export const metadata = {
  title: "Account | Kobby's Kitchen",
  description: "Manage your Kobby's Kitchen account.",
};

export default async function AccountPage() {
  const user = await getAuthenticatedUser();
  const profile = user ? await getUserProfile(user.id) : null;

  if (!user || !profile) {
    return (
      <main className="page">
        <div className="container content-stack">
          <p>Please sign in to view your account.</p>
          <div className="section-actions">
            <ButtonLink href="/login" variant="primary">
              Sign In
            </ButtonLink>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container content-stack">
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

        <ContentSection
          title="Orders"
          description="View your order history."
        >
          <p>No orders yet. Online ordering will be available soon.</p>
          <div className="section-actions">
            <ButtonLink href="/account/orders" variant="secondary">
              View Orders
            </ButtonLink>
          </div>
        </ContentSection>
      </div>
    </main>
  );
}

function PageIntro({ eyebrow, title, description }) {
  return (
    <header className="page-intro">
      {eyebrow ? <p className="page-intro__eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function ContentSection({ title, description, children }) {
  return (
    <section className="content-section">
      <div className="content-section__header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children ? <div className="content-section__body">{children}</div> : null}
    </section>
  );
}
