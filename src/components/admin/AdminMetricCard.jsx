export default function AdminMetricCard({ label, value, note, tone = "default" }) {
  return (
    <article className={`admin-metric admin-metric--${tone}`}>
      <p className="admin-metric__label">{label}</p>
      <p className="admin-metric__value">{value}</p>
      {note ? <p className="admin-metric__note">{note}</p> : null}
    </article>
  );
}
