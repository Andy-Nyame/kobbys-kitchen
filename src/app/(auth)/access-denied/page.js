import Link from "next/link";

export const metadata = {
  title: "Access Denied | Kobby's Kitchen",
  description: "Return safely to an area available to your account.",
};

export default async function AccessDeniedPage({ searchParams }) {
  const params = await searchParams;
  const adminArea = params?.area === "admin";

  return (
    <div className="auth-card">
      <p className="profile-card__eyebrow">Access protected</p>
      <h1>Administrator access required</h1>
      <p className="auth-card__description">
        {adminArea
          ? "Your account is signed in, but it is not authorized for the administration workspace."
          : "Your account cannot open that protected area."}
      </p>
      <div className="section-actions">
        <Link className="button-link button-link--primary" href="/">
          Return to public site
        </Link>
        <Link className="button-link button-link--secondary" href="/account">
          Open customer account
        </Link>
      </div>
    </div>
  );
}
