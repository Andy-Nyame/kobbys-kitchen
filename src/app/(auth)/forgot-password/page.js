"use client";

import { useState } from "react";

import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setServerError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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

      setSuccess(true);
      setLoading(false);
    } catch {
      setServerError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="auth-card">
        <h1>Check Your Email</h1>
        <p className="auth-card__description">
          If an account exists with that email, a password reset link has been
          sent.
        </p>
        <p className="auth-card__footer">
          <Link href="/login">Back to Sign In</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Reset Password</h1>
      <p className="auth-card__description">
        Enter your email and we&rsquo;ll send you a link to reset your password.
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

        <button
          type="submit"
          className="button-link button-link--primary auth-card__submit"
          disabled={loading}
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>

      <p className="auth-card__footer">
        <Link href="/login">Back to Sign In</Link>
      </p>
    </div>
  );
}
