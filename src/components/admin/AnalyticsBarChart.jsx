export default function AnalyticsBarChart({
  ariaLabel,
  data,
  emptyWhenZero = false,
  emptyMessage,
  formatValue = (value) => String(value),
  getKey = (item) => item.label,
  getLabel = (item) => item.label,
  getShortLabel = getLabel,
  getValue = (item) => item.value,
}) {
  const safeData = data || [];
  const values = safeData.map((item) => Math.max(Number(getValue(item)) || 0, 0));

  if (!safeData.length || (emptyWhenZero && values.every((value) => value === 0))) {
    return <p className="admin-empty-state">{emptyMessage}</p>;
  }

  const maximum = Math.max(...values, 1);

  return (
    <figure className="analytics-bar-chart">
      <figcaption className="sr-only">{ariaLabel}</figcaption>
      <div
        aria-hidden="true"
        className="analytics-bar-chart__plot"
      >
        {safeData.map((item, index) => {
          const value = values[index];

          return (
            <div className="analytics-bar-chart__point" key={getKey(item)}>
              <span className="analytics-bar-chart__value">
                {formatValue(value)}
              </span>
              <span className="analytics-bar-chart__track">
                <span
                  className="analytics-bar-chart__bar"
                  style={{
                    "--analytics-bar-height": `${(value / maximum) * 100}%`,
                  }}
                />
              </span>
              <span className="analytics-bar-chart__label">
                {getShortLabel(item)}
              </span>
            </div>
          );
        })}
      </div>
      <ul className="sr-only">
        {safeData.map((item, index) => (
          <li key={getKey(item)}>
            {getLabel(item)}: {formatValue(values[index])}
          </li>
        ))}
      </ul>
    </figure>
  );
}
