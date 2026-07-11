import Link from "next/link";

import FeedbackForm from "@/components/forms/FeedbackForm";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import {
  reviewFormFields,
  reviewsPageContent,
  reviewTextareaField,
} from "@/data/siteContent";

export default function ReviewsPage() {
  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow={reviewsPageContent.eyebrow}
          title={reviewsPageContent.title}
          description={reviewsPageContent.description}
        />

        <ContentSection
          title={reviewsPageContent.sections[0].title}
          description={reviewsPageContent.sections[0].description}
        />

        <ContentSection
          title="Share a Review"
          description="The form layout is ready here, while submission handling will be added later."
        >
          <FeedbackForm
            buttonLabel="Review submissions coming soon"
            fields={reviewFormFields}
            hintPrefix="Before forms go live, review the"
            hintSuffix="page for the approved form guidance."
            textarea={reviewTextareaField}
          />
        </ContentSection>

        <ContentSection
          title={reviewsPageContent.sections[1].title}
          description={reviewsPageContent.sections[1].description}
        >
          <div className="section-actions">
            <Link className="inline-link" href="/suggestions">
              Go to Private Suggestions
            </Link>
          </div>
        </ContentSection>
      </div>
    </main>
  );
}
