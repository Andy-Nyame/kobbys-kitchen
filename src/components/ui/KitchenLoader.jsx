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
        viewBox="0 0 100 100"
      >
        <g className="kitchen-loader__utensils">
          <g transform="rotate(-45 50 50)">
            <ellipse cx="50" cy="19" fill="currentColor" rx="9" ry="13" />
            <rect fill="currentColor" height="68" rx="3.5" width="7" x="46.5" y="27" />
          </g>

          <g transform="rotate(45 50 50)">
            <rect fill="currentColor" height="49" rx="3.5" width="7" x="46.5" y="6" />
            <path
              d="M36 51.5c0-3.6 2.9-6.5 6.5-6.5h15c3.6 0 6.5 2.9 6.5 6.5V80c0 6.1-4.9 11-11 11h-6c-6.1 0-11-4.9-11-11V51.5Z"
              fill="currentColor"
            />
            <path
              d="M43.5 57v21M50 55v25M56.5 57v21"
              fill="none"
              stroke="var(--color-background)"
              strokeLinecap="round"
              strokeWidth="2.5"
            />
          </g>
        </g>
      </svg>
      <span className="kitchen-loader__label">{label}</span>
    </div>
  );
}
