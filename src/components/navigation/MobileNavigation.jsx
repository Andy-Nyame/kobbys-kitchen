"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import ButtonLink from "@/components/ui/ButtonLink";
import { businessData } from "@/data/businessData";
import { primaryNavigation } from "@/data/navigation";

export default function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="mobile-navigation">
      <button
        aria-controls="mobile-primary-navigation"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close mobile navigation" : "Open mobile navigation"}
        className="mobile-navigation__toggle"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span
          aria-hidden="true"
          className={`mobile-navigation__icon${
            isOpen ? " mobile-navigation__icon--open" : ""
          }`}
        >
          <span />
          <span />
          <span />
        </span>
      </button>

      {isOpen ? (
        <nav
          id="mobile-primary-navigation"
          aria-label="Mobile navigation"
          className="mobile-navigation__panel"
        >
          <ul className="mobile-navigation__list">
            {primaryNavigation.map((item) => {
              const isCurrent = pathname === item.href;

              return (
                <li key={item.href}>
                  <Link
                    aria-current={isCurrent ? "page" : undefined}
                    className="mobile-navigation__link"
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mobile-navigation__actions">
            <ButtonLink
              ariaLabel="Order on WhatsApp"
              href={businessData.whatsapp.href}
              onClick={() => setIsOpen(false)}
              rel="noopener noreferrer"
              target="_blank"
              variant="primary"
            >
              Order on WhatsApp
            </ButtonLink>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
