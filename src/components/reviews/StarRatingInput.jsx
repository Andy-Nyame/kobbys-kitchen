"use client";

import {
  REVIEW_RATING_ERROR,
  REVIEW_RATING_OPTIONS,
} from "@/lib/validation/review";

export default function StarRatingInput({
  description,
  error,
  id,
  label,
  name,
  onChange,
  value,
}) {
  const numericValue = Number(value) || 0;
  const describedBy = [`${id}-description`, `${id}-selection`];

  if (error) {
    describedBy.push(`${id}-error`);
  }

  return (
    <fieldset
      aria-describedby={describedBy.join(" ")}
      className="rating-field"
    >
      <legend>{label}</legend>
      <p className="rating-field__description" id={`${id}-description`}>
        {description}
      </p>

      <div className="rating-field__inputs">
        {REVIEW_RATING_OPTIONS.map((option) => (
          <label
            key={option}
            className={`rating-field__option${
              numericValue >= option ? " rating-field__option--selected" : ""
            }`}
          >
            <input
              checked={numericValue === option}
              className="rating-field__input"
              name={name}
              onChange={() => onChange(option)}
              required
              type="radio"
              value={option}
            />
            <span aria-hidden="true" className="rating-field__star">
              ★
            </span>
            <span className="sr-only">
              {option} star{option === 1 ? "" : "s"}
            </span>
          </label>
        ))}
      </div>

      <p aria-live="polite" className="rating-field__selection" id={`${id}-selection`}>
        {numericValue
          ? `Selected rating: ${numericValue} out of 5`
          : "Selected rating: None"}
      </p>

      {error ? (
        <p className="form-card__error" id={`${id}-error`} role="alert">
          {error || REVIEW_RATING_ERROR}
        </p>
      ) : null}
    </fieldset>
  );
}
