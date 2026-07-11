import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { privacyPageContent } from "@/data/siteContent";

export default function PrivacyPage() {
  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow={privacyPageContent.eyebrow}
          title={privacyPageContent.title}
          description={privacyPageContent.description}
        />

        {privacyPageContent.sections.map((section) => (
          <ContentSection
            key={section.title}
            title={section.title}
            description={section.description}
          />
        ))}
      </div>
    </main>
  );
}
