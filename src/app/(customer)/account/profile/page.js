import { redirect } from "next/navigation";

import CustomerAvatar from "@/components/navigation/CustomerAvatar";
import ProfileForm from "@/components/account/ProfileForm";
import PageIntro from "@/components/ui/PageIntro";
import { getCustomerAvatar } from "@/lib/auth/customer-avatar";
import { ensureCustomerProfile, requireCustomer } from "@/lib/auth/guards";

export const metadata = {
  title: "Profile | Kobby's Kitchen",
  description: "Review and update your Kobby's Kitchen customer profile.",
};

export default async function ProfilePage() {
  const user = await requireCustomer("/account/profile");
  const profile = await ensureCustomerProfile(user);

  if (!profile) {
    redirect("/account");
  }

  const avatar = getCustomerAvatar(user, profile);

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
            <div className="profile-card__customer">
              <CustomerAvatar
                avatar={avatar}
                className="customer-avatar--profile"
              />
              <div>
                <p className="profile-card__eyebrow">Your customer profile</p>
                <h2 id="profile-contact-title">{profile.display_name}</h2>
                <p>Keep your pickup contact details up to date.</p>
              </div>
            </div>
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
