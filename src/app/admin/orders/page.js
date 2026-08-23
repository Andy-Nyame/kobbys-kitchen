import ButtonLink from "@/components/ui/ButtonLink";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";

export const metadata = {
  title: "Admin Orders | Kobby's Kitchen",
  description: "Kobby's Kitchen admin order management.",
};

export default function AdminOrdersPage() {
  return (
    <>
      <PageIntro
        eyebrow="Admin"
        title="Orders"
        description="Order management will appear when V2 ordering is enabled."
      />

      <ContentSection
        title="Order Queue"
        description="No live order mutations are available yet."
      >
        <p>
          Online ordering is currently disabled. Order status controls will be
          available in a future milestone.
        </p>
        <div className="section-actions">
          <ButtonLink href="/admin" variant="secondary">
            Back to Dashboard
          </ButtonLink>
        </div>
      </ContentSection>
    </>
  );
}
