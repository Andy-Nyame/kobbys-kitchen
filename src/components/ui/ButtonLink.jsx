import Link from "next/link";

export default function ButtonLink({
  href,
  variant = "secondary",
  className = "",
  target,
  rel,
  ariaLabel,
  title,
  onClick,
  children,
}) {
  const classes = ["button-link", `button-link--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  if (!href) {
    return (
      <span aria-disabled="true" className={`${classes} button-link--disabled`}>
        {children}
      </span>
    );
  }

  if (href.startsWith("/")) {
    return (
      <Link
        aria-label={ariaLabel}
        className={classes}
        href={href}
        onClick={onClick}
        title={title}
      >
        {children}
      </Link>
    );
  }

  return (
    <a
      aria-label={ariaLabel}
      className={classes}
      href={href}
      onClick={onClick}
      rel={rel}
      target={target}
      title={title}
    >
      {children}
    </a>
  );
}
