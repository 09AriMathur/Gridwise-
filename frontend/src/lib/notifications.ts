import { useCallback, useEffect, useState } from "react";
import type { HomeDevice } from "./devices";
import type { LocalTask } from "./tasks";
import { fmtClock } from "./time";

// Reminders for manual (non-smart) devices: "turn it on" when the clean window
// starts and "turn it off" when it ends. Delivered as browser notifications
// (Notifications API) plus an in-app inbox. GridWise has to be open in a tab,
// background is fine; nothing is sent while the browser is closed.

export type ReminderKind = "on" | "off";

export type AppNotification = {
  id: string;            // `${taskId}:${kind}` for reminders, so each fires once
  taskId: string | null;
  kind: ReminderKind | "test";
  title: string;
  body: string;
  at: string;            // ISO time it was raised
  read: boolean;
};

const KEY = "gridwise.notifications.v1";
const FIRED_KEY = "gridwise.reminders.fired.v1"; // survives clearing the inbox
const EVENT = "gridwise-notifications";
const MAX_ITEMS = 50;

// A reminder raised late (the tab was closed at the time) is still useful for
// a while; after this it's skipped rather than shown hours out of date.
export const LATE_ON_LIMIT = 30 * 60_000;
export const LATE_OFF_LIMIT = 2 * 3_600_000;

function readList(): AppNotification[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((n) => n && typeof n.id === "string" && typeof n.title === "string") : [];
  } catch {
    return [];
  }
}

function writeList(list: AppNotification[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ITEMS))); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(EVENT));
}

function readFired(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(FIRED_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writeFired(fired: Set<string>) {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify([...fired].slice(-500))); } catch { /* storage blocked */ }
}

/** Replace the inbox and the fired-reminder record (demo data, resets). */
export function replaceNotifications(list: AppNotification[], fired: string[] = []) {
  writeFired(new Set(fired));
  writeList(list);
}

export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>(readList);
  useEffect(() => {
    const sync = () => setItems(readList());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const markRead = useCallback((id: string) => writeList(readList().map((n) => (n.id === id ? { ...n, read: true } : n))), []);
  const markAllRead = useCallback(() => writeList(readList().map((n) => ({ ...n, read: true }))), []);
  const clear = useCallback(() => writeList([]), []);
  return { items, unread: items.filter((n) => !n.read).length, markRead, markAllRead, clear };
}

// ---- Browser permission -------------------------------------------------------

export type Permission = NotificationPermission | "unsupported";

export function permission(): Permission {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

export async function requestPermission(): Promise<Permission> {
  if (permission() === "unsupported") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return permission();
  }
}

export function usePermission() {
  const [state, setState] = useState<Permission>(permission);
  const ask = useCallback(async () => { const p = await requestPermission(); setState(p); return p; }, []);
  // The user can change it in browser settings while the tab is open.
  useEffect(() => {
    const onFocus = () => setState(permission());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  return { permission: state, ask };
}

// ---- Raising notifications ----------------------------------------------------

const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='7' fill='%236366f1'/%3E%3Cpath d='M13 2 4 14h7l-1 8 9-12h-7z' fill='%23ffffff'/%3E%3C/svg%3E";

function showSystem(n: AppNotification) {
  if (permission() !== "granted") return;
  try {
    const sys = new Notification(n.title, { body: n.body, tag: n.id, icon: ICON, requireInteraction: n.kind !== "test" });
    sys.onclick = () => { window.focus(); window.location.hash = "#/home"; sys.close(); };
  } catch {
    // Some mobile browsers only allow notifications from a service worker; the
    // in-app inbox and banner still show the reminder.
  }
}

export function raise(n: Omit<AppNotification, "at" | "read">): AppNotification {
  const full: AppNotification = { ...n, at: new Date().toISOString(), read: false };
  writeList([full, ...readList().filter((x) => x.id !== full.id)]);
  showSystem(full);
  return full;
}

export function sendTest() {
  return raise({
    id: `test:${Date.now()}`, taskId: null, kind: "test",
    title: "GridWise notifications are on",
    body: "You'll get a reminder when it's time to turn a device on or off.",
  });
}

export function reminderText(kind: ReminderKind, device: HomeDevice, task: LocalTask, now: number) {
  const start = Date.parse(task.start), end = Date.parse(task.end);
  if (kind === "on") {
    const late = now - start > 60_000 ? ` (window started at ${fmtClock(start)})` : "";
    return {
      title: `Turn on your ${device.name.toLowerCase()} now`,
      body: `The grid is at its cleanest until ${fmtClock(end)}${late}. Tap "I turned it on" in GridWise when it's running.`,
    };
  }
  return {
    title: `Turn off your ${device.name.toLowerCase()}`,
    body: `Its clean window ended at ${fmtClock(end)}. Switch it off if it's still running.`,
  };
}

/**
 * Which reminders are due right now. Pure, so it can be tested and called on a
 * timer. A manual task gets "on" once its window starts (unless the user
 * already turned it on) and "off" once it ends, only if they turned it on.
 */
export function dueReminders(tasks: LocalTask[], fired: Set<string>, now: number): { task: LocalTask; kind: ReminderKind; stale: boolean }[] {
  const out: { task: LocalTask; kind: ReminderKind; stale: boolean }[] = [];
  for (const t of tasks) {
    if (t.smart || t.status === "cancelled" || t.status === "finished") continue;
    const start = Date.parse(t.start), end = Date.parse(t.end);
    if (t.status === "scheduled" && now >= start && !fired.has(`${t.id}:on`)) {
      out.push({ task: t, kind: "on", stale: now >= end || now - start > LATE_ON_LIMIT });
    }
    if (t.status === "started" && now >= end && !fired.has(`${t.id}:off`)) {
      out.push({ task: t, kind: "off", stale: now - end > LATE_OFF_LIMIT });
    }
  }
  return out;
}

/** Check due reminders every 15 s and whenever the tab becomes visible. */
export function useReminderScheduler(tasks: LocalTask[], devices: HomeDevice[], onRaise?: (n: AppNotification, task: LocalTask) => void) {
  useEffect(() => {
    const check = () => {
      const fired = readFired();
      const now = Date.now();
      let changed = false;
      for (const { task, kind, stale } of dueReminders(tasks, fired, now)) {
        fired.add(`${task.id}:${kind}`);
        changed = true;
        if (stale) continue; // missed while closed; too late to be useful
        const device = devices.find((d) => d.id === task.appliance);
        if (!device) continue;
        const text = reminderText(kind, device, task, now);
        const n = raise({ id: `${task.id}:${kind}`, taskId: task.id, kind, ...text });
        onRaise?.(n, task);
      }
      if (changed) writeFired(fired);
    };
    check();
    const id = setInterval(check, 15_000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [tasks, devices, onRaise]);
}
