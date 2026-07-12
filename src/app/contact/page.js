import ButtonLink from "@/components/ui/ButtonLink";
import ContentSection from "@/components/ui/ContentSection";
import InlineIcon from "@/components/ui/InlineIcon";
import PageIntro from "@/components/ui/PageIntro";
import { businessData } from "@/data/businessData";

export default function ContactPage() {
  const directionsLink = businessData.googleMapsLink;
  const { phone, whatsapp, email, socialLinks } = businessData;

  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow="Contact"
          title="Contact Kobby’s Kitchen"
          description="Get in touch with Kobby’s Kitchen for takeaway enquiries, event orders and general questions."
        />

        <ContentSection
          title="Call or WhatsApp"
          description="Reach Kobby’s Kitchen directly for orders, questions and event enquiries."
        >
          <div className="contact-methods">
            <div className="contact-methods__item">
              <h3>Phone</h3>
              <a className="inline-link" href={phone.href}>
                <span className="icon-link">
                  <InlineIcon name="phone" />
                  <span>{phone.display}</span>
                </span>
              </a>
            </div>
            <div className="contact-methods__item">
              <h3>WhatsApp</h3>
              <a
                className="inline-link"
                href={whatsapp.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span className="icon-link">
                  <InlineIcon name="whatsapp" />
                  <span>{whatsapp.display}</span>
                </span>
              </a>
            </div>
            <div className="contact-methods__item">
              <h3>Email</h3>
              <a
                aria-label={`Email Kobby’s Kitchen at ${email.display}`}
                className="inline-link"
                href={email.href}
              >
                <span className="icon-link">
                  <InlineIcon name="email" />
                  <span>{email.display}</span>
                </span>
              </a>
            </div>
            {socialLinks.tiktok ? (
              <div className="contact-methods__item">
                <h3>TikTok</h3>
                <a
                  aria-label="Visit Kobby’s Kitchen on TikTok"
                  className="inline-link"
                  href={socialLinks.tiktok}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span className="icon-link">
                    <InlineIcon name="tiktok" />
                    <span>TikTok</span>
                  </span>
                </a>
              </div>
            ) : null}
          </div>

          <div className="section-actions">
            <ButtonLink
              ariaLabel={`Call Kobby’s Kitchen on ${phone.display}`}
              href={phone.href}
              variant="secondary"
            >
              Call Kobby’s Kitchen
            </ButtonLink>
            <ButtonLink
              ariaLabel={`WhatsApp Kobby’s Kitchen on ${whatsapp.display}`}
              href={whatsapp.href}
              rel="noopener noreferrer"
              target="_blank"
              variant="primary"
            >
              Order on WhatsApp
            </ButtonLink>
          </div>
        </ContentSection>

        <ContentSection
          title="Find Us"
          description="Visit Kobby’s Kitchen in Tema Community Two."
        >
          <div className="location-card">
            <p>{businessData.location.full}</p>
            {directionsLink ? (
              <div className="section-actions">
                <ButtonLink href={directionsLink} variant="secondary">
                  Get Directions
                </ButtonLink>
              </div>
            ) : null}
          </div>
        </ContentSection>

        <ContentSection
          title="Opening Hours"
          description="Visit Kobby’s Kitchen during the following times."
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

        <ContentSection
          title="Event-Order Enquiries"
          description="Contact Kobby’s Kitchen to discuss food orders for events and special occasions."
        >
          <p>
            Visit the Menu page to see the current meal selection, then get in
            touch for large-quantity orders and availability questions.
          </p>
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
            <ButtonLink href="/menu" variant="secondary">
              View Menu
            </ButtonLink>
          </div>
        </ContentSection>
      </div>
    </main>
  );
}
