import ButtonLink from "@/components/ui/ButtonLink";
import PageIntro from "@/components/ui/PageIntro";
import { businessData } from "@/data/businessData";
import { isOrderingEnabled } from "@/lib/feature-flags";
import { getOrderingHubState } from "@/lib/orders/hub";

export const metadata = {
  title: "Order | Kobby's Kitchen",
  description:
    "Choose how to order from Kobby's Kitchen, including our available WhatsApp ordering service.",
};

export default function OrderPage() {
  const orderingState = getOrderingHubState(isOrderingEnabled());

  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow="Order"
          title="How would you like to order?"
          description="Choose the ordering option that works today, or see what we are preparing for online pickup."
        />

        <div className="order-hub__options">
          <section
            className="order-option-card order-option-card--available"
            aria-labelledby="whatsapp-order-title"
          >
            <span className="order-option-card__status order-option-card__status--available">
              Available now
            </span>
            <div className="order-option-card__content">
              <p className="order-option-card__eyebrow">Direct ordering</p>
              <h2 id="whatsapp-order-title">Order on WhatsApp</h2>
              <p>
                Message Kobby&rsquo;s Kitchen to confirm meal availability and
                arrange your order directly with the team.
              </p>
            </div>
            <div className="section-actions order-option-card__actions">
              <ButtonLink
                ariaLabel={`Order from Kobby's Kitchen on WhatsApp at ${businessData.whatsapp.display}`}
                href={businessData.whatsapp.href}
                rel="noopener noreferrer"
                target="_blank"
                variant="primary"
              >
                Continue to WhatsApp
              </ButtonLink>
              <ButtonLink href="/menu" variant="secondary">
                View Menu
              </ButtonLink>
            </div>
          </section>

          <section
            className="order-option-card"
            aria-labelledby="online-pickup-title"
          >
            <span className="order-option-card__status">Coming soon</span>
            <div className="order-option-card__content">
              <p className="order-option-card__eyebrow">Online pickup preview</p>
              <h2 id="online-pickup-title">Build your cart</h2>
              <p>
                Browse trusted menu prices, add meals to your cart, and explore
                the pickup flow before online checkout becomes available.
              </p>
            </div>
            <p className="order-option-card__notice" role="status">
              {orderingState.onlinePickupReason === "build_disabled"
                ? "You can build a cart, but online checkout and order submission are not enabled for this build."
                : "Online checkout is not available in this milestone."}
            </p>
            <ButtonLink href="/menu" variant="secondary">Browse Menu</ButtonLink>
          </section>
        </div>

        <section className="order-journey" aria-labelledby="order-journey-title">
          <div className="order-journey__header">
            <p className="order-option-card__eyebrow">What we are building</p>
            <h2 id="order-journey-title">A straightforward pickup journey</h2>
            <p>
              The Menu page is the place to browse current meals and build your
              cart. This page will become the transactional starting point when
              online ordering is ready.
            </p>
          </div>
          <ol className="order-journey__steps">
            <li>Choose meals</li>
            <li>Add them to your cart</li>
            <li>Sign in when needed</li>
            <li>Choose Cash, Mobile Money, or Card</li>
            <li>Collect and track your pickup order</li>
          </ol>
        </section>
      </div>
    </main>
  );
}
