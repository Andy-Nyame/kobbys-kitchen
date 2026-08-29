"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import CustomerAvatar from "@/components/navigation/CustomerAvatar";

export default function AdminAccountMenu({ presentation }) {
  const detailsRef = useRef(null);

  useEffect(() => {
    function closeOutside(event) {
      if (!detailsRef.current?.contains(event.target)) {
        detailsRef.current?.removeAttribute("open");
      }
    }

    function closeEscape(event) {
      if (event.key === "Escape" && detailsRef.current?.open) {
        detailsRef.current.removeAttribute("open");
        detailsRef.current.querySelector("summary")?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, []);

  return (
    <details className="admin-account-menu" ref={detailsRef}>
      <summary aria-label="Open administrator profile menu" className="admin-account-menu__toggle">
        <CustomerAvatar avatar={presentation.avatar} />
        <span className="admin-account-menu__summary-copy">
          <strong>{presentation.displayName}</strong>
          <span>Administrator</span>
        </span>
      </summary>
      <div className="admin-account-menu__panel">
        <div className="admin-account-menu__identity">
          <strong>{presentation.displayName}</strong>
          <span>{presentation.email}</span>
          <span className="profile-role-badge">Admin</span>
        </div>
        <Link href="/admin/profile">Profile</Link>
        <a href="/" rel="noopener noreferrer" target="_blank">
          View Public Site <span className="sr-only">(opens in a new tab)</span>
        </a>
        <form action="/api/auth/logout?next=/admin" method="POST">
          <button type="submit">Sign Out</button>
        </form>
      </div>
    </details>
  );
}
