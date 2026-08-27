import ButtonLink from "@/components/ui/ButtonLink";
import MenuCatalogue from "@/components/cart/MenuCatalogue";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { businessData } from "@/data/businessData";
import { getPublicMenuCatalogue } from "@/lib/menu/catalogue";

export const metadata = {
  title: "Menu | Kobby's Kitchen",
  description:
    "Browse the meals available from Kobby's Kitchen in Tema Community Two and confirm current availability before ordering.",
};

export default async function MenuPage() {
  const { phone, whatsapp } = businessData;
  const catalogue = await getPublicMenuCatalogue();

  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow="Menu"
          title="Explore Our Menu"
          description="Browse the meals available from Kobby's Kitchen and contact us to confirm current availability."
        />

        <ContentSection
          title="Menu"
          description="Browse current meals, add them to a cart preview, or confirm your order directly on WhatsApp."
        >
          {!catalogue.ok ? (
            <div className="catalogue-unavailable" role="status">
              <h2>The menu is temporarily unavailable.</h2>
              <p>Please use WhatsApp to confirm today&apos;s menu and availability.</p>
            </div>
          ) : catalogue.items.length === 0 ? (
            <div className="catalogue-unavailable" role="status">
              <h2>No menu items are listed yet.</h2>
              <p>Please use WhatsApp to confirm today&apos;s menu and availability.</p>
            </div>
          ) : (
            <MenuCatalogue categories={catalogue.categories} items={catalogue.items} />
          )}

          <div className="note-stack">
            <p>
              Build a cart to explore the upcoming pickup experience. Online
              checkout is not active, so no order is submitted from this page.
            </p>
            <p>Images are for illustration purposes.</p>
          </div>
        </ContentSection>

        <ContentSection
          title="Event Orders"
          description="Kobby's Kitchen also accepts food orders for events and special occasions."
        >
          <p>
            Contact Kobby&apos;s Kitchen to discuss large-quantity meal orders and
            current availability.
          </p>

          <div className="section-actions">
            <ButtonLink
              ariaLabel={`WhatsApp Kobby's Kitchen on ${whatsapp.display}`}
              href={whatsapp.href}
              rel="noopener noreferrer"
              target="_blank"
              variant="primary"
            >
              Order on WhatsApp
            </ButtonLink>
            <ButtonLink
              ariaLabel={`Call Kobby's Kitchen on ${phone.display}`}
              href={phone.href}
              variant="secondary"
            >
              Call Kobby&apos;s Kitchen
            </ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Contact Page
            </ButtonLink>
          </div>
        </ContentSection>
      </div>
    </main>
  );
}
