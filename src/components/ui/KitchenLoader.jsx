export default function KitchenLoader({ label = "Loading…" }) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="kitchen-loader"
      role="status"
    >
      <svg
        aria-hidden="true"
        className="kitchen-loader__icon"
        focusable="false"
        viewBox="0 0 64 64"
      >
        <circle
          className="kitchen-loader__track"
          cx="32"
          cy="32"
          r="24"
        />
        <circle
          className="kitchen-loader__spinner"
          cx="32"
          cy="32"
          pathLength="100"
          r="24"
        />
      </svg>
      <span className="kitchen-loader__label">{label}</span>
    </div>
  );
}
