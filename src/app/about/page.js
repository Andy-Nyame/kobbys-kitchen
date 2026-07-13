import Image from "next/image";

import ButtonLink from "@/components/ui/ButtonLink";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { businessData } from "@/data/businessData";

export const metadata = {
  title: "About Kobby’s Kitchen",
  description:
    "Learn about Kobby’s Kitchen, our services and Felix Papa Kwasi Cudjoe, the owner and chef.",
};

export default function AboutPage() {
  const { phone, whatsapp } = businessData;

  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow="About"
          title="About Kobby’s Kitchen"
          description={businessData.shortDescription}
        />

        <ContentSection
          title="About Kobby’s Kitchen"
          description={businessData.shortDescription}
        />

        <ContentSection
          title="Our Services"
          description="Kobby’s Kitchen serves everyday meals, takeaway orders and larger food requests for special occasions."
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
          description="Kobby’s Kitchen focuses on satisfying meals, convenient service and an easy-to-find location."
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
            </div>
          </div>
        </ContentSection>

        <ContentSection
          title="Owner Biography"
          description="Get to know the owner and chef behind Kobby’s Kitchen."
        >
          <div className="split-panel split-panel--reverse">
            <div className="split-panel__media">
              <Image
                className="portrait-image portrait-image--tall"
                src="/images/people/felix-graduation.jpg"
                alt="Portrait of Felix Papa Kwasi Cudjoe"
                width={1067}
                height={1475}
              />
            </div>
            <div className="split-panel__content">
              <p>{businessData.chefIntroduction}</p>
            </div>
          </div>
        </ContentSection>

        <ContentSection
          title="Chef Message"
          description={businessData.chefMessage}
        />

        <ContentSection
          title="Contact Kobby’s Kitchen"
          description="Get in touch for takeaway questions, event orders and general enquiries."
        >
          <div className="section-actions">
            <ButtonLink
              ariaLabel={`WhatsApp Kobby’s Kitchen on ${whatsapp.display}`}
              href={whatsapp.href}
              rel="noopener noreferrer"
              target="_blank"
              variant="primary"
            >
              Order on WhatsApp
            </ButtonLink>
            <ButtonLink
              ariaLabel={`Call Kobby’s Kitchen on ${phone.display}`}
              href={phone.href}
              variant="secondary"
            >
              Call Kobby’s Kitchen
            </ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Contact Us
            </ButtonLink>
          </div>
        </ContentSection>
      </div>
    </main>
  );
}
