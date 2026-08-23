"use client";

import { useState } from "react";

import Link from "next/link";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
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
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
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
        <h1>Password Updated</h1>
        <p className="auth-card__description">
          Your password has been updated successfully.
        </p>
        <p className="auth-card__footer">
          <Link href="/login">Sign In</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Set New Password</h1>
      <p className="auth-card__description">
        Enter your new password below.
      </p>

      {serverError ? (
        <p className="auth-card__error" role="alert">
          {serverError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="password">New Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="new-password"
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
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>

      <p className="auth-card__footer">
        <Link href="/login">Back to Sign In</Link>
      </p>
    </div>
  );
}
