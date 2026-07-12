"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import StarRatingInput from "@/components/reviews/StarRatingInput";
import { validateReviewPayload } from "@/utils/reviewValidation";

export default function FeedbackForm({
  fields,
  textarea,
  hintText,
  buttonLabel,
  ratingField,
  consentField,
  loadingMessage,
  unavailableMessage,
}) {
  const initialValues = Object.fromEntries(
    [
      ...fields.map((field) => [field.name, ""]),
      [textarea.name, ""],
      ...(consentField ? [[consentField.name, false]] : []),
    ]
  );
  const [formValues, setFormValues] = useState(initialValues);
  const [ratingValue, setRatingValue] = useState("");
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleFieldChange = (event) => {
    const { checked, name, type, value } = event.target;

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setFormValues((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((current) => ({
      ...current,
      [name]: "",
    }));
    setStatus({ type: "idle", message: "" });
  };

  const handleRatingChange = (value) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setRatingValue(value);
    setErrors((current) => ({
      ...current,
      rating: "",
    }));
    setStatus({ type: "idle", message: "" });
  };

  const validateFields = () => {
    const nextErrors = {};

    fields.forEach((field) => {
      if (field.required && !String(formValues[field.name] || "").trim()) {
        nextErrors[field.name] =
          field.errorMessage || `Please enter ${field.label.toLowerCase()}.`;
      }
    });

    if (textarea.required && !String(formValues[textarea.name] || "").trim()) {
      nextErrors[textarea.name] =
        textarea.errorMessage ||
        `Please enter ${textarea.label.toLowerCase()}.`;
    }

    if (consentField && !formValues[consentField.name]) {
      nextErrors[consentField.name] =
        consentField.errorMessage || "Please confirm before submitting.";
    }

    if (ratingField) {
      const { errors: validationErrors } = validateReviewPayload({
        ...formValues,
        rating: ratingValue,
      });

      if (validationErrors.rating) {
        nextErrors.rating = validationErrors.rating;
      }
    }

    return nextErrors;
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const validationErrors = validateFields();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setStatus({ type: "idle", message: "" });
      return;
    }

    setErrors({});
    setStatus({
      type: "loading",
      message: loadingMessage || "Checking your message...",
    });

    timeoutRef.current = window.setTimeout(() => {
      setStatus({
        type: "error",
        message:
          unavailableMessage ||
          "This form is not connected yet. Your message has not been sent.",
      });
      timeoutRef.current = null;
    }, 320);
  };

  return (
    <form className="form-card" noValidate onSubmit={handleSubmit}>
      <div className="form-grid">
        {fields.map((field) => (
          <div key={field.id} className="form-field">
            <label htmlFor={field.id}>{field.label}</label>
            <input
              aria-describedby={errors[field.name] ? `${field.id}-error` : undefined}
              aria-invalid={errors[field.name] ? "true" : "false"}
              autoComplete={field.autoComplete}
              id={field.id}
              name={field.name}
              onChange={handleFieldChange}
              placeholder={field.placeholder}
              required={field.required}
              type={field.type}
              value={formValues[field.name]}
            />
            {errors[field.name] ? (
              <p className="form-card__error" id={`${field.id}-error`} role="alert">
                {errors[field.name]}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {ratingField ? (
        <StarRatingInput
          description={ratingField.description}
          error={errors.rating}
          id={ratingField.id}
          label={ratingField.label}
          name={ratingField.name}
          onChange={handleRatingChange}
          value={ratingValue}
        />
      ) : null}

      <div className="form-field">
        <label htmlFor={textarea.id}>{textarea.label}</label>
        <textarea
          aria-describedby={errors[textarea.name] ? `${textarea.id}-error` : undefined}
          aria-invalid={errors[textarea.name] ? "true" : "false"}
          id={textarea.id}
          name={textarea.name}
          onChange={handleFieldChange}
          placeholder={textarea.placeholder}
          required={textarea.required}
          value={formValues[textarea.name]}
        />
        {errors[textarea.name] ? (
          <p className="form-card__error" id={`${textarea.id}-error`} role="alert">
            {errors[textarea.name]}
          </p>
        ) : null}
      </div>

      {consentField ? (
        <div className="form-field form-field--checkbox">
          <label className="checkbox-field" htmlFor={consentField.id}>
            <input
              aria-describedby={
                errors[consentField.name] ? `${consentField.id}-error` : undefined
              }
              aria-invalid={errors[consentField.name] ? "true" : "false"}
              checked={Boolean(formValues[consentField.name])}
              id={consentField.id}
              name={consentField.name}
              onChange={handleFieldChange}
              required={consentField.required}
              type="checkbox"
            />
            <span>{consentField.label}</span>
          </label>
          {errors[consentField.name] ? (
            <p
              className="form-card__error"
              id={`${consentField.id}-error`}
              role="alert"
            >
              {errors[consentField.name]}
            </p>
          ) : null}
        </div>
      ) : null}

      {status.type !== "idle" ? (
        <p
          className={`form-card__message form-card__message--${status.type}`}
          role={status.type === "error" ? "alert" : "status"}
        >
          {status.message}
        </p>
      ) : null}

      <div className="form-card__footer">
        <p className="form-card__hint">
          {hintText}{" "}
          <Link className="text-link" href="/privacy">
            Privacy
          </Link>{" "}
          page.
        </p>
        <button disabled={status.type === "loading"} type="submit">
          {status.type === "loading" ? "Please wait..." : buttonLabel}
        </button>
      </div>
    </form>
  );
}
