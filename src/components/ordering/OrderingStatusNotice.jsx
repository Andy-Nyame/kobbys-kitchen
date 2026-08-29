export default function OrderingStatusNotice({ status, context = "default" }) {
  return (
    <aside
      className={`ordering-status-notice ordering-status-notice--${status.isOpen ? "open" : "closed"}`}
      data-context={context}
      role="status"
    >
      <div>
        <span className="ordering-status-notice__label">
          Online pickup · {status.label}
        </span>
        <p>{status.message}</p>
        {status.detail ? <p className="ordering-status-notice__detail">{status.detail}</p> : null}
        {status.secondary ? <p className="ordering-status-notice__detail">{status.secondary}</p> : null}
      </div>
      <span className="ordering-status-notice__timezone">Times shown in GMT</span>
    </aside>
  );
}
