"use client";

import Link from "next/link";
import { useState } from "react";

import GoogleAuthButton from "@/components/auth/GoogleAuthButton";

export default function AdminLoginForm({
  initialError = "",
  nextPath = "/admin",
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setServerError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next: nextPath }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setErrors(result.errors || {});
        setServerError(result.message || "Unable to sign in right now.");
        setLoading(false);
        return;
      }

      window.location.assign(result.redirectTo || "/admin");
    } catch {
      setServerError("Unable to sign in right now. Please try again.");
      setLoading(false);
    }
  }

  return (
    <section className="admin-login-card" aria-labelledby="admin-login-title">
      <div className="admin-login-card__heading">
        <p className="admin-login-card__eyebrow">Kobby&rsquo;s Kitchen</p>
        <h1 id="admin-login-title">Administration</h1>
        <p>
          Sign in to manage orders, payments, reviews and kitchen operations.
        </p>
      </div>

      {serverError ? (
        <p className="admin-login-card__error" role="alert">
          {serverError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="admin-email">Email</label>
          <input
            autoComplete="email"
            id="admin-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
            aria-describedby={errors.email ? "admin-email-error" : undefined}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email ? (
            <p className="form-field__error" id="admin-email-error">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor="admin-password">Password</label>
          <input
            autoComplete="current-password"
            id="admin-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
            aria-describedby={errors.password ? "admin-password-error" : undefined}
            aria-invalid={Boolean(errors.password)}
          />
          {errors.password ? (
            <p className="form-field__error" id="admin-password-error">
              {errors.password}
            </p>
          ) : null}
        </div>

        <button
          className="button-link button-link--primary admin-login-card__submit"
          disabled={loading}
          type="submit"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <div className="auth-divider" role="separator">
        <span>or</span>
      </div>
      <GoogleAuthButton intent="admin" nextPath={nextPath} />

      <p className="admin-login-card__notice">
        Only authorized administrators can access this workspace.
      </p>

      <Link className="admin-login-card__back" href="/">
        Back to Kobby&rsquo;s Kitchen
      </Link>
    </section>
  );
}
