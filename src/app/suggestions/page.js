import FeedbackForm from "@/components/forms/FeedbackForm";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import {
  suggestionFormFields,
  suggestionTextareaField,
} from "@/data/businessData";

export const metadata = {
  title: "Suggestions",
  description:
    "Send a private suggestion to Kobby’s Kitchen using the private feedback form.",
};

export default function SuggestionsPage() {
  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow="Suggestions"
          title="Private Suggestions"
          description="Use this page to send private feedback to Kobby’s Kitchen."
        />

        <ContentSection
          title="Share a Private Suggestion"
          description="Share a suggestion, comment or idea using the form below."
        >
          <FeedbackForm
            buttonLabel="Send Suggestion"
            fields={suggestionFormFields}
            hintText="Please read our"
            loadingMessage="Checking your suggestion..."
            unavailableMessage="Suggestion submission is not connected yet. Your message has not been sent."
            textarea={suggestionTextareaField}
          />
        </ContentSection>
      </div>
    </main>
  );
}
