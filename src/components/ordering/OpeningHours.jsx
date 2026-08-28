export default function OpeningHours({ schedule }) {
  return (
    <ul className="hours-list hours-list--database" aria-label="Normal weekly opening hours">
      {schedule.map((day) => (
        <li className="hours-list__item" key={day.dayOfWeek}>
          <span>{day.label}</span>
          {day.windows.length === 0 ? (
            <strong className="hours-list__closed">Closed</strong>
          ) : (
            <span className="hours-list__windows">
              {day.windows.map((window) => (
                <strong key={`${window.startMinute}-${window.endMinute}`}>
                  {window.label}
                </strong>
              ))}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
