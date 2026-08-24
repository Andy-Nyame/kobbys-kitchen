"use client";

import { useState } from "react";

import Link from "next/link";
import { authCrossLinks } from "@/data/navigation";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          email,
          phone,
          password,
        }),
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
          Account created! Please check your email to confirm your account
          before signing in.
        </p>
        <p className="auth-card__footer">
          <Link href="/login">Back to Sign In</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Create Account</h1>
      <p className="auth-card__description">
        Join Kobby&rsquo;s Kitchen to manage your account and orders.
      </p>

      {serverError ? (
        <p className="auth-card__error" role="alert">
          {serverError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="displayName">Display Name</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            autoComplete="name"
            aria-invalid={Boolean(errors.displayName)}
            aria-describedby={
              errors.displayName ? "displayName-error" : undefined
            }
          />
          {errors.displayName ? (
            <p id="displayName-error" className="form-field__error">
              {errors.displayName}
            </p>
          ) : null}
        </div>

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
          <label htmlFor="phone">Phone Number</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            autoComplete="tel"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "phone-error" : undefined}
          />
          {errors.phone ? (
            <p id="phone-error" className="form-field__error">
              {errors.phone}
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
          {loading ? "Creating Account..." : "Create Account"}
        </button>
      </form>

      <p className="auth-card__footer">
        <span>{authCrossLinks.signup.prompt}</span>
        <Link href={authCrossLinks.signup.href}>
          {authCrossLinks.signup.label}
        </Link>
      </p>
    </div>
  );
}
