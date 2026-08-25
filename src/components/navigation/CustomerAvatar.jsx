"use client";

import { useState } from "react";

function GenericUserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.5-4 3.2-6 7-6s6.5 2 7 6" />
    </svg>
  );
}

export default function CustomerAvatar({ avatar, className = "" }) {
  const [imageFailed, setImageFailed] = useState(false);
  const classes = ["customer-avatar", className].filter(Boolean).join(" ");

  if (avatar.imageUrl && !imageFailed) {
    return (
      <span className={classes}>
        {/* Provider image URLs are dynamic and deliberately are not configured as Next image hosts. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="customer-avatar__image"
          onError={() => setImageFailed(true)}
          referrerPolicy="no-referrer"
          src={avatar.imageUrl}
        />
      </span>
    );
  }

  if (avatar.initials) {
    return <span className={`${classes} customer-avatar--initials`}>{avatar.initials}</span>;
  }

  return (
    <span className={`${classes} customer-avatar--generic`}>
      <GenericUserIcon />
    </span>
  );
}
