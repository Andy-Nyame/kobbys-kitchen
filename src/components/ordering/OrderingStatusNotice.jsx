"use client";

import { useLiveOrderingStatus } from "@/components/operations/OperationalStatusProvider";

export default function OrderingStatusNotice({ status: initialStatus, context = "default" }) {
  const status = useLiveOrderingStatus(initialStatus);

  return (
    <aside
      className={`ordering-status-notice ordering-status-notice--${status.isOpen ? "open" : "closed"}`}
      data-context={context}
      role="status"
    >
      <div>
        <span className="ordering-status-notice__label">
          {status.headline || `Online Ordering ${status.label}`}
        </span>
        <p>{status.message}</p>
        {status.detail ? <p className="ordering-status-notice__detail">{status.detail}</p> : null}
        {status.secondary ? <p className="ordering-status-notice__detail">{status.secondary}</p> : null}
      </div>
    </aside>
  );
}
