import { redirect } from "next/navigation";

import ProfileForm from "@/components/account/ProfileForm";
import PageIntro from "@/components/ui/PageIntro";
import { getUserProfile, requireCustomer } from "@/lib/auth/guards";

export const metadata = {
  title: "Profile | Kobby's Kitchen",
  description: "Review and update your Kobby's Kitchen customer profile.",
};

export default async function ProfilePage() {
  const user = await requireCustomer("/account/profile");
  const profile = await getUserProfile(user.id);

  if (!profile) {
    redirect("/account");
  }

  return (
    <>
      <PageIntro
        eyebrow="Account"
        title="Profile"
        description="Keep your pickup contact details accurate and review your account identity."
      />

      <div className="profile-page-grid">
        <section className="profile-card" aria-labelledby="profile-contact-title">
          <header className="profile-card__header">
            <p className="profile-card__eyebrow">Editable information</p>
            <h2 id="profile-contact-title">Contact details</h2>
            <p>These details will be used for future pickup orders.</p>
          </header>
          <ProfileForm
            initialProfile={{
              displayName: profile.display_name,
              phone: profile.phone || "",
            }}
          />
        </section>

        <aside
          className="profile-card profile-identity-card"
          aria-labelledby="profile-identity-title"
        >
          <header className="profile-card__header">
            <p className="profile-card__eyebrow">Read-only information</p>
            <h2 id="profile-identity-title">Account identity</h2>
            <p>Authentication and authorization details cannot be changed here.</p>
          </header>
          <dl className="profile-identity-list">
            <div>
              <dt>Email address</dt>
              <dd>{user.email || "Email unavailable"}</dd>
              <p>Email changes are not supported from this page yet.</p>
            </div>
            <div>
              <dt>Account type</dt>
              <dd>
                <span className="profile-role-badge">Customer</span>
              </dd>
              <p>Your account type is managed securely and cannot be edited.</p>
            </div>
          </dl>
        </aside>
      </div>
    </>
  );
}
