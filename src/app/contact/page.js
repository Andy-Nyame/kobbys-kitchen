import Link from "next/link";

import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { contactPageContent } from "@/data/siteContent";

export default function ContactPage() {
  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow={contactPageContent.eyebrow}
          title={contactPageContent.title}
          description={contactPageContent.description}
        />

        <ContentSection
          title="Contact Structure"
          description="This page keeps contact-related information focused and free from extra navigation branches."
        >
          <div className="card-grid">
            {contactPageContent.sections.map((section) => (
              <article key={section.title} className="card">
                <h3>{section.title}</h3>
                <p>{section.description}</p>
              </article>
            ))}
          </div>

          <div className="section-actions">
            <Link className="inline-link" href="/menu">
              Review the Menu page
            </Link>
            <Link className="inline-link" href="/about">
              Read the About page story
            </Link>
          </div>
        </ContentSection>
      </div>
    </main>
  );
}
