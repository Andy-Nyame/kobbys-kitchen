"use client";

import Link from "next/link";
import { useState } from "react";

import StarRatingInput from "@/components/reviews/StarRatingInput";
import { validateReviewPayload } from "@/utils/reviewValidation";

export default function FeedbackForm({
  fields,
  textarea,
  hintText,
  buttonLabel,
  ratingField,
}) {
  const initialValues = Object.fromEntries(
    [...fields, textarea].map((field) => [field.name, ""])
  );
  const [formValues, setFormValues] = useState(initialValues);
  const [ratingValue, setRatingValue] = useState("");
  const [errors, setErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState("");

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    setFormValues((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleRatingChange = (value) => {
    setRatingValue(value);
    setErrors((current) => ({
      ...current,
      rating: "",
    }));
    setStatusMessage("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!ratingField) {
      setStatusMessage(
        "This form is not connected yet. Your message has not been sent."
      );
      return;
    }

    const { errors: validationErrors } = validateReviewPayload({
      ...formValues,
      rating: ratingValue,
    });

    if (validationErrors.rating) {
      setErrors(validationErrors);
      setStatusMessage("");
      return;
    }

    setErrors({});
    setStatusMessage(
      "Review submission is not connected yet. Your review has not been sent."
    );
  };

  return (
    <form className="form-card" noValidate onSubmit={handleSubmit}>
      <div className="form-grid">
        {fields.map((field) => (
          <div key={field.id} className="form-field">
            <label htmlFor={field.id}>{field.label}</label>
            <input
              id={field.id}
              name={field.name}
              onChange={handleFieldChange}
              placeholder={field.placeholder}
              type={field.type}
              value={formValues[field.name]}
            />
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
          id={textarea.id}
          name={textarea.name}
          onChange={handleFieldChange}
          placeholder={textarea.placeholder}
          value={formValues[textarea.name]}
        />
      </div>

      {statusMessage ? (
        <p className="form-card__message" role="status">
          {statusMessage}
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
        <button type="submit">
          {buttonLabel}
        </button>
      </div>
    </form>
  );
}
