import Link from "next/link";

import ApprovedReviewsSection from "@/components/reviews/ApprovedReviewsSection";
import FeedbackForm from "@/components/forms/FeedbackForm";
import ButtonLink from "@/components/ui/ButtonLink";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import {
  reviewFormFields,
  reviewRatingField,
  reviewTextareaField,
  reviewConsentField,
  reviewHoneypotField,
  businessData,
} from "@/data/businessData";

export const metadata = {
  title: "Customer Reviews | Kobby’s Kitchen",
  description:
    "Read customer review updates or share your experience with Kobby’s Kitchen.",
};

export default function ReviewsPage() {
  const { phone, whatsapp } = businessData;

  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow="Reviews"
          title="Reviews"
          description="Read approved customer reviews and share your experience with Kobby’s Kitchen."
        />

        <ContentSection title="Customer Reviews">
          <ApprovedReviewsSection emptyMessage={businessData.reviewEmptyState} />
        </ContentSection>

        <ContentSection
          title="Share a Review"
          description="Use the form below to share your experience with Kobby’s Kitchen."
        >
          <FeedbackForm
            buttonLabel="Submit Review"
            fields={reviewFormFields}
            formType="review"
            hintText="Please read our"
            honeypotField={reviewHoneypotField}
            consentField={reviewConsentField}
            loadingMessage="Submitting review..."
            submitButtonLoadingLabel="Submitting review..."
            submitEndpoint="/api/reviews"
            ratingField={reviewRatingField}
            textarea={reviewTextareaField}
          />
        </ContentSection>

        <ContentSection
          title="Contact Kobby’s Kitchen"
          description="For order questions or a direct follow-up, contact Kobby’s Kitchen by phone or WhatsApp."
        >
          <div className="section-actions">
            <ButtonLink
              ariaLabel={`WhatsApp Kobby’s Kitchen on ${whatsapp.display}`}
              href={whatsapp.href}
              rel="noopener noreferrer"
              target="_blank"
              variant="primary"
            >
              WhatsApp Kobby’s Kitchen
            </ButtonLink>
            <ButtonLink
              ariaLabel={`Call Kobby’s Kitchen on ${phone.display}`}
              href={phone.href}
              variant="secondary"
            >
              Call Kobby’s Kitchen
            </ButtonLink>
          </div>
        </ContentSection>

        <ContentSection
          title="Private Feedback"
          description="Prefer to share feedback privately? Send a private suggestion instead."
        >
          <div className="section-actions">
            <Link className="inline-link" href="/suggestions">
              Send a Private Suggestion
            </Link>
          </div>
        </ContentSection>
      </div>
    </main>
  );
}
