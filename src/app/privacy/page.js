import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { businessData } from "@/data/businessData";

export const metadata = {
  title: "Privacy | Kobby’s Kitchen",
  description:
    "Read the privacy notice for Kobby’s Kitchen review and suggestion forms.",
};

export default function PrivacyPage() {
  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow="Privacy"
          title="Privacy"
          description="Kobby’s Kitchen values your privacy."
        />

        <ContentSection
          title="Reviews and Feedback"
          description="Kobby’s Kitchen collects only the information needed to review customer feedback and respond when contact details are shared voluntarily."
        >
          <div className="note-stack">
            <p>
              Reviews submitted through this website are checked before they are
              published. Only approved reviews appear publicly.
            </p>
            <p>
              Optional contact information stays private and is not shown in
              public review listings.
            </p>
            <p>
              Reviews may be rejected when they appear to be spam, abusive or
              otherwise unsuitable for publication.
            </p>
          </div>
        </ContentSection>

        <ContentSection
          title="Personal Information"
          description="Please avoid sharing sensitive personal information in open message fields."
        >
          <div className="note-stack">
            <p>
              Kobby’s Kitchen does not claim to sell customer information. Only
              necessary information is collected through the website.
            </p>
            <p>
              If you choose to include contact details in a review, they are
              kept private for moderation or follow-up only.
            </p>
          </div>
        </ContentSection>

        <ContentSection
          title="Suggestions"
          description="Private online suggestions are currently unavailable until email delivery is configured safely."
        >
          <div className="note-stack">
            <p>
              You can still contact Kobby’s Kitchen through WhatsApp or phone
              while the private online suggestions feature remains offline.
            </p>
            <p>{businessData.location.full}</p>
          </div>
        </ContentSection>
      </div>
    </main>
  );
}
