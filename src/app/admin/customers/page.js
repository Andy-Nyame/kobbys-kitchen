import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { getCustomerLeaderboard } from "@/lib/admin/customer-leaderboard-server";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata = {
  title: "Customers | Kobby's Kitchen",
  description: "Customers ranked by completed online pickup orders.",
};

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  await requireAdmin("/admin/customers");

  let leaderboard = null;
  try {
    leaderboard = await getCustomerLeaderboard();
  } catch (error) {
    console.error("[admin-customer-leaderboard]", {
      category: error?.code || "query_failed",
    });
  }

  return (
    <>
      <PageIntro
        eyebrow="Admin customers"
        title="Customers"
        description="Customers ranked by completed online pickup orders."
      />
      <ContentSection
        className="admin-section"
        title="Customer Leaderboard"
        description="Only successfully completed pickup orders are counted."
      >
        {leaderboard?.length ? (
          <div
            aria-label="Customer order leaderboard"
            className="admin-table-shell"
            role="region"
            tabIndex="0"
          >
            <table className="admin-table admin-table--compact">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Email</th>
                  <th scope="col">Completed Orders</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, index) => (
                  <tr key={entry.id}>
                    <td data-label="Rank"><strong>#{index + 1}</strong></td>
                    <td data-label="Customer">{entry.customer}</td>
                    <td data-label="Email">{entry.email || "Email unavailable"}</td>
                    <td data-label="Completed Orders">
                      {entry.completedOrderCount} completed {entry.completedOrderCount === 1 ? "order" : "orders"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : leaderboard ? (
          <p className="admin-empty-state">No completed customer orders yet.</p>
        ) : (
          <p className="admin-data-error" role="alert">
            Customer rankings are temporarily unavailable. No data has been changed.
          </p>
        )}
      </ContentSection>
    </>
  );
}
