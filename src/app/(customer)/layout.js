import Link from "next/link";
import { redirect } from "next/navigation";

import AccountNavigation from "@/components/account/AccountNavigation";
import ThemeControl from "@/components/theme/ThemeControl";
import { getCustomerAccess } from "@/lib/auth/guards";

export default async function CustomerLayout({ children }) {
  const { user, role } = await getCustomerAccess();

  if (user && role !== "CUSTOMER") {
    redirect("/");
  }

  if (!user) {
    return children;
  }

  return (
    <>
      <header className="site-header account-header">
        <div className="container site-header__inner account-header__inner">
          <Link className="brand" href="/">
            <span className="brand__name">Kobby&rsquo;s Kitchen</span>
            <span className="brand__tagline">Tema Community Two</span>
          </Link>

          <AccountNavigation />

          <div className="account-header__actions">
            <ThemeControl compact />
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="button-link button-link--secondary"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="page">
        <div className="container content-stack">{children}</div>
      </main>

      <footer className="site-footer">
        <div className="container site-footer__bottom">
          <p className="site-footer__copy">
            &copy; {new Date().getFullYear()}{" "}Kobby&rsquo;s Kitchen. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}
