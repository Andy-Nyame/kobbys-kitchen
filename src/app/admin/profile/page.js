import ProfileForm from "@/components/account/ProfileForm";
import CustomerAvatar from "@/components/navigation/CustomerAvatar";
import PageIntro from "@/components/ui/PageIntro";
import { getAdminPresentation } from "@/lib/admin/profile";
import { getUserProfile, requireAdmin } from "@/lib/auth/guards";

export const metadata = {
  title: "Admin Profile | Kobby's Kitchen",
  description: "Manage the administrator profile shown in the workspace.",
};

export default async function AdminProfilePage() {
  const user = await requireAdmin("/admin/profile");
  const profile = await getUserProfile(user.id);
  const presentation = getAdminPresentation(user, profile);

  return (
    <>
      <PageIntro
        eyebrow="Administration"
        title="Profile"
        description="Manage the personal details shown in your secure administration workspace."
      />
      <div className="profile-page-grid">
        <section className="profile-card" aria-labelledby="admin-profile-title">
          <header className="profile-card__header">
            <div className="profile-card__customer">
              <CustomerAvatar avatar={presentation.avatar} className="customer-avatar--profile" />
              <div>
                <p className="profile-card__eyebrow">Administrator profile</p>
                <h2 id="admin-profile-title">{presentation.displayName}</h2>
                <p>Update your workspace display name and contact number.</p>
              </div>
            </div>
          </header>
          <ProfileForm
            accountContext="admin"
            endpoint="/api/admin/profile"
            initialProfile={{
              displayName: profile?.display_name || presentation.displayName,
              phone: profile?.phone || "",
            }}
          />
        </section>
        <aside className="profile-card profile-identity-card" aria-labelledby="admin-identity-title">
          <header className="profile-card__header">
            <p className="profile-card__eyebrow">Read-only information</p>
            <h2 id="admin-identity-title">Account identity</h2>
          </header>
          <dl className="profile-identity-list">
            <div><dt>Email address</dt><dd>{presentation.email}</dd></div>
            <div><dt>Account type</dt><dd><span className="profile-role-badge">Admin</span></dd></div>
          </dl>
        </aside>
      </div>
    </>
  );
}
