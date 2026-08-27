import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { requireCustomer } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "My Orders | Kobby's Kitchen",
  description: "View your Kobby's Kitchen order history.",
};

export default async function OrdersPage() {
  const user = await requireCustomer("/account/orders");

  let orderList = [];

  try {
    orderList = await prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reference: true,
        status: true,
        totalMinor: true,
        currency: true,
        createdAt: true,
      },
    });
  } catch (error) {
    console.error("[account-orders]", error);
  }

  return (
    <>
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
          <p>
            Online ordering will be available soon. Thank you for your
            patience.
          </p>
        ) : (
          <ul className="order-list">
            {orderList.map((order) => (
              <li key={order.id} className="order-list__item">
                <div className="order-list__header">
                  <strong>#{order.reference}</strong>
                  <span
                    className={`order-status order-status--${order.status.toLowerCase()}`}
                  >
                    {order.status}
                  </span>
                </div>
                <p>
                  {order.currency} {(order.totalMinor / 100).toFixed(2)}
                </p>
                <p className="order-list__date">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </ContentSection>
    </>
  );
}
