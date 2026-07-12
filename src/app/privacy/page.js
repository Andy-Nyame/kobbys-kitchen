import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";

export const metadata = {
  title: "Privacy",
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
          title="Feedback Forms"
          description="If you use the review or private suggestion forms, please share only the information you are comfortable providing."
        />

        <ContentSection
          title="Personal Information"
          description="Avoid including sensitive personal information in open message fields."
        />
      </div>
    </main>
  );
}
