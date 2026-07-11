function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      className="inline-icon"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7.5 4.75H5.9C5.29 4.75 4.75 5.19 4.62 5.79L4.12 8.18C4.04 8.56 4.12 8.95 4.36 9.27L6.2 11.67C7.63 13.54 9.27 15.18 11.14 16.61L13.54 18.45C13.86 18.69 14.25 18.77 14.63 18.69L17.02 18.19C17.62 18.06 18.06 17.52 18.06 16.91V15.31C18.06 14.84 17.74 14.43 17.28 14.31L14.69 13.67C14.28 13.57 13.85 13.68 13.54 13.97L12.34 15.11C10.36 14.06 8.75 12.45 7.7 10.47L8.84 9.27C9.13 8.96 9.24 8.53 9.14 8.12L8.5 5.53C8.38 5.07 7.97 4.75 7.5 4.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg
      aria-hidden="true"
      className="inline-icon"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14.2 3C14.45 5.08 15.67 6.59 17.58 7.1V9.62C16.36 9.58 15.22 9.22 14.2 8.58V13.73C14.2 17.52 11.38 20 8.3 20C5.33 20 3 17.62 3 14.76C3 11.39 5.77 9.14 8.71 9.14C9.12 9.14 9.38 9.18 9.79 9.29V11.86C9.45 11.75 9.16 11.69 8.81 11.69C7.12 11.69 5.78 12.85 5.78 14.5C5.78 16.04 7 17.22 8.48 17.22C10.08 17.22 11.39 16.07 11.39 14.13V3H14.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg
      aria-hidden="true"
      className="inline-icon"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 7.25C4 6.56 4.56 6 5.25 6H18.75C19.44 6 20 6.56 20 7.25V16.75C20 17.44 19.44 18 18.75 18H5.25C4.56 18 4 17.44 4 16.75V7.25Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M5 7L12 12.25L19 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export default function InlineIcon({ name }) {
  if (name === "phone") {
    return <PhoneIcon />;
  }

  if (name === "email") {
    return <EmailIcon />;
  }

  if (name === "tiktok") {
    return <TikTokIcon />;
  }

  return null;
}
