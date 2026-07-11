export default function ContentSection({
  title,
  description,
  children,
  className = "",
}) {
  const sectionClassName = ["content-section", className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClassName}>
      <div className="content-section__header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children ? <div className="content-section__body">{children}</div> : null}
    </section>
  );
}
