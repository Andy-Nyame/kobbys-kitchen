import ButtonLink from "@/components/ui/ButtonLink";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";

export const metadata = {
  title: "Admin Dashboard | Kobby's Kitchen",
  description: "Kobby's Kitchen admin dashboard.",
};

export default function AdminDashboardPage() {
  return (
    <>
      <PageIntro
        eyebrow="Admin"
        title="Dashboard"
        description="Welcome to the Kobby's Kitchen admin area."
      />

      <ContentSection
        title="Order Management"
        description="Order management features will appear when V2 ordering is enabled."
      >
        <p>
          Online ordering is currently disabled. No live order mutations are
          available yet.
        </p>
        <div className="section-actions">
          <ButtonLink href="/admin/orders" variant="secondary">
            View Orders
          </ButtonLink>
        </div>
      </ContentSection>
    </>
  );
}
