import Image from "next/image";
import Link from "next/link";

import DesktopNavigation from "@/components/navigation/DesktopNavigation";
import MobileNavigation from "@/components/navigation/MobileNavigation";
import ButtonLink from "@/components/ui/ButtonLink";
import ThemeControl from "@/components/theme/ThemeControl";
import { businessData } from "@/data/businessData";
import { orderingNavigation } from "@/data/navigation";
import { getHeaderAuthNavigation } from "@/lib/auth/header-navigation";
import { getAuthenticatedUser, getUserRole } from "@/lib/auth/guards";

export default async function SiteHeader() {
  let user = null;
  let role = null;

  try {
    user = await getAuthenticatedUser();
    role = user ? await getUserRole(user.id) : null;
  } catch (error) {
    if (error?.reason) {
      console.error("[site-header-auth]", { reason: error.reason });
    }
  }

  const authNavigation = getHeaderAuthNavigation(user, role);

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link className="brand" href="/">
          <Image
            className="brand__image"
            src="/images/brand/kobbys-logo.png"
            alt="Kobby’s Kitchen logo"
            width={673}
            height={767}
          />
          <span className="brand__copy">
            <span className="brand__name">{businessData.name}</span>
            <span className="brand__tagline">{businessData.location.area}</span>
          </span>
        </Link>

        <div className="site-header__desktop-actions">
          <DesktopNavigation authNavigation={authNavigation} />
          <ThemeControl compact />
          <ButtonLink
            ariaLabel={orderingNavigation.label}
            className="site-header__order"
            href={orderingNavigation.href}
            variant="primary"
          >
            {orderingNavigation.label}
          </ButtonLink>
        </div>

        <MobileNavigation authNavigation={authNavigation} />
      </div>
    </header>
  );
}
