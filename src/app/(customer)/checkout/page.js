import { redirect } from "next/navigation";

import CheckoutForm from "@/components/checkout/CheckoutForm";
import OrderingStatusNotice from "@/components/ordering/OrderingStatusNotice";
import PageIntro from "@/components/ui/PageIntro";
import { ensureCustomerProfile, requireCustomer } from "@/lib/auth/guards";
import { getPublicMenuCatalogue } from "@/lib/menu/catalogue";
import { getPublicOrderingStatus } from "@/lib/ordering/server";

export const metadata = {
  title: "Checkout | Kobby's Kitchen",
  description: "Place a trusted cash-at-pickup order with Kobby's Kitchen.",
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await requireCustomer("/checkout");
  const [profile, catalogue, orderingStatus] = await Promise.all([
    ensureCustomerProfile(user),
    getPublicMenuCatalogue(),
    getPublicOrderingStatus(),
  ]);

  if (!profile) {
    redirect("/account/profile");
  }

  return (
    <>
      <PageIntro
        eyebrow="Secure checkout"
        title="Confirm your pickup order"
        description="Prices and availability are checked again by Kobby’s Kitchen when you place the order."
      />
      <OrderingStatusNotice context="checkout" status={orderingStatus} />
      {catalogue.ok ? (
        <CheckoutForm
          catalogueItems={catalogue.items}
          customer={{
            displayName: profile.display_name,
            email: user.email || "",
            phone: profile.phone || "",
          }}
          orderingStatus={orderingStatus}
        />
      ) : (
        <section className="cart-empty-state" role="alert">
          <h2>Checkout is temporarily unavailable.</h2>
          <p>The current menu could not be verified. Your cart has not been changed.</p>
        </section>
      )}
    </>
  );
}
