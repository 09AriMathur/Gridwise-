// Same rule as the backend optimizer, used when the server can't plan.
import type { ForecastPoint } from "./types";

const HOUR = 3_600_000;
const STEP = 15 * 60_000;

export type Span = { start: number; end: number };
export type ClientPlan = { start: number; end: number; best: number; baseline: number; co2g: number };
type P = { t: number; v: number };

export function toPoints(points: ForecastPoint[]): P[] {
  return points
    .map((p) => ({ t: Date.parse(p.ts), v: p.intensity }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v >= 0 && p.v <= 2000)
    .sort((a, b) => a.t - b.t);
}

// Time-weighted average intensity over [start, end); null if not fully covered by forecast hours.
export function avgIntensity(pts: P[], start: number, end: number): number | null {
  let total = 0, covered = 0;
  for (const p of pts) {
    const s = Math.max(start, p.t), e = Math.min(end, p.t + HOUR);
    if (e > s) { total += p.v * (e - s); covered += e - s; }
  }
  if (end <= start || covered < end - start - 1000) return null;
  return total / covered;
}

export function findBestWindow(
  points: ForecastPoint[], durationMs: number, deadline: number, spans: Span[], now: number, kwh: number,
): ClientPlan | null {
  const pts = toPoints(points);
  let best: { s: number; v: number } | null = null;
  let baseline: number | null = null;
  for (let s = Math.ceil(now / STEP) * STEP; s + durationMs <= deadline; s += STEP) {
    const e = s + durationMs;
    if (!spans.some((w) => s >= w.start && e <= w.end)) continue;
    const v = avgIntensity(pts, s, e);
    if (v === null) continue;
    if (baseline === null) baseline = v;
    if (!best || v < best.v) best = { s, v };
  }
  if (!best || baseline === null) return null;
  return {
    start: best.s, end: best.s + durationMs, best: best.v, baseline,
    co2g: Math.max(0, kwh * (baseline - best.v)),
  };
}

// Bottom third of the next day = low, top third = high.
// Cut-offs between low/moderate/high: the day's terciles, or fixed values
// when there's too little data to rank.
export function levelThresholds(all: number[]): { low: number; high: number } {
  if (all.length < 3) return { low: 200, high: 320 };
  const sorted = [...all].sort((a, b) => a - b);
  return { low: sorted[Math.floor(sorted.length / 3)], high: sorted[Math.floor((sorted.length * 2) / 3)] };
}

export function levelOf(value: number, all: number[]): "low" | "moderate" | "high" {
  const { low, high } = levelThresholds(all);
  if (all.length < 3) return value < low ? "low" : value < high ? "moderate" : "high";
  return value <= low ? "low" : value >= high ? "high" : "moderate";
}
