"use client";

import { useState } from "react";

import Link from "next/link";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import { authCrossLinks } from "@/data/navigation";
import { getSafeCustomerRedirectPath } from "@/lib/auth/redirects";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const authError = new URLSearchParams(window.location.search).get("error");

    return authError === "oauth_unavailable" || authError === "auth_callback"
      ? "We could not complete that authentication request. Please try again."
      : "";
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setServerError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        if (result.errors) {
          setErrors(result.errors);
        }
        setServerError(result.message || "Something went wrong.");
        setLoading(false);
        return;
      }

      const requestedPath = new URLSearchParams(window.location.search).get("next");
      window.location.assign(getSafeCustomerRedirectPath(requestedPath));
    } catch {
      setServerError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Sign In</h1>
      <p className="auth-card__description">
        Sign in to your Kobby&rsquo;s Kitchen account.
      </p>

      {serverError ? (
        <p className="auth-card__error" role="alert">
          {serverError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email ? (
            <p id="email-error" className="form-field__error">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          {errors.password ? (
            <p id="password-error" className="form-field__error">
              {errors.password}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          className="button-link button-link--primary auth-card__submit"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div className="auth-divider" role="separator">
        <span>or</span>
      </div>
      <GoogleAuthButton />

      <div className="auth-card__footer-group">
        <p className="auth-card__footer">
          <Link href="/forgot-password">Forgot password for email sign-in?</Link>
        </p>
        <p className="auth-card__footer auth-card__footer--hint">
          Use Continue with Google if that is how you created your account.
        </p>
        <p className="auth-card__footer">
          <span>{authCrossLinks.login.prompt}</span>
          <Link href={authCrossLinks.login.href}>
            {authCrossLinks.login.label}
          </Link>
        </p>
      </div>
    </div>
  );
}
