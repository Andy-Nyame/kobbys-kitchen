import Image from "next/image";
import Link from "next/link";

import DesktopNavigation from "@/components/navigation/DesktopNavigation";
import MobileNavigation from "@/components/navigation/MobileNavigation";

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
            <span className="brand__name">Kobby’s Kitchen</span>
            <span className="brand__tagline">Tema Community Two</span>
          </span>
        </Link>

        <DesktopNavigation />
        <MobileNavigation />
      </div>
    </header>
  );
}
