import CartPageContent from "@/components/cart/CartPageContent";
import PageIntro from "@/components/ui/PageIntro";
import OrderingStatusNotice from "@/components/ordering/OrderingStatusNotice";
import { getPublicMenuCatalogue } from "@/lib/menu/catalogue";
import { getPublicOrderingStatus } from "@/lib/ordering/server";

export const metadata = {
  title: "Cart | Kobby's Kitchen",
  description: "Review the meals you have added while online checkout is being prepared.",
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [catalogue, orderingStatus] = await Promise.all([
    getPublicMenuCatalogue(),
    getPublicOrderingStatus(),
  ]);

  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow="Cart"
          title="Your pickup cart"
          description="Build your order at your own pace. Online checkout is not active yet, so nothing is submitted from this cart."
        />
        <OrderingStatusNotice context="cart" status={orderingStatus} />
        {!orderingStatus.isOpen ? (
          <p className="cart-ordering-note">
            Your cart remains saved on this device while ordering is closed.
          </p>
        ) : null}
        {catalogue.ok ? (
          <CartPageContent catalogueItems={catalogue.items} />
        ) : (
          <section className="cart-empty-state" role="status">
            <h2>Your cart is saved locally.</h2>
            <p>The current menu could not be loaded, so totals cannot be shown right now.</p>
          </section>
        )}
      </div>
    </main>
  );
}
