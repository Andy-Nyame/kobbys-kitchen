import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth/guards";
import ButtonLink from "@/components/ui/ButtonLink";

export const metadata = {
  title: "My Orders | Kobby's Kitchen",
  description: "View your Kobby's Kitchen order history.",
};

export default async function OrdersPage() {
  const { user } = await requireCustomer();

  const supabase = await createClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, reference, status, total_minor, currency, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[account-orders]", error);
  }

  const orderList = orders || [];

  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow="Account"
          title="My Orders"
          description="View your order history and status."
        />

        <ContentSection
          title="Order History"
          description={
            orderList.length === 0
              ? "You have no orders yet."
              : `You have ${orderList.length} order${orderList.length === 1 ? "" : "s"}.`
          }
        >
          {orderList.length === 0 ? (
            <p>Online ordering will be available soon. Thank you for your patience.</p>
          ) : (
            <ul className="order-list">
              {orderList.map((order) => (
                <li key={order.id} className="order-list__item">
                  <div className="order-list__header">
                    <strong>#{order.reference}</strong>
                    <span className={`order-status order-status--${order.status.toLowerCase()}`}>
                      {order.status}
                    </span>
                  </div>
                  <p>
                    {order.currency} {(order.total_minor / 100).toFixed(2)}
                  </p>
                  <p className="order-list__date">
                    {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ContentSection>
      </div>
    </main>
  );
}

function PageIntro({ eyebrow, title, description }) {
  return (
    <header className="page-intro">
      {eyebrow ? <p className="page-intro__eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function ContentSection({ title, description, children }) {
  return (
    <section className="content-section">
      <div className="content-section__header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children ? <div className="content-section__body">{children}</div> : null}
    </section>
  );
}
