import ButtonLink from "@/components/ui/ButtonLink";
import ContentSection from "@/components/ui/ContentSection";
import MealCard from "@/components/ui/MealCard";
import PageIntro from "@/components/ui/PageIntro";
import { businessData } from "@/data/businessData";
import { menuItems } from "@/data/menuData";

export const metadata = {
  title: "Menu",
  description:
    "Browse the meals available from Kobby’s Kitchen in Tema Community Two and confirm current availability before ordering.",
};

export default function MenuPage() {
  const { phone, whatsapp } = businessData;

  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow="Menu"
          title="Explore Our Menu"
          description="Browse the meals available from Kobby’s Kitchen and contact us to confirm current availability."
        />

        <ContentSection
          title="Menu"
          description="A selection of meals currently available from Kobby’s Kitchen."
        >
          <div className="meal-grid">
            {menuItems.map((item) => (
              <MealCard key={item.id} item={item} />
            ))}
          </div>

          <div className="note-stack">
            <p>
              Menu items, prices and availability may change. Contact Kobby’s
              Kitchen to confirm before ordering.
            </p>
            <p>Images are for illustration purposes.</p>
          </div>
        </ContentSection>

        <ContentSection
          title="Event Orders"
          description="Kobby’s Kitchen also accepts food orders for events and special occasions."
        >
          <p>
            Contact Kobby’s Kitchen to discuss large-quantity meal orders and
            current availability.
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
            <ButtonLink
              ariaLabel={`Call Kobby’s Kitchen on ${phone.display}`}
              href={phone.href}
              variant="secondary"
            >
              Call Kobby’s Kitchen
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
