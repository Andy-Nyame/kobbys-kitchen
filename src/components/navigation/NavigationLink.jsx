"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavigationLink({
  href,
  className = "",
  activeClassName = "",
  closeDetailsOnClick = false,
  children,
}) {
  const pathname = usePathname();
  const isCurrentPage = pathname === href;
  const linkClassName = [className, isCurrentPage ? activeClassName : ""]
    .filter(Boolean)
    .join(" ");

  const handleClick = (event) => {
    if (!closeDetailsOnClick) {
      return;
    }

    const parentDetails = event.currentTarget.closest("details");

    if (parentDetails) {
      parentDetails.removeAttribute("open");
    }
  };

  return (
    <Link
      aria-current={isCurrentPage ? "page" : undefined}
      className={linkClassName}
      href={href}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}
