"use client";

import { useEffect, useRef } from "react";

import CustomerAvatar from "@/components/navigation/CustomerAvatar";
import NavigationLink from "@/components/navigation/NavigationLink";

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
        aria-label={menu.triggerLabel}
        className="customer-account-menu__toggle"
        title={menu.triggerLabel}
      >
        <CustomerAvatar avatar={menu.avatar} />
      </summary>

      <div className="customer-account-menu__panel">
        <div className="customer-account-menu__identity">
          <strong>{menu.displayName}</strong>
          <span className="customer-account-menu__email">{menu.email}</span>
        </div>
        <nav aria-label={menu.navigationLabel}>
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
