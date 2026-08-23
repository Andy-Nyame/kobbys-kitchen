import { redirect } from "next/navigation";

import ProfileForm from "@/components/account/ProfileForm";
import PageIntro from "@/components/ui/PageIntro";
import { getUserProfile, requireCustomer } from "@/lib/auth/guards";

export const metadata = {
  title: "Edit Profile | Kobby's Kitchen",
  description: "Update your Kobby's Kitchen profile.",
};

export default async function ProfilePage() {
  const user = await requireCustomer();
  const profile = await getUserProfile(user.id);

  if (!profile) {
    redirect("/account");
  }

  return (
    <>
      <PageIntro
        eyebrow="Account"
        title="Edit Profile"
        description="Update your display name and phone number."
      />
      <ProfileForm initialProfile={profile} />
    </>
  );
}
