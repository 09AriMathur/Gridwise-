// The ONLY file that knows backend URLs and response shapes.
import type { Appliance, Device, Forecast, GridNow, Level, Plan, Task, TaskInput } from "./types";

const BASE = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

// ===== EDIT HERE to match the backend =====
// null = the backend doesn't have this yet; the UI shows "coming soon" for it.
export const ROUTES = {
  health: "/health" as string | null,
  gridNow: null as string | null,                 // not built: derived from the forecast instead
  forecast: (hours: number) => `/api/forecast?hours=${hours}`,
  appliances: null as string | null,              // not built: form uses built-in presets
  devices: "/api/devices" as string | null,
  createDevice: null as string | null,           // not built yet: devices are saved in the browser
  tasks: null as string | null,                   // not built yet
  plan: "/api/schedule",
  createTask: "/api/schedule",
  task: null as ((id: number) => string) | null,
  started: null as ((id: number) => string) | null,
  snooze: null as ((id: number) => string) | null,
};
// ==========================================

export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  status: number;
  code?: string;
  fieldErrors: FieldError[];
  constructor(message: string, status: number, code?: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const notBuilt = (what: string) => Promise.reject(new ApiError(`${what} isn't available on the server yet.`, 404, "not_built"));

async function request<T>(path: string, options: RequestInit = {}, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers ?? {}) },
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      if (res.status === 404) detail = `Not connected yet: the server has no ${path.split("?")[0]} endpoint.`;
      else if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) detail = "Some fields need fixing.";
      const fieldErrors: FieldError[] = Array.isArray(body.errors) ? body.errors
        : Array.isArray(body.detail) ? body.detail.map((e: any) => ({
            field: (e.loc ?? []).filter((p: any) => p !== "body").join("."), message: String(e.msg ?? "") }))
        : [];
      throw new ApiError(detail, res.status, body.code, fieldErrors);
    }
    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new ApiError(
      aborted ? "The server took too long to respond." : "Can't reach the server. Is the backend running?",
      0, "network",
    );
  } finally {
    clearTimeout(timer);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function levelFrom(raw: any, intensity: number): Level {
  const v = String(raw ?? "").toLowerCase();
  if (v.startsWith("low") || v === "clean") return "low";
  if (v.startsWith("high") || v === "dirty") return "high";
  if (v.startsWith("mod")) return "moderate";
  return intensity < 200 ? "low" : intensity < 320 ? "moderate" : "high";
}

function mapGridNow(b: any): GridNow {
  const intensity = Number(b.intensity ?? b.intensity_g_per_kwh ?? b.carbonIntensity ?? b.carbon_intensity ?? 0);
  return {
    intensity,
    level: levelFrom(b.label ?? b.level, intensity),
    timestamp: b.timestamp ?? b.datetime ?? b.ts ?? new Date().toISOString(),
    source: b.source ?? "live",
  };
}

function mapForecast(b: any): Forecast {
  const rows: any[] = b.points ?? b.forecast ?? b.data ?? b.hours ?? (Array.isArray(b) ? b : []);
  return {
    source: b.source ?? b.forecast_source ?? "live",
    points: rows
      .map((p) => ({
        ts: p.ts ?? p.datetime ?? p.time ?? p.timestamp,
        intensity: Number(p.intensity ?? p.intensity_g_per_kwh ?? p.carbonIntensity ?? p.carbon_intensity),
      }))
      .filter((p) => p.ts && Number.isFinite(p.intensity))
      .sort((a, c) => Date.parse(a.ts) - Date.parse(c.ts)),
  };
}

// No grid-now endpoint yet: use the forecast point closest to the current time.
async function gridNowFromForecast(): Promise<GridNow> {
  const f = mapForecast(await request<any>(ROUTES.forecast(24)));
  if (!f.points.length) throw new ApiError("No grid data available yet.", 503, "no_data");
  const now = Date.now();
  const closest = f.points.reduce((best, p) =>
    Math.abs(Date.parse(p.ts) - now) < Math.abs(Date.parse(best.ts) - now) ? p : best);
  return { intensity: closest.intensity, level: levelFrom(null, closest.intensity), timestamp: closest.ts, source: f.source };
}

function mapPlan(b: any): Plan {
  return {
    id: b.id,
    planned_start: b.planned_start ?? b.start ?? b.start_time ?? b.best_start,
    planned_end: b.planned_end ?? b.end ?? b.end_time ?? b.best_end,
    avg_intensity_best: Number(b.avg_intensity_best ?? b.best_intensity ?? b.avg_intensity ?? 0),
    avg_intensity_now: Number(b.avg_intensity_now ?? b.now_intensity ?? b.baseline_intensity ?? 0),
    co2_avoided_g: Number(b.co2_avoided_g ?? b.co2_saved_g ?? b.co2_avoided ?? b.savings_g ?? 0),
    forecast_source: b.forecast_source ?? b.source ?? "live",
    status: b.status,
  };
}

export const api = {
  health: () => (ROUTES.health ? request<any>(ROUTES.health) : notBuilt("Health check")),
  gridNow: () => (ROUTES.gridNow ? request<any>(ROUTES.gridNow).then(mapGridNow) : gridNowFromForecast()),
  forecast: (hours = 24) => request<any>(ROUTES.forecast(hours)).then(mapForecast),
  appliances: () => (ROUTES.appliances
    ? request<any>(ROUTES.appliances).then((b) => (b.appliances ?? b) as Appliance[])
    : notBuilt("Appliance list")),
  devices: () => (ROUTES.devices
    ? request<any>(ROUTES.devices).then((b) => (b.devices ?? b) as Device[])
    : notBuilt("Devices")),
  createDevice: (d: unknown) => (ROUTES.createDevice
    ? request<unknown>(ROUTES.createDevice, { method: "POST", body: JSON.stringify(d) })
    : notBuilt("Adding devices")),
  tasks: () => (ROUTES.tasks
    ? request<any>(ROUTES.tasks).then((b) => (b.tasks ?? b) as Task[])
    : notBuilt("Scheduled tasks")),
  plan: (t: TaskInput) => request<any>(ROUTES.plan, { method: "POST", body: JSON.stringify(t) }).then(mapPlan),
  createTask: (t: TaskInput) => request<any>(ROUTES.createTask, { method: "POST", body: JSON.stringify(t) }).then(mapPlan),
  cancelTask: (id: number) => (ROUTES.task ? request<unknown>(ROUTES.task(id), { method: "DELETE" }) : notBuilt("Cancel")),
  markStarted: (id: number) => (ROUTES.started ? request<unknown>(ROUTES.started(id), { method: "POST" }) : notBuilt("Mark started")),
  snooze: (id: number) => (ROUTES.snooze ? request<unknown>(ROUTES.snooze(id), { method: "POST" }) : notBuilt("Snooze")),
};
