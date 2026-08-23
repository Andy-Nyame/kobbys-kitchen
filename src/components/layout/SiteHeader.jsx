import Image from "next/image";
import Link from "next/link";

import DesktopNavigation from "@/components/navigation/DesktopNavigation";
import MobileNavigation from "@/components/navigation/MobileNavigation";
import ButtonLink from "@/components/ui/ButtonLink";
import ThemeControl from "@/components/theme/ThemeControl";
import { businessData } from "@/data/businessData";

export default function SiteHeader() {
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
          <DesktopNavigation />
          <ThemeControl compact />
          <ButtonLink
            ariaLabel="Order on WhatsApp"
            className="site-header__whatsapp"
            href={businessData.whatsapp.href}
            rel="noopener noreferrer"
            target="_blank"
            variant="primary"
          >
            Order on WhatsApp
          </ButtonLink>
        </div>

        <MobileNavigation />
      </div>
    </header>
  );
}
