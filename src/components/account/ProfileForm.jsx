"use client";

import { useState } from "react";

import { validateProfileUpdatePayload } from "@/lib/validation/auth";

export default function ProfileForm({
  accountContext = "customer",
  endpoint = "/api/account/profile",
  initialProfile,
}) {
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [phone, setPhone] = useState(initialProfile.phone);
  const [savedProfile, setSavedProfile] = useState(initialProfile);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState({ type: "idle", message: "" });
  const isSaving = feedback.type === "saving";
  const isDirty =
    displayName !== savedProfile.displayName || phone !== savedProfile.phone;

  function updateField(field, value) {
    if (field === "displayName") {
      setDisplayName(value);
    } else {
      setPhone(value);
    }

    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
    setFeedback({ type: "idle", message: "" });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const validation = validateProfileUpdatePayload({ displayName, phone });

    if (Object.keys(validation.errors).length > 0) {
      setErrors(validation.errors);
      setFeedback({
        type: "error",
        message: "Please check the highlighted information.",
      });
      return;
    }

    setErrors({});
    setFeedback({ type: "saving", message: "Saving your profile…" });

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        setErrors(result?.errors || {});
        setFeedback({
          type: "error",
          message:
            result?.message ||
            "Your profile could not be saved. Please try again.",
        });
        return;
      }

      const savedValues = {
        displayName: result.profile.display_name,
        phone: result.profile.phone,
      };
      setDisplayName(savedValues.displayName);
      setPhone(savedValues.phone);
      setSavedProfile(savedValues);
      setFeedback({
        type: "success",
        message: result.message || "Profile updated successfully.",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "A network error prevented saving. Please try again.",
      });
    }
  }

  return (
    <form
      className="profile-form"
      onSubmit={handleSubmit}
      noValidate
      aria-busy={isSaving}
    >
      {feedback.type === "error" ? (
        <p className="auth-card__error" role="alert">
          {feedback.message}
        </p>
      ) : null}
      {feedback.type === "success" ? (
        <p className="form-success" role="status" aria-live="polite">
          {feedback.message}
        </p>
      ) : null}

      <div className="profile-form__fields">
        <div className="form-field">
          <label htmlFor="displayName">Display Name</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(event) => updateField("displayName", event.target.value)}
            required
            minLength="2"
            maxLength="80"
            autoComplete="name"
            disabled={isSaving}
            aria-invalid={Boolean(errors.displayName)}
            aria-describedby={`displayName-help${errors.displayName ? " displayName-error" : ""}`}
          />
          <p id="displayName-help" className="form-field__help">
            {accountContext === "admin"
              ? "Use the name shown in the administration workspace."
              : "Use the name staff should recognize for pickup."}
          </p>
          {errors.displayName ? (
            <p id="displayName-error" className="form-field__error" role="alert">
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
            onChange={(event) => updateField("phone", event.target.value)}
            maxLength="40"
            autoComplete="tel"
            inputMode="tel"
            placeholder="020 123 4567"
            disabled={isSaving}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={`phone-help${errors.phone ? " phone-error" : ""}`}
          />
          <p id="phone-help" className="form-field__help">
            {phone
              ? "Ghana local and +233 formats are accepted."
              : accountContext === "admin"
                ? "Not added yet. You may add a Ghana phone number."
                : "Not added yet. Add a Ghana phone number for future pickup updates."}
          </p>
          {errors.phone ? (
            <p id="phone-error" className="form-field__error" role="alert">
              {errors.phone}
            </p>
          ) : null}
        </div>
      </div>

      <div className="section-actions profile-form__actions">
        <button
          type="submit"
          className="button-link button-link--primary"
          disabled={isSaving || !isDirty}
        >
          {isSaving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
