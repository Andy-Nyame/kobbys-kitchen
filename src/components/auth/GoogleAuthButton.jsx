"use client";

import { getSafeCustomerRedirectPath } from "@/lib/auth/redirects";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M21.35 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.52h3.14c1.84-1.69 2.91-4.19 2.91-7.29Z"
        fill="#4285f4"
      />
      <path
        d="M12 21.73c2.63 0 4.84-.87 6.45-2.35L15.31 16.9c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.02H3.29v2.6A9.74 9.74 0 0 0 12 21.73Z"
        fill="#34a853"
      />
      <path
        d="M6.53 13.8A5.87 5.87 0 0 1 6.22 12c0-.62.11-1.21.31-1.8V7.6H3.29A9.73 9.73 0 0 0 2.27 12c0 1.58.38 3.08 1.02 4.4l3.24-2.6Z"
        fill="#fbbc05"
      />
      <path
        d="M12 6.18c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.83 3.28 14.62 2.27 12 2.27A9.74 9.74 0 0 0 3.29 7.6l3.24 2.6C7.3 7.9 9.46 6.18 12 6.18Z"
        fill="#ea4335"
      />
    </svg>
  );
}

export default function GoogleAuthButton() {
  function continueWithGoogle() {
    const requestedPath = new URLSearchParams(window.location.search).get(
      "next"
    );
    const next = getSafeCustomerRedirectPath(requestedPath);

    window.location.assign(`/api/auth/google?next=${encodeURIComponent(next)}`);
  }

  return (
    <button
      className="auth-oauth-button"
      onClick={continueWithGoogle}
      type="button"
    >
      <GoogleIcon />
      <span>Continue with Google</span>
    </button>
  );
}
