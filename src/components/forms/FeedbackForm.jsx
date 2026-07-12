"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  REVIEW_SERVER_ERROR_MESSAGE,
  REVIEW_SUCCESS_MESSAGE,
  validateReviewSubmission,
} from "@/lib/validation/review";
import StarRatingInput from "@/components/reviews/StarRatingInput";

export default function FeedbackForm({
  fields,
  textarea,
  hintText,
  buttonLabel,
  ratingField,
  consentField,
  honeypotField,
  formType,
  loadingMessage,
  submitButtonLoadingLabel,
  submitEndpoint,
  successMessage,
  unavailableMessage,
}) {
  const initialValues = Object.fromEntries(
    [
      ...fields.map((field) => [field.name, ""]),
      [textarea.name, ""],
      ...(consentField ? [[consentField.name, false]] : []),
      ...(honeypotField ? [[honeypotField.name, ""]] : []),
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
    if (formType === "review") {
      const { errors } = validateReviewSubmission({
        ...formValues,
        rating: ratingValue,
      });

      return errors;
    }

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
    return nextErrors;
  };

  const resetForm = () => {
    setFormValues(initialValues);
    setRatingValue("");
    setErrors({});
  };

  const handleSubmit = async (event) => {
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

    if (submitEndpoint) {
      try {
        const response = await fetch(submitEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...formValues,
            ...(ratingField ? { rating: ratingValue } : {}),
          }),
        });
        const responseBody = await response.json().catch(() => null);

        if (response.ok) {
          resetForm();
          setStatus({
            type: "success",
            message:
              responseBody?.message || successMessage || REVIEW_SUCCESS_MESSAGE,
          });
          return;
        }

        if (responseBody?.errors) {
          setErrors(responseBody.errors);
        }

        setStatus({
          type: "error",
          message: responseBody?.message || REVIEW_SERVER_ERROR_MESSAGE,
        });
        return;
      } catch {
        setStatus({
          type: "error",
          message: REVIEW_SERVER_ERROR_MESSAGE,
        });
        return;
      }
    }

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
            {field.type === "select" ? (
              <select
                aria-describedby={errors[field.name] ? `${field.id}-error` : undefined}
                aria-invalid={errors[field.name] ? "true" : "false"}
                id={field.id}
                name={field.name}
                onChange={handleFieldChange}
                required={field.required}
                value={formValues[field.name]}
              >
                <option value="">{field.placeholder}</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
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
            )}
            {errors[field.name] ? (
              <p className="form-card__error" id={`${field.id}-error`} role="alert">
                {errors[field.name]}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {honeypotField ? (
        <div aria-hidden="true" className="visually-hidden-field">
          <label htmlFor={honeypotField.id}>{honeypotField.label}</label>
          <input
            autoComplete={honeypotField.autoComplete}
            id={honeypotField.id}
            name={honeypotField.name}
            onChange={handleFieldChange}
            tabIndex={-1}
            type="text"
            value={formValues[honeypotField.name]}
          />
        </div>
      ) : null}

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
          {status.type === "loading"
            ? submitButtonLoadingLabel || "Please wait..."
            : buttonLabel}
        </button>
      </div>
    </form>
  );
}
