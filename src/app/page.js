import Image from "next/image";

import GalleryPreview from "@/components/home/GalleryPreview";
import ButtonLink from "@/components/ui/ButtonLink";
import ContentSection from "@/components/ui/ContentSection";
import ImagePlaceholder from "@/components/ui/ImagePlaceholder";
import MealCard from "@/components/ui/MealCard";
import { businessData } from "@/data/businessData";
import { menuItems } from "@/data/menuData";

export default function Home() {
  const featuredMeals = menuItems.filter((item) => item.featured);
  const phoneLink = businessData.phone.href;
  const whatsappLink = businessData.whatsapp.href;
  const directionsLink = businessData.googleMapsLink;

  return (
    <main className="page">
      <div className="container content-stack">
        <section className="hero">
          <div className="hero__grid">
            <div className="hero__content">
              <p className="hero__eyebrow">Welcome to Kobby’s Kitchen</p>
              <h1>{businessData.tagline}</h1>
              <p className="hero__description">{businessData.heroDescription}</p>

              <div className="button-row">
                <ButtonLink href="/menu" variant="primary">
                  View Menu
                </ButtonLink>
                <ButtonLink
                  ariaLabel="Order on WhatsApp"
                  href={whatsappLink}
                  rel="noopener noreferrer"
                  target="_blank"
                  variant="secondary"
                >
                  Order on WhatsApp
                </ButtonLink>
                <ButtonLink href={directionsLink} variant="secondary">
                  Get Directions
                </ButtonLink>
              </div>

              <div className="hero__location">
                <strong>{businessData.location.area}</strong>
                <span>{businessData.location.landmark}</span>
              </div>
            </div>

            <div className="hero__visual">
              <div className="hero__visual-card">
                <ImagePlaceholder
                  className="hero__visual-placeholder"
                  label="Fresh meals and takeaway"
                />
                <div className="hero__visual-caption">
                  <span>Fast-food</span>
                  <span>Takeaway</span>
                  <span>Event orders</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <ContentSection
          title="Featured Meals"
          description="A few popular choices from Kobby’s Kitchen."
        >
          <div className="meal-grid">
            {featuredMeals.map((item) => (
              <MealCard key={item.id} item={item} showPopular />
            ))}
          </div>

          <div className="section-actions">
            <ButtonLink href="/menu" variant="secondary">
              View Full Menu
            </ButtonLink>
          </div>
        </ContentSection>

        <ContentSection
          title="About Kobby’s Kitchen"
          description={businessData.shortDescription}
        >
          <div className="section-actions">
            <ButtonLink href="/about" variant="secondary">
              Learn More About Us
            </ButtonLink>
          </div>
        </ContentSection>

        <ContentSection
          title="Our Services"
          description="Kobby’s Kitchen offers easy options for fast-food meals, takeaway orders and special occasions."
        >
          <div className="card-grid">
            {businessData.services.map((service) => (
              <article key={service} className="card">
                <h3>{service}</h3>
              </article>
            ))}
          </div>
        </ContentSection>

        <ContentSection
          title="Why Choose Kobby’s Kitchen"
          description="A few reasons customers choose Kobby’s Kitchen."
        >
          <ul className="feature-list">
            {businessData.whyChooseUs.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </ContentSection>

        <ContentSection
          title="Meet the Chef"
          description={businessData.chefPreviewIntroduction}
        >
          <div className="split-panel">
            <div className="split-panel__media">
              <Image
                className="portrait-image"
                src="/images/people/felix-chef.jpg"
                alt="Felix Papa Kwasi Cudjoe in chef uniform"
                width={1254}
                height={1254}
              />
            </div>
            <div className="split-panel__content">
              <p className="kicker">{businessData.ownerTitle}</p>
              <h3>{businessData.owner}</h3>
              <p className="supporting-copy">{businessData.experience}</p>
              <ButtonLink href="/about" variant="secondary">
                Meet the Chef
              </ButtonLink>
            </div>
          </div>
        </ContentSection>

        <ContentSection
          title="Opening Hours"
          description="Visit Kobby’s Kitchen during our evening and late-night opening hours."
        >
          <ul className="hours-list">
            {businessData.openingHours.map((entry) => (
              <li key={entry.day} className="hours-list__item">
                <span>{entry.day}</span>
                <strong className={entry.closed ? "hours-list__closed" : ""}>
                  {entry.hours}
                </strong>
              </li>
            ))}
          </ul>
        </ContentSection>

        <GalleryPreview
          title="Gallery"
          description="A quick look at the Kobby’s Kitchen experience."
          emptyState="More photos from Kobby’s Kitchen will be added soon."
          items={businessData.galleryLabels.map((label) => ({ title: label }))}
        />

        <ContentSection
          title="Find Us"
          description="Visit Kobby’s Kitchen in Tema Community Two."
        >
          <div className="location-card">
            <p>{businessData.location.full}</p>
            <div className="section-actions">
              <ButtonLink href={directionsLink} variant="secondary">
                Get Directions
              </ButtonLink>
            </div>
          </div>
        </ContentSection>

        <ContentSection title="Reviews" description={businessData.reviewEmptyState}>
          <div className="section-actions">
            <ButtonLink href="/reviews" variant="primary">
              Share Your Experience
            </ButtonLink>
            <ButtonLink href="/reviews" variant="secondary">
              Read Reviews
            </ButtonLink>
          </div>
        </ContentSection>

        <section className="cta-panel">
          <div className="cta-panel__content">
            <h2>{businessData.finalCta}</h2>
            <div className="button-row">
              <ButtonLink
                ariaLabel={`Call Kobby’s Kitchen on ${businessData.phone.display}`}
                href={phoneLink}
                variant="secondary"
              >
                Call Kobby’s Kitchen
              </ButtonLink>
              <ButtonLink
                ariaLabel={`WhatsApp Kobby’s Kitchen on ${businessData.whatsapp.display}`}
                href={whatsappLink}
                rel="noopener noreferrer"
                target="_blank"
                variant="primary"
              >
                WhatsApp
              </ButtonLink>
              <ButtonLink href={directionsLink} variant="secondary">
                Directions
              </ButtonLink>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
