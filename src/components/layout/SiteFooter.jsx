import Image from "next/image";
import Link from "next/link";

import {
  footerSupportNavigation,
  primaryNavigation,
} from "@/data/navigation";
import { businessData } from "@/data/businessData";
import InlineIcon from "@/components/ui/InlineIcon";

export default function SiteFooter() {
  const currentYear = new Date().getFullYear();
  const { phone, whatsapp, socialLinks } = businessData;

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Link className="brand brand--footer" href="/">
            <Image
              className="brand__image"
              src="/images/brand/kobbys-logo.png"
              alt="Kobby’s Kitchen logo"
              width={673}
              height={767}
            />
            <span className="brand__name">{businessData.name}</span>
          </Link>
          <p className="site-footer__copy">{businessData.shortDescription}</p>
          <p className="site-footer__copy">{businessData.location.full}</p>
          <p className="site-footer__copy">
            Mon, Wed-Sun: 4:00 PM – 12:00 Midnight
            <br />
            Tuesday: Closed
          </p>
          <div className="site-footer__meta">
            <a
              aria-label={`Call Kobby’s Kitchen on ${phone.display}`}
              className="footer-link"
              href={phone.href}
            >
              <span className="icon-link">
                <InlineIcon name="phone" />
                <span>Phone: {phone.display}</span>
              </span>
            </a>
            <a
              aria-label={`WhatsApp Kobby’s Kitchen on ${whatsapp.display}`}
              className="footer-link"
              href={whatsapp.href}
              rel="noopener noreferrer"
              target="_blank"
            >
              WhatsApp: {whatsapp.display}
            </a>
            {socialLinks.tiktok ? (
              <a
                aria-label="Visit Kobby’s Kitchen on TikTok"
                className="footer-link"
                href={socialLinks.tiktok}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span className="icon-link">
                  <InlineIcon name="tiktok" />
                  <span>TikTok</span>
                </span>
              </a>
            ) : null}
          </div>
        </div>

        <nav aria-label="Footer primary navigation">
          <h2 className="site-footer__heading">Explore</h2>
          <ul className="footer-link-list">
            {primaryNavigation.map((item) => (
              <li key={item.href}>
                <Link className="footer-link" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Footer supporting navigation">
          <h2 className="site-footer__heading">More</h2>
          <ul className="footer-link-list">
            {footerSupportNavigation.map((item) => (
              <li key={item.href}>
                <Link className="footer-link" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="container site-footer__bottom">
        <p className="site-footer__copy">
          © {currentYear} Kobby’s Kitchen. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
