import FeedbackForm from "@/components/forms/FeedbackForm";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import {
  suggestionFormFields,
  suggestionsPageContent,
  suggestionTextareaField,
} from "@/data/siteContent";

export default function SuggestionsPage() {
  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow={suggestionsPageContent.eyebrow}
          title={suggestionsPageContent.title}
          description={suggestionsPageContent.description}
        />

        <ContentSection
          title={suggestionsPageContent.sections[0].title}
          description={suggestionsPageContent.sections[0].description}
        >
          <FeedbackForm
            buttonLabel="Suggestion submissions coming soon"
            fields={suggestionFormFields}
            hintPrefix="Before forms go live, read the"
            hintSuffix="page for the approved form guidance."
            textarea={suggestionTextareaField}
          />
        </ContentSection>

        <ContentSection
          title={suggestionsPageContent.sections[1].title}
          description={suggestionsPageContent.sections[1].description}
        />
      </div>
    </main>
  );
}
