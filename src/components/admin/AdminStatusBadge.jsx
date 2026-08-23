import { formatStatusLabel } from "@/lib/admin/presentation";

export default function AdminStatusBadge({ status, type = "order" }) {
  if (!status) {
    return <span className="admin-status admin-status--neutral">Not recorded</span>;
  }

  return (
    <span
      className={`admin-status admin-status--${type}-${status.toLowerCase()}`}
    >
      {formatStatusLabel(status)}
    </span>
  );
}
