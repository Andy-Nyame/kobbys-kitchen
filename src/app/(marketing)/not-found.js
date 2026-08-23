import ButtonLink from "@/components/ui/ButtonLink";
import PageIntro from "@/components/ui/PageIntro";

export default function NotFoundPage() {
  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow="Not Found"
          title="Page Not Found"
          description="The page you are looking for could not be found."
        />

        <section className="content-section">
          <div className="content-section__body">
            <p className="review-status">
              The page may have moved, or the link may be incorrect.
            </p>
            <div className="section-actions">
              <ButtonLink href="/" variant="primary">
                Go Home
              </ButtonLink>
              <ButtonLink href="/menu" variant="secondary">
                View Menu
              </ButtonLink>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
