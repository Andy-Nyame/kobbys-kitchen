import ButtonLink from "@/components/ui/ButtonLink";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { businessData } from "@/data/businessData";

export const metadata = {
  title: "Private Suggestions | Kobby's Kitchen",
  description:
    "Find out how to share private feedback with Kobby's Kitchen while online suggestions are temporarily unavailable.",
};

export default function SuggestionsPage() {
  const { phone, whatsapp } = businessData;

  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow="Suggestions"
          title="Private Suggestions"
          description="Private online suggestions are temporarily unavailable. You can still contact Kobby's Kitchen directly through WhatsApp or phone."
        />

        <ContentSection
          title="Suggestions Are Temporarily Unavailable"
          description="Private online suggestions are temporarily unavailable. You can contact Kobby's Kitchen through WhatsApp or phone."
        >
          <div className="note-stack">
            <p>
              Online private suggestions will return after email delivery is
              configured safely for Kobby&apos;s Kitchen.
            </p>
            <p>
              Until then, please use WhatsApp or phone if you would like to
              share a private message.
            </p>
          </div>

          <div className="section-actions">
            <ButtonLink
              ariaLabel={`WhatsApp Kobby's Kitchen on ${whatsapp.display}`}
              href={whatsapp.href}
              rel="noopener noreferrer"
              target="_blank"
              variant="primary"
            >
              WhatsApp Kobby&apos;s Kitchen
            </ButtonLink>
            <ButtonLink
              ariaLabel={`Call Kobby's Kitchen on ${phone.display}`}
              href={phone.href}
              variant="secondary"
            >
              Call Kobby&apos;s Kitchen
            </ButtonLink>
          </div>
        </ContentSection>

        <ContentSection
          title="Privacy"
          description="Please read the privacy page before sending feedback through another contact method."
        >
          <div className="section-actions">
            <ButtonLink href="/privacy" variant="secondary">
              Read Privacy
            </ButtonLink>
          </div>
        </ContentSection>
      </div>
    </main>
  );
}
