import { useCallback, useEffect, useState } from "react";

import { useTasks, type LocalTask } from "./tasks";

// Credits reward running a task in the window we recommended. The rules mirror
// backend/src/credits.py: one credit per 10 g of CO2 avoided, rounded down.
// The running total is kept on this device, since the backend has no accounts.
export const GRAMS_PER_CREDIT = 10;

export type Level = { name: string; min: number };

export const LEVELS: Level[] = [
  { name: "Seedling", min: 0 },
  { name: "Sprout", min: 100 },
  { name: "Sapling", min: 500 },
  { name: "Oak", min: 2_000 },
  { name: "Old Growth", min: 10_000 },
];

/** Credits earned by avoiding `grams` of CO2. Rounds down; never negative. */
export function creditsFor(grams: number): number {
  if (!Number.isFinite(grams) || grams <= 0) return 0;
  return Math.floor(grams / GRAMS_PER_CREDIT);
}

export type Standing = {
  level: Level;
  next: Level | null;
  toNext: number | null;
  progress: number; // 0–1 through the current level; 1 at the top
};

export function levelFor(total: number): Standing {
  const level = [...LEVELS].reverse().find((l) => total >= l.min) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.min > total) ?? null;
  return {
    level,
    next,
    toNext: next ? next.min - total : null,
    progress: next ? (total - level.min) / (next.min - level.min) : 1,
  };
}

/**
 * Did this task actually run?
 *
 * A manual task the user never confirmed still reads as "done" once its window
 * passes, so liveStatus alone would pay out people who ignored the reminder.
 * Only an explicit turn-on, or a smart device that started itself, counts.
 */
export function earnedCredits(t: LocalTask, now = Date.now()): boolean {
  if (t.status === "cancelled") return false;
  if (t.status === "started" || t.status === "finished") return true;
  return t.smart && now >= Date.parse(t.start);
}

type Store = { total: number; awarded: string[] };

const EMPTY: Store = { total: 0, awarded: [] };

const KEY = "gridwise.credits.v1";
const EVENT = "gridwise-credits";

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return EMPTY;
    const total = Number((parsed as Store).total);
    const awarded = (parsed as Store).awarded;
    return {
      total: Number.isFinite(total) && total >= 0 ? total : 0,
      awarded: Array.isArray(awarded) ? awarded.filter((id) => typeof id === "string") : [],
    };
  } catch {
    return EMPTY;
  }
}

function write(store: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage full or blocked */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Clear the balance (demo resets). */
export function resetCredits() {
  write(EMPTY);
}

export function useCredits() {
  const [store, setStore] = useState<Store>(read);

  useEffect(() => {
    const sync = () => setStore(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Paying out twice is the easy bug here, so every award is keyed by task id
  // and the ids already paid are kept alongside the total.
  const award = useCallback((taskId: string, amount: number) => {
    const current = read();
    if (current.awarded.includes(taskId)) return false;
    write({ total: current.total + Math.max(0, amount), awarded: [...current.awarded, taskId] });
    return true;
  }, []);

  return { total: store.total, awarded: store.awarded, standing: levelFor(store.total), award, reset: resetCredits };
}

/**
 * Pays out tasks that have run. Mounted once in App, so every route credits the
 * same way and a smart device still earns without anyone tapping anything.
 */
export function useCreditAwards() {
  const { tasks } = useTasks();
  const { award } = useCredits();

  useEffect(() => {
    for (const task of tasks) {
      if (earnedCredits(task)) award(task.id, creditsFor(task.co2g));
    }
  }, [tasks, award]);
}
