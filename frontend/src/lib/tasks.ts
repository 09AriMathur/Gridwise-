import { useCallback, useEffect, useState } from "react";

// Tasks are kept on this device too, so the UI works even before the backend has a tasks endpoint.
export type LocalTask = {
  id: string;
  appliance: string;
  smart: boolean;
  start: string;
  end: string;
  co2g: number;
  best: number;
  baseline: number;
  status: "scheduled" | "started" | "cancelled";
  savedOn: "server" | "device";
  createdAt: string;
};

export type LiveStatus = "scheduled" | "running" | "due" | "started" | "done" | "cancelled";

const KEY = "gridwise.tasks.v1";
const EVENT = "gridwise-tasks";

function read(): LocalTask[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isValidTask) : [];
  } catch {
    return [];
  }
}

function isValidTask(t: unknown): t is LocalTask {
  const x = t as LocalTask;
  return !!x && typeof x.id === "string" && typeof x.appliance === "string"
    && Number.isFinite(Date.parse(x.start)) && Number.isFinite(Date.parse(x.end))
    && Date.parse(x.end) > Date.parse(x.start) && Number.isFinite(Number(x.co2g));
}

function write(tasks: LocalTask[]) {
  try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch { /* storage full or blocked */ }
  window.dispatchEvent(new Event(EVENT));
}

export function liveStatus(t: LocalTask, now = Date.now()): LiveStatus {
  if (t.status === "cancelled") return "cancelled";
  const s = Date.parse(t.start), e = Date.parse(t.end);
  if (now >= e) return "done";
  if (t.status === "started") return "started";
  if (now >= s) return t.smart ? "running" : "due";
  return "scheduled";
}

export function useTasks() {
  const [tasks, setTasks] = useState<LocalTask[]>(read);
  const [, tick] = useState(0);

  useEffect(() => {
    const sync = () => setTasks(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    const id = setInterval(() => tick((n) => n + 1), 30_000); // re-evaluate live status
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
      clearInterval(id);
    };
  }, []);

  const add = useCallback((t: LocalTask) => write([t, ...read()]), []);
  const update = useCallback((id: string, patch: Partial<LocalTask>) =>
    write(read().map((t) => (t.id === id ? { ...t, ...patch } : t))), []);
  const clearFinished = useCallback(() =>
    write(read().filter((t) => !["done", "cancelled"].includes(liveStatus(t)))), []);

  return { tasks, add, update, clearFinished };
}
