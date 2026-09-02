"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import useOperationalAutoRefresh from "@/components/operations/useOperationalAutoRefresh";

const EMPTY_SNAPSHOT = { notifications: [], unreadCount: 0 };
const subscribeToNoExternalEvents = () => () => {};

function formatNotificationTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Recently";

  const elapsedSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(elapsedSeconds) < 60) return formatter.format(elapsedSeconds, "second");
  const minutes = Math.round(elapsedSeconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return formatter.format(days, "day");
  return date.toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function playOperationalTone() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(660, context.currentTime);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.24);
  oscillator.addEventListener("ended", () => context.close().catch(() => {}), {
    once: true,
  });
}

async function updateReadState(payload) {
  const response = await fetch("/api/notifications", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Notification update failed.");
  return response.json();
}

export default function NotificationBell({
  initialSnapshot = EMPTY_SNAPSHOT,
  toastTypes = [],
  soundTypes = [],
  soundPreferenceKey = null,
  variant = "customer",
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [soundOverride, setSoundOverride] = useState(null);
  const storedSoundEnabled = useSyncExternalStore(
    subscribeToNoExternalEvents,
    () => Boolean(soundPreferenceKey) && window.localStorage.getItem(soundPreferenceKey) === "on",
    () => false
  );
  const soundEnabled = soundOverride ?? storedSoundEnabled;
  const rootRef = useRef(null);
  const seenIdsRef = useRef(
    new Set(initialSnapshot.notifications.map((notification) => notification.id))
  );
  const toastTypesRef = useRef(new Set(toastTypes));
  const soundTypesRef = useRef(new Set(soundTypes));

  useEffect(() => {
    if (!open) return undefined;

    function closeOnOutsidePointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector("button")?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(null), 5_000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const refreshNotifications = useCallback(async () => {
    const response = await fetch("/api/notifications", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Notification refresh failed.");
    const next = await response.json();
    if (!next.ok) throw new Error("Notification refresh failed.");

    const newlyObserved = next.notifications
      .filter((notification) => !seenIdsRef.current.has(notification.id))
      .reverse();
    next.notifications.forEach((notification) =>
      seenIdsRef.current.add(notification.id)
    );

    const newestToast = newlyObserved
      .slice()
      .reverse()
      .find((notification) => toastTypesRef.current.has(notification.type));
    if (newestToast) setToast(newestToast);

    if (
      soundEnabled &&
      newlyObserved.some((notification) =>
        soundTypesRef.current.has(notification.type)
      )
    ) {
      try {
        playOperationalTone();
      } catch {
        // Visual notifications remain available when browser audio is blocked.
      }
    }

    setSnapshot({
      notifications: next.notifications,
      unreadCount: next.unreadCount,
    });
  }, [soundEnabled]);

  useOperationalAutoRefresh({ enabled: true, refresh: refreshNotifications });

  function applySnapshot(next) {
    if (!next?.ok) return;
    next.notifications.forEach((notification) => seenIdsRef.current.add(notification.id));
    setSnapshot({
      notifications: next.notifications,
      unreadCount: next.unreadCount,
    });
  }

  async function markAllRead() {
    setSnapshot((current) => ({
      unreadCount: 0,
      notifications: current.notifications.map((notification) => ({
        ...notification,
        readAt: notification.readAt || new Date().toISOString(),
      })),
    }));
    try {
      applySnapshot(await updateReadState({ action: "MARK_ALL_READ" }));
    } catch {
      await refreshNotifications().catch(() => {});
    }
  }

  async function openNotification(event, notification) {
    if (!notification.href?.startsWith("/")) return;
    event.preventDefault();
    setOpen(false);
    if (!notification.readAt) {
      setSnapshot((current) => ({
        unreadCount: Math.max(0, current.unreadCount - 1),
        notifications: current.notifications.map((item) =>
          item.id === notification.id
            ? { ...item, readAt: new Date().toISOString() }
            : item
        ),
      }));
      try {
        applySnapshot(
          await updateReadState({
            action: "MARK_READ",
            notificationId: notification.id,
          })
        );
      } catch {
        // Navigation is still safe; the next poll reconciles unread state.
      }
    }
    router.push(notification.href);
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundOverride(next);
    if (soundPreferenceKey) {
      window.localStorage.setItem(soundPreferenceKey, next ? "on" : "off");
    }
    if (next) {
      try {
        playOperationalTone();
      } catch {
        // The visible notification center remains the fallback.
      }
    }
  }

  const badge = snapshot.unreadCount > 99 ? "99+" : String(snapshot.unreadCount);
  const label = snapshot.unreadCount
    ? `Notifications, ${snapshot.unreadCount} unread`
    : "Notifications";

  return (
    <div className={`notification-bell notification-bell--${variant}`} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        className="notification-bell__button"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {snapshot.unreadCount > 0 ? (
          <span aria-hidden="true" className="notification-bell__badge">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          aria-label="Notifications"
          className="notification-center"
          role="dialog"
        >
          <header className="notification-center__header">
            <div>
              <p className="notification-center__eyebrow">Updates</p>
              <h2>Notifications</h2>
            </div>
            {snapshot.unreadCount > 0 ? (
              <button className="notification-center__text-button" onClick={markAllRead} type="button">
                Mark all read
              </button>
            ) : null}
          </header>

          {soundPreferenceKey ? (
            <button
              aria-pressed={soundEnabled}
              className="notification-center__sound"
              onClick={toggleSound}
              type="button"
            >
              <span>Sound alerts</span>
              <strong>{soundEnabled ? "On" : "Off"}</strong>
            </button>
          ) : null}

          {snapshot.notifications.length ? (
            <ul className="notification-list">
              {snapshot.notifications.map((notification) => (
                <li
                  className={notification.readAt ? "" : "notification-list__item--unread"}
                  key={notification.id}
                >
                  {notification.href ? (
                    <Link
                      className="notification-list__link"
                      href={notification.href}
                      onClick={(event) => openNotification(event, notification)}
                    >
                      <strong>{notification.title}</strong>
                      <span>{notification.message}</span>
                      <time dateTime={notification.createdAt}>
                        {formatNotificationTime(notification.createdAt)}
                      </time>
                    </Link>
                  ) : (
                    <div className="notification-list__link">
                      <strong>{notification.title}</strong>
                      <span>{notification.message}</span>
                      <time dateTime={notification.createdAt}>
                        {formatNotificationTime(notification.createdAt)}
                      </time>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="notification-center__empty">No notifications yet.</p>
          )}
        </section>
      ) : null}

      {toast ? (
        <div
          aria-atomic="true"
          aria-live="polite"
          className={`notification-toast notification-toast--${variant}`}
          role="status"
        >
          <strong>{toast.title}</strong>
          <span>{toast.message}</span>
        </div>
      ) : null}
    </div>
  );
}
