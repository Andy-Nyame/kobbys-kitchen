import { requireAdmin } from "@/lib/auth/guards";
import ButtonLink from "@/components/ui/ButtonLink";

export const metadata = {
  title: "Admin Dashboard | Kobby's Kitchen",
  description: "Kobby's Kitchen admin dashboard.",
};

export default async function AdminDashboardPage() {
  await requireAdmin();

  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow="Admin"
          title="Dashboard"
          description="Welcome to the Kobby's Kitchen admin area."
        />

        <ContentSection
          title="Order Management"
          description="Order management features will appear when V2 ordering is enabled."
        >
          <p>Online ordering is currently disabled. No live order mutations are available yet.</p>
          <div className="section-actions">
            <ButtonLink href="/admin/orders" variant="secondary">
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
