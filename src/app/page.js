import Link from "next/link";

import GalleryPreview from "@/components/home/GalleryPreview";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { homePageContent } from "@/data/siteContent";

export default function Home() {
  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow={homePageContent.eyebrow}
          title={homePageContent.title}
          description={homePageContent.description}
        />

        <GalleryPreview
          title={homePageContent.galleryPreview.title}
          description={homePageContent.galleryPreview.description}
          items={homePageContent.galleryPreview.items}
        />

        <ContentSection
          title={homePageContent.quickLinks.title}
          description={homePageContent.quickLinks.description}
        >
          <div className="card-grid">
            {homePageContent.quickLinks.items.map((item) => (
              <article key={item.href} className="card">
                <h3>
                  <Link className="text-link" href={item.href}>
                    {item.title}
                  </Link>
                </h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </ContentSection>
      </div>
    </main>
  );
}
