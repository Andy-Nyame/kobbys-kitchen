"use client";

import { useState } from "react";

import ButtonLink from "@/components/ui/ButtonLink";

export default function ProfileForm({ initialProfile }) {
  const [displayName, setDisplayName] = useState(initialProfile.display_name);
  const [phone, setPhone] = useState(initialProfile.phone);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setServerError("");
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, phone }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setErrors(result.errors || {});
        setServerError(result.message || "Something went wrong.");
        return;
      }

      setSuccess(true);
    } catch {
      setServerError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {serverError ? (
        <p className="auth-card__error" role="alert">
          {serverError}
        </p>
      ) : null}
      {success ? (
        <p className="form-success" role="status">
          Profile updated successfully.
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

        <div className="section-actions">
          <button
            type="submit"
            className="button-link button-link--primary"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
          <ButtonLink href="/account" variant="secondary">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </>
  );
}
