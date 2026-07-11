export default function ImagePlaceholder({ label, className = "" }) {
  const placeholderClassName = ["image-placeholder", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={placeholderClassName}>
      <span className="image-placeholder__label">{label}</span>
    </div>
  );
}
