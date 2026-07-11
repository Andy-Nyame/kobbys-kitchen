import Link from "next/link";

import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { menuPageContent } from "@/data/siteContent";

export default function MenuPage() {
  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow={menuPageContent.eyebrow}
          title={menuPageContent.title}
          description={menuPageContent.description}
        />

        <ContentSection
          title="Menu Planning"
          description="The menu structure can grow here without changing the approved primary navigation."
        >
          <div className="card-grid">
            {menuPageContent.sections.map((section) => (
              <article key={section.title} className="card">
                <h3>{section.title}</h3>
                <p>{section.description}</p>
              </article>
            ))}
          </div>

          <div className="section-actions">
            <Link className="inline-link" href="/contact">
              Ask about event orders
            </Link>
            <Link className="inline-link" href="/about">
              See event-order context on About
            </Link>
          </div>
        </ContentSection>
      </div>
    </main>
  );
}
