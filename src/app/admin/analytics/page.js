import AdminMetricCard from "@/components/admin/AdminMetricCard";
import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { formatAdminDate } from "@/lib/admin/presentation";
import { getAccountMetrics } from "@/lib/analytics/account-queries";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata = { title: "Account Analytics | Kobby's Kitchen", description: "Registration and account composition analytics." };

export default async function AdminAnalyticsPage() {
  await requireAdmin("/admin/analytics");
  let metrics = null;
  try { metrics = await getAccountMetrics(); } catch (error) { console.error("[admin-account-analytics]", error); }
  const maxTrend = metrics ? Math.max(...metrics.registrationTrend.map((item) => item.count), 1) : 1;

  return <>
    <PageIntro eyebrow="Admin insights" title="Account Analytics" description="Real registration totals and account composition from trusted user records." />
    <ContentSection title="Account Summary" description="Counts reflect registered identities. Activity tracking is not currently collected, so no active-user metric is inferred." className="admin-section">
      {metrics ? <div className="admin-metric-grid">
        <AdminMetricCard label="Registered accounts" value={metrics.totalAccounts} /><AdminMetricCard label="Customers" value={metrics.customerCount} /><AdminMetricCard label="Administrators" value={metrics.adminCount} /><AdminMetricCard label="Registered today" value={metrics.registrationsToday} /><AdminMetricCard label="Registered in 7 days" value={metrics.registrationsSevenDays} /><AdminMetricCard label="Registered in 30 days" value={metrics.registrationsThirtyDays} /><AdminMetricCard label="Google identities" value={metrics.googleAccountCount} /><AdminMetricCard label="Password credentials" value={metrics.credentialAccountCount} />
      </div> : <p className="admin-data-error">Account analytics are temporarily unavailable.</p>}
    </ContentSection>
    <ContentSection title="Registration Trend" description="New accounts per GMT calendar day for the last seven days; zero days are shown truthfully." className="admin-section">
      {metrics ? <div className="admin-registration-trend" role="img" aria-label="Seven-day account registration trend">{metrics.registrationTrend.map((item) => <div className="admin-registration-trend__day" key={item.day}><span className="admin-registration-trend__count">{item.count}</span><span className="admin-registration-trend__bar" style={{ "--trend-height": `${Math.max((item.count / maxTrend) * 100, item.count ? 8 : 2)}%` }} aria-hidden="true" /><span>{item.day.slice(5)}</span></div>)}</div> : <p className="admin-data-error">Registration trends are temporarily unavailable.</p>}
    </ContentSection>
    <ContentSection title="Recent Registrations" description="The newest registered accounts and their authentication methods." className="admin-section">
      {metrics?.recentAccounts.length ? <div className="admin-table-shell" tabIndex="0" role="region" aria-label="Recent registrations"><table className="admin-table admin-table--compact"><thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Method</th><th scope="col">Registered</th></tr></thead><tbody>{metrics.recentAccounts.map((account) => <tr key={account.id}><td data-label="Name">{account.name}</td><td data-label="Email">{account.email}</td><td data-label="Role">{account.role === "ADMIN" ? "Administrator" : "Customer"}</td><td data-label="Method">{account.providers.length ? account.providers.join(", ") : "Password"}</td><td data-label="Registered">{formatAdminDate(account.createdAt)}</td></tr>)}</tbody></table></div> : metrics ? <p className="admin-empty-state">No registered accounts are available yet.</p> : <p className="admin-data-error">Recent registrations are temporarily unavailable.</p>}
    </ContentSection>
  </>;
}
