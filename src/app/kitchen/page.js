import { redirect } from "next/navigation";

import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import KitchenOrderCard from "@/components/kitchen/KitchenOrderCard";
import OperationalAutoRefresh from "@/components/operations/OperationalAutoRefresh";
import PickupVerification from "@/components/pickup/PickupVerification";
import ThemeControl from "@/components/theme/ThemeControl";
import { getKitchenAccess } from "@/lib/auth/guards";
import { listKitchenOrders } from "@/lib/kitchen/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kitchen | Kobby's Kitchen", description: "Trusted kitchen order queue." };

export default async function KitchenPage({ searchParams }) {
  const { user, role, allowed } = await getKitchenAccess();
  const params = await searchParams;
  if (user && !allowed) redirect("/access-denied?area=kitchen");
  if (!user) {
    return <main className="kitchen-login"><div className="kitchen-login__theme"><ThemeControl /></div><section className="auth-card"><p className="order-option-card__eyebrow">Kobby&rsquo;s Kitchen</p><h1>Kitchen Workspace</h1><p>Sign in with an existing trusted kitchen or administrator account.</p>{params?.error ? <p className="form-message form-message--error">Authentication could not be completed. Try again.</p> : null}<GoogleAuthButton intent="kitchen" nextPath="/kitchen" /><p className="form-hint">Google proves identity. Kitchen access is granted only by the trusted database role.</p></section></main>;
  }

  let queue = { active: [], ready: [] };
  let loadFailed = false;
  try { queue = await listKitchenOrders(); } catch (error) { loadFailed = true; console.error("[kitchen-queue]", { category: error?.code || "query_failed" }); }

  return <div className="kitchen-workspace"><OperationalAutoRefresh exactPaths={["/kitchen"]} /><header className="kitchen-header"><div><strong>Kobby&rsquo;s Kitchen</strong><span>Kitchen Workspace · {role}</span></div><div><ThemeControl compact /><form action="/api/auth/logout" method="POST"><button className="button-link button-link--secondary" type="submit">Sign Out</button></form></div></header><main className="kitchen-main"><section className="kitchen-intro"><div><p className="order-option-card__eyebrow">Live preparation queue</p><h1>Active Orders</h1><p>Accepted orders are shown oldest first. Marking an order ready creates its customer pickup code.</p></div><strong aria-label={`${queue.active.length} active orders`} className="kitchen-count">{queue.active.length}</strong></section>{loadFailed ? <p className="admin-data-error">The kitchen queue could not be loaded. No data has been changed.</p> : queue.active.length ? <div className="kitchen-order-grid">{queue.active.map((order) => <KitchenOrderCard key={order.reference} order={order} />)}</div> : <p className="admin-empty-state">There are no accepted orders waiting for preparation.</p>}<PickupVerification />{queue.ready.length ? <section className="kitchen-ready"><div className="kitchen-intro"><div><p className="order-option-card__eyebrow">Awaiting customer</p><h2>Ready for Pickup</h2></div><strong aria-label={`${queue.ready.length} orders ready for pickup`} className="kitchen-count">{queue.ready.length}</strong></div><div className="kitchen-ready__list">{queue.ready.map((order) => <KitchenOrderCard actionable={false} key={order.reference} order={order} />)}</div></section> : null}</main></div>;
}
