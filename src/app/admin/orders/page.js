import { requireAdmin } from "@/lib/auth/guards";
import ButtonLink from "@/components/ui/ButtonLink";

export const metadata = {
  title: "Admin Orders | Kobby's Kitchen",
  description: "Kobby's Kitchen admin order management.",
};

export default async function AdminOrdersPage() {
  await requireAdmin();

  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow="Admin"
          title="Orders"
          description="Order management will appear when V2 ordering is enabled."
        />

        <ContentSection
          title="Order Queue"
          description="No live order mutations are available yet."
        >
          <p>Online ordering is currently disabled. Order status controls will be available in a future milestone.</p>
          <div className="section-actions">
            <ButtonLink href="/admin" variant="secondary">
              Back to Dashboard
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
