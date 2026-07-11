import Link from "next/link";

export default function FeedbackForm({
  fields,
  textarea,
  hintText,
  buttonLabel,
}) {
  return (
    <form className="form-card" noValidate>
      <div className="form-grid">
        {fields.map((field) => (
          <div key={field.id} className="form-field">
            <label htmlFor={field.id}>{field.label}</label>
            <input
              id={field.id}
              name={field.name}
              placeholder={field.placeholder}
              type={field.type}
            />
          </div>
        ))}
      </div>

      <div className="form-field">
        <label htmlFor={textarea.id}>{textarea.label}</label>
        <textarea
          id={textarea.id}
          name={textarea.name}
          placeholder={textarea.placeholder}
        />
      </div>

      <div className="form-card__footer">
        <p className="form-card__hint">
          {hintText}{" "}
          <Link className="text-link" href="/privacy">
            Privacy
          </Link>{" "}
          page.
        </p>
        <button type="submit" disabled>
          {buttonLabel}
        </button>
      </div>
    </form>
  );
}
