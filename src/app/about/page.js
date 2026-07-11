import Image from "next/image";
import Link from "next/link";

import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { aboutGalleryItems, aboutPageContent } from "@/data/siteContent";

export default function AboutPage() {
  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow={aboutPageContent.eyebrow}
          title={aboutPageContent.title}
          description={aboutPageContent.description}
        />

        <ContentSection
          title={aboutPageContent.chefStory.title}
          description={aboutPageContent.chefStory.description}
        >
          <div className="card-grid">
            {aboutPageContent.chefStory.cards.map((card) => (
              <article key={card.title} className="card">
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </article>
            ))}
          </div>
        </ContentSection>

        <ContentSection
          title={aboutPageContent.gallery.title}
          description={aboutPageContent.gallery.description}
        >
          <div className="media-grid">
            {aboutGalleryItems.map((item) => (
              <article key={item.title} className="media-card">
                {item.image ? (
                  <Image
                    className="media-card__image"
                    src={item.image.src}
                    alt={item.image.alt}
                    width={item.image.width}
                    height={item.image.height}
                  />
                ) : (
                  <div className="media-card__placeholder">
                    <span>{item.title}</span>
                  </div>
                )}

                <div className="media-card__body">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </ContentSection>

        <ContentSection
          title={aboutPageContent.eventOrders.title}
          description={aboutPageContent.eventOrders.description}
        >
          <div className="section-actions">
            <Link className="inline-link" href="/menu">
              View the Menu route
            </Link>
            <Link className="inline-link" href="/contact">
              Continue to Contact
            </Link>
          </div>
        </ContentSection>
      </div>
    </main>
  );
}
