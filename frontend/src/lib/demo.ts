// Demo data comes from src/data/demo-data.json, which is committed, so every
// device that runs the app gets the same sample data. Times in the file are
// relative ("4 minutes ago", "tomorrow 01:00") and are resolved when it loads;
// CO₂ and money are computed here with the same moneySaved() the app uses.
// Nothing here is real usage.
import data from "../data/demo-data.json";
import { replaceDevices, TYPE_PRESETS, type DeviceType, type HomeDevice } from "./devices";
import { replaceNotifications, type AppNotification } from "./notifications";
import { moneySaved, replacePlan, type RatePlan } from "./rates";
import { resetCredits } from "./credits";
import { replaceTasks, type LocalTask } from "./tasks";

type When = { minutesFromNow: number } | { day: number; time: string };

const SEEDED_KEY = "gridwise.demo.seeded.v1";
const H = 3_600_000;

function resolve(when: When, now: number): number {
  if ("minutesFromNow" in when) return now + when.minutesFromNow * 60_000;
  const [h, m] = when.time.split(":").map(Number);
  const d = new Date(now);
  d.setDate(d.getDate() + when.day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

export const DEMO_PLAN: RatePlan = { ...(data.rates as Omit<Extract<RatePlan, { kind: "tou" }>, "confirmed">), confirmed: true };

function devices(): HomeDevice[] {
  return data.devices
    .filter((d) => d.type in TYPE_PRESETS)
    .map((d) => ({ ...d, type: d.type as DeviceType, simulated: true }));
}

export function loadDemo(now = Date.now()) {
  const list = devices();
  const tasks: LocalTask[] = data.tasks.flatMap((t) => {
    const device = list.find((d) => d.id === t.appliance);
    if (!device) return []; // a typo in the JSON shouldn't break the app
    const start = resolve(t.start as When, now);
    const end = start + t.hours * H;
    const plannedAt = resolve(t.plannedAt as When, now);
    return [{
      id: t.id, appliance: t.appliance, smart: device.smart,
      start: new Date(start).toISOString(), end: new Date(end).toISOString(),
      co2g: Math.round(device.kwh * (t.baseline - t.best) * 10) / 10, best: t.best, baseline: t.baseline,
      money: moneySaved(DEMO_PLAN, plannedAt, start, end, device.kwh).saved,
      status: t.status as LocalTask["status"], savedOn: "device", createdAt: new Date(plannedAt).toISOString(),
    }];
  });
  const notifications: AppNotification[] = data.notifications.map((n) => ({
    ...n, kind: n.kind as AppNotification["kind"], at: new Date(resolve(n.at as When, now)).toISOString(),
  }));

  replacePlan(DEMO_PLAN);
  replaceDevices(list);
  replaceNotifications(notifications, data.firedReminders);
  replaceTasks(tasks);
  markSeeded();
}

/** Back to a fresh install: default devices, no tasks, placeholder rate. Doesn't re-seed on reload. */
export function resetAll() {
  replaceTasks([]);
  replaceNotifications([]);
  replaceDevices(null);
  replacePlan(null);
  resetCredits();
  markSeeded();
}

function markSeeded() {
  try { localStorage.setItem(SEEDED_KEY, new Date().toISOString()); } catch { /* storage blocked */ }
}

/**
 * First time the app opens in a browser, fill it with the demo data so every
 * device starts with the same sample. Skipped if this browser already has its
 * own tasks or devices, if it was seeded or reset before, or if
 * VITE_DEMO_DATA=false.
 */
export function seedDemoOnFirstRun() {
  if (import.meta.env.VITE_DEMO_DATA === "false") return;
  try {
    if (localStorage.getItem(SEEDED_KEY)) return;
    const hasOwn = ["gridwise.tasks.v1", "gridwise.devices.v1"].some((k) => {
      const v = localStorage.getItem(k);
      return v !== null && v !== "[]";
    });
    if (hasOwn) { markSeeded(); return; }
  } catch {
    return; // storage blocked: nothing to seed into
  }
  loadDemo();
}
