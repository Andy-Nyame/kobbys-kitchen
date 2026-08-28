"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  ORDERING_ADMIN_ACTION,
  ORDERING_DAYS,
} from "@/lib/ordering/admin-validation";

const reasonText = {
  BUILD_DISABLED: "Online ordering is disabled by the deployment safety switch.",
  EMERGENCY_PAUSED: "Emergency pause is active.",
  FORCED_OPEN: "Open by temporary override.",
  FORCED_CLOSED: "Closed by temporary override.",
  SCHEDULE_OPEN: "Open by weekly schedule.",
  SCHEDULE_CLOSED: "Outside ordering hours.",
  NO_SCHEDULE: "No weekly ordering hours are configured.",
  CONFIGURATION_INVALID: "Ordering configuration is invalid and has failed closed.",
};

const sourceText = {
  BUILD_FLAG: "Deployment switch",
  EMERGENCY_PAUSE: "Emergency pause",
  OVERRIDE: "Temporary override",
  SCHEDULE: "Weekly schedule",
  DEFAULT: "Closed default",
};

function formatAccraDateTime(value) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en-GH", {
    timeZone: "Africa/Accra",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function withClientKeys(schedule) {
  return Object.fromEntries(
    ORDERING_DAYS.map(({ dayOfWeek }) => [
      dayOfWeek,
      (schedule?.[dayOfWeek] || []).map((window, index) => ({
        ...window,
        clientKey: `${dayOfWeek}-${index}-${window.startTime}-${window.endTime}`,
      })),
    ])
  );
}

function StatusPanel({ operations }) {
  const { effectiveState, setting } = operations;
  const transition = effectiveState.acceptingOrders
    ? effectiveState.nextCloseAt
      ? `Closes ${formatAccraDateTime(effectiveState.nextCloseAt)}`
      : "No automatic closing time is currently available."
    : effectiveState.nextOpenAt
      ? `Opens ${formatAccraDateTime(effectiveState.nextOpenAt)}`
      : "No automatic opening time is currently available.";

  return (
    <section
      aria-labelledby="ordering-current-state"
      className={`admin-operations-status admin-operations-status--${effectiveState.acceptingOrders ? "open" : "closed"}`}
    >
      <div>
        <p className="admin-section-eyebrow">Authoritative current state</p>
        <h2 id="ordering-current-state">
          {effectiveState.acceptingOrders ? "OPEN" : "CLOSED"}
        </h2>
        <p>{reasonText[effectiveState.reason] || "Ordering is closed safely."}</p>
        <p>{transition}</p>
      </div>
      <dl className="admin-operations-status__details">
        <div>
          <dt>Effective source</dt>
          <dd>{sourceText[effectiveState.source] || effectiveState.source}</dd>
        </div>
        <div>
          <dt>Emergency pause</dt>
          <dd>{setting.emergencyPaused ? "Active" : "Inactive"}</dd>
        </div>
        <div>
          <dt>Override</dt>
          <dd>
            {setting.overrideMode === "NONE"
              ? "None"
              : effectiveState.overrideActive
                ? `${setting.overrideMode} (active)`
                : `${setting.overrideMode} (expired)`}
          </dd>
        </div>
        <div>
          <dt>Override expiry</dt>
          <dd>
            {setting.overrideMode === "NONE"
              ? "Not applicable"
              : setting.overrideExpiresAt
                ? formatAccraDateTime(setting.overrideExpiresAt)
                : "Until manually cleared"}
          </dd>
        </div>
        <div>
          <dt>Timezone</dt>
          <dd>Africa/Accra</dd>
        </div>
      </dl>
    </section>
  );
}

function ConfirmationDialog({ action, onCancel, onConfirm, pending }) {
  const confirmButton = useRef(null);
  const dialog = useRef(null);
  const cancelRef = useRef(onCancel);
  const pendingRef = useRef(pending);

  useEffect(() => {
    cancelRef.current = onCancel;
    pendingRef.current = pending;
  }, [onCancel, pending]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    confirmButton.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !pendingRef.current) {
        cancelRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = [...dialog.current.querySelectorAll("button:not(:disabled)")];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, []);

  const pause = action?.type === ORDERING_ADMIN_ACTION.PAUSE;

  return (
    <div className="admin-operations-dialog-backdrop">
      <section
        aria-describedby="operations-confirm-description"
        aria-labelledby="operations-confirm-title"
        aria-modal="true"
        className="admin-operations-dialog"
        ref={dialog}
        role="alertdialog"
      >
        <p className="admin-section-eyebrow">Please confirm</p>
        <h2 id="operations-confirm-title">
          {pause ? "Pause new online orders?" : "Force ordering closed?"}
        </h2>
        <p id="operations-confirm-description">
          {pause
            ? "New submissions will stop immediately. Existing accepted orders, payments and customer carts will not be changed."
            : "The temporary CLOSED override will stop new submissions until it expires or is cleared."}
        </p>
        <div className="button-row">
          <button
            className="button-link button-link--secondary"
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="button-link button-link--primary"
            disabled={pending}
            onClick={onConfirm}
            ref={confirmButton}
            type="button"
          >
            {pending ? "Updating…" : pause ? "Pause New Orders" : "Close Now"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function AdminOperationsManager({ initialOperations }) {
  const router = useRouter();
  const [schedule, setSchedule] = useState(() => withClientKeys(initialOperations.schedule));
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState({ ok: null, message: "" });
  const [expiresAt, setExpiresAt] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  async function mutate(payload) {
    setPending(true);
    setFeedback({ ok: null, message: "" });

    try {
      const response = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Ordering operations could not be updated.");
      }

      setFeedback({ ok: true, message: result.message });
      setConfirmation(null);
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

  function updateWindow(dayOfWeek, clientKey, field, value) {
    setSchedule((current) => ({
      ...current,
      [dayOfWeek]: current[dayOfWeek].map((window) =>
        window.clientKey === clientKey ? { ...window, [field]: value } : window
      ),
    }));
  }

  function addWindow(dayOfWeek) {
    setSchedule((current) => ({
      ...current,
      [dayOfWeek]: [
        ...current[dayOfWeek],
        {
          startTime: "10:00",
          endTime: "20:00",
          clientKey: `${dayOfWeek}-${Date.now()}-${Math.random()}`,
        },
      ],
    }));
  }

  function removeWindow(dayOfWeek, clientKey) {
    setSchedule((current) => ({
      ...current,
      [dayOfWeek]: current[dayOfWeek].filter(
        (window) => window.clientKey !== clientKey
      ),
    }));
  }

  function saveSchedule(event) {
    event.preventDefault();
    const windows = ORDERING_DAYS.flatMap(({ dayOfWeek }) =>
      schedule[dayOfWeek].map(({ startTime, endTime }) => ({
        dayOfWeek,
        startTime,
        endTime,
      }))
    );
    mutate({ action: ORDERING_ADMIN_ACTION.SAVE_SCHEDULE, windows });
  }

  function overridePayload(mode) {
    return {
      action: ORDERING_ADMIN_ACTION.SET_OVERRIDE,
      mode,
      expiresAt,
    };
  }

  return (
    <div className="admin-operations">
      <StatusPanel operations={initialOperations} />

      <p
        aria-live="polite"
        className={feedback.ok === false ? "admin-inline-error" : "admin-operations-feedback"}
        role="status"
      >
        {feedback.message}
      </p>

      <section aria-labelledby="weekly-schedule-heading" className="admin-operations-panel">
        <div className="admin-operations-panel__heading">
          <div>
            <p className="admin-section-eyebrow">Regular hours</p>
            <h2 id="weekly-schedule-heading">Weekly ordering schedule</h2>
          </div>
          <p>Each window uses Africa/Accra time. Adjacent windows are allowed; overnight and overlapping windows are not.</p>
        </div>

        <form className="admin-schedule" onSubmit={saveSchedule}>
          {ORDERING_DAYS.map(({ dayOfWeek, label }) => (
            <fieldset className="admin-schedule-day" key={dayOfWeek}>
              <div className="admin-schedule-day__heading">
                <legend>{label}</legend>
                <span>{schedule[dayOfWeek].length ? `${schedule[dayOfWeek].length} window${schedule[dayOfWeek].length === 1 ? "" : "s"}` : "Closed"}</span>
              </div>
              <div className="admin-schedule-day__windows">
                {schedule[dayOfWeek].map((window, index) => (
                  <div className="admin-schedule-window" key={window.clientKey}>
                    <label className="form-field">
                      <span>{label} window {index + 1} start</span>
                      <input
                        disabled={pending}
                        onChange={(event) => updateWindow(dayOfWeek, window.clientKey, "startTime", event.target.value)}
                        required
                        type="time"
                        value={window.startTime}
                      />
                    </label>
                    <label className="form-field">
                      <span>{label} window {index + 1} end</span>
                      <input
                        disabled={pending}
                        onChange={(event) => updateWindow(dayOfWeek, window.clientKey, "endTime", event.target.value)}
                        required
                        inputMode="numeric"
                        pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00"
                        placeholder="20:00"
                        type="text"
                        value={window.endTime}
                      />
                    </label>
                    <button
                      aria-label={`Remove ${label} window ${index + 1}`}
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
              <button
                className="button-link button-link--secondary"
                disabled={pending}
                onClick={() => addWindow(dayOfWeek)}
                type="button"
              >
                Add window
              </button>
            </fieldset>
          ))}
          <div className="admin-schedule__save">
            <button className="button-link button-link--primary" disabled={pending} type="submit">
              {pending ? "Saving…" : "Save Weekly Schedule"}
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="override-heading" className="admin-operations-panel">
        <div className="admin-operations-panel__heading">
          <div>
            <p className="admin-section-eyebrow">Temporary control</p>
            <h2 id="override-heading">Open or close now</h2>
          </div>
          <p>Overrides use the existing ordering precedence and can remain active until cleared or expire automatically.</p>
        </div>
        <label className="form-field admin-operations-expiry">
          <span>Optional expiry (Africa/Accra)</span>
          <input
            disabled={pending}
            onChange={(event) => setExpiresAt(event.target.value)}
            type="datetime-local"
            value={expiresAt}
          />
        </label>
        <div className="admin-operations-actions">
          <button
            className="button-link button-link--primary"
            disabled={pending}
            onClick={() => mutate(overridePayload("OPEN"))}
            type="button"
          >
            Open Now
          </button>
          <button
            className="button-link button-link--secondary"
            disabled={pending}
            onClick={() => setConfirmation({ type: "CLOSED", payload: overridePayload("CLOSED") })}
            type="button"
          >
            Close Now
          </button>
          <button
            className="cart-text-button"
            disabled={pending || initialOperations.setting.overrideMode === "NONE"}
            onClick={() => mutate({ action: ORDERING_ADMIN_ACTION.CLEAR_OVERRIDE })}
            type="button"
          >
            Clear Override
          </button>
        </div>
      </section>

      <section aria-labelledby="emergency-heading" className="admin-operations-panel admin-operations-panel--emergency">
        <div className="admin-operations-panel__heading">
          <div>
            <p className="admin-section-eyebrow">Emergency control</p>
            <h2 id="emergency-heading">New order emergency pause</h2>
          </div>
          <p>This affects new submissions only. It never cancels accepted orders or changes payments.</p>
        </div>
        {initialOperations.setting.emergencyPaused ? (
          <button
            className="button-link button-link--primary"
            disabled={pending}
            onClick={() => mutate({ action: ORDERING_ADMIN_ACTION.RESUME })}
            type="button"
          >
            Resume Ordering
          </button>
        ) : (
          <button
            className="button-link button-link--secondary"
            disabled={pending}
            onClick={() => setConfirmation({ type: ORDERING_ADMIN_ACTION.PAUSE, payload: { action: ORDERING_ADMIN_ACTION.PAUSE } })}
            type="button"
          >
            Pause New Orders
          </button>
        )}
      </section>

      {confirmation ? (
        <ConfirmationDialog
          action={confirmation}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => mutate(confirmation.payload)}
          pending={pending}
        />
      ) : null}
    </div>
  );
}
