"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  BUSINESS_HOURS_ADMIN_ACTION,
  BUSINESS_HOURS_DAYS,
} from "@/lib/business-hours/admin-validation";

function withKeys(schedule) {
  return Object.fromEntries(
    BUSINESS_HOURS_DAYS.map(({ dayOfWeek }) => [
      dayOfWeek,
      (schedule?.[dayOfWeek] || []).map((window, index) => ({
        ...window,
        clientKey: `${dayOfWeek}-${index}-${window.startTime}-${window.endTime}`,
      })),
    ])
  );
}

export default function AdminBusinessHoursManager({ initialSchedule }) {
  const router = useRouter();
  const [schedule, setSchedule] = useState(() => withKeys(initialSchedule));
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState({ ok: null, message: "" });

  function updateWindow(dayOfWeek, clientKey, field, value) {
    setSchedule((current) => ({
      ...current,
      [dayOfWeek]: current[dayOfWeek].map((window) =>
        window.clientKey === clientKey ? { ...window, [field]: value } : window
      ),
    }));
  }

  function openDay(dayOfWeek) {
    setSchedule((current) => ({
      ...current,
      [dayOfWeek]: [
        ...current[dayOfWeek],
        {
          startTime: "16:00",
          endTime: "00:00",
          clientKey: `${dayOfWeek}-${Date.now()}`,
        },
      ],
    }));
  }

  function removeWindow(dayOfWeek, clientKey) {
    setSchedule((current) => ({
      ...current,
      [dayOfWeek]: current[dayOfWeek].filter((window) => window.clientKey !== clientKey),
    }));
  }

  async function save(event) {
    event.preventDefault();
    setPending(true);
    setFeedback({ ok: null, message: "" });
    const windows = BUSINESS_HOURS_DAYS.flatMap(({ dayOfWeek }) =>
      schedule[dayOfWeek].map(({ startTime, endTime }) => ({
        dayOfWeek,
        startTime,
        endTime,
      }))
    );

    try {
      const response = await fetch("/api/admin/business-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: BUSINESS_HOURS_ADMIN_ACTION.SAVE, windows }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Business hours could not be saved.");
      }
      setFeedback({ ok: true, message: result.message });
      router.refresh();
    } catch (error) {
      setFeedback({
        ok: false,
        message: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="admin-business-hours">
      <p
        aria-live="polite"
        className={feedback.ok === false ? "admin-inline-error" : "admin-operations-feedback"}
        role="status"
      >
        {feedback.message}
      </p>
      <form className="admin-schedule" onSubmit={save}>
        {BUSINESS_HOURS_DAYS.map(({ dayOfWeek, label }) => (
          <fieldset className="admin-schedule-day" key={dayOfWeek}>
            <div className="admin-schedule-day__heading">
              <legend>{label}</legend>
              <span>{schedule[dayOfWeek].length ? "Open" : "Closed"}</span>
            </div>
            <div className="admin-schedule-day__windows">
              {schedule[dayOfWeek].map((window, index) => (
                <div className="admin-schedule-window" key={window.clientKey}>
                  <label className="form-field">
                    <span>{label} opening time {index + 1}</span>
                    <input
                      disabled={pending}
                      onChange={(event) => updateWindow(dayOfWeek, window.clientKey, "startTime", event.target.value)}
                      required
                      type="time"
                      value={window.startTime}
                    />
                  </label>
                  <label className="form-field">
                    <span>{label} closing time {index + 1}</span>
                    <input
                      disabled={pending}
                      onChange={(event) => updateWindow(dayOfWeek, window.clientKey, "endTime", event.target.value)}
                      required
                      type="time"
                      value={window.endTime}
                    />
                  </label>
                  <button
                    aria-label={`Remove ${label} business-hours window ${index + 1}`}
                    className="cart-text-button"
                    disabled={pending}
                    onClick={() => removeWindow(dayOfWeek, window.clientKey)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="admin-schedule-day__actions">
              <button
                className="button-link button-link--secondary"
                disabled={pending}
                onClick={() => openDay(dayOfWeek)}
                type="button"
              >
                {schedule[dayOfWeek].length ? "+ Add Business Window" : "Open this day"}
              </button>
              {schedule[dayOfWeek].length ? (
                <button
                  className="cart-text-button"
                  disabled={pending}
                  onClick={() => setSchedule((current) => ({ ...current, [dayOfWeek]: [] }))}
                  type="button"
                >
                  Close this day
                </button>
              ) : null}
            </div>
          </fieldset>
        ))}
        <div className="admin-schedule__save">
          <button className="button-link button-link--primary" disabled={pending} type="submit">
            {pending ? "Saving…" : "Save Business Hours"}
          </button>
        </div>
      </form>
    </div>
  );
}
