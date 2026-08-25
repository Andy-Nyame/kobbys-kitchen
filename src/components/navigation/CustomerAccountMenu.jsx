"use client";

import { useEffect, useRef } from "react";

import NavigationLink from "@/components/navigation/NavigationLink";

function AccountIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.5-4 3.2-6 7-6s6.5 2 7 6" />
    </svg>
  );
}

export default function CustomerAccountMenu({ menu }) {
  const detailsRef = useRef(null);

  useEffect(() => {
    function closeFromOutside(event) {
      if (!detailsRef.current?.contains(event.target)) {
        detailsRef.current?.removeAttribute("open");
      }
    }

    function closeFromEscape(event) {
      if (event.key !== "Escape" || !detailsRef.current?.open) {
        return;
      }

      detailsRef.current.removeAttribute("open");
      detailsRef.current.querySelector("summary")?.focus();
    }

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);

    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, []);

  return (
    <details className="customer-account-menu" ref={detailsRef}>
      <summary
        aria-label="Customer account menu"
        className="customer-account-menu__toggle"
      >
        <span className="customer-account-menu__icon">
          <AccountIcon />
        </span>
        <span>{menu.label}</span>
        <span aria-hidden="true" className="customer-account-menu__chevron">
          ▾
        </span>
      </summary>

      <div className="customer-account-menu__panel">
        <div className="customer-account-menu__identity">
          <span>Customer account</span>
          <strong>{menu.displayName}</strong>
        </div>
        <nav aria-label="Customer account">
          <ul className="customer-account-menu__list">
            {menu.links.map((item) => (
              <li key={item.href}>
                <NavigationLink
                  activeClassName="customer-account-menu__link--current"
                  className="customer-account-menu__link"
                  closeDetailsOnClick
                  href={item.href}
                >
                  {item.label}
                </NavigationLink>
              </li>
            ))}
          </ul>
        </nav>
        <form action="/api/auth/logout" method="POST">
          <button className="customer-account-menu__sign-out" type="submit">
            Sign Out
          </button>
        </form>
      </div>
    </details>
  );
}
