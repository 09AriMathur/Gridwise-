import { useCallback, useEffect, useState } from "react";

// What the user pays for electricity. Electricity Maps has no retail (or even
// day-ahead) price data for ISO-NE, so this comes from the user's own bill.
// Shifting a run only changes the bill on a time-of-use plan.
export type RatePlan =
  | { kind: "flat"; rate: number; confirmed: boolean }
  | {
      kind: "tou";
      peak: number;        // $/kWh during peak hours
      offPeak: number;     // $/kWh the rest of the time
      peakStart: string;   // "HH:MM", local time
      peakEnd: string;     // "HH:MM"; may be earlier than peakStart for overnight peaks
      weekdaysOnly: boolean;
      confirmed: boolean;
    };

// Until the user enters their own numbers, costs use this placeholder and the
// UI says so. It is not a quoted Massachusetts rate.
export const PLACEHOLDER_PLAN: RatePlan = { kind: "flat", rate: 0.3, confirmed: false };
export const TOU_TEMPLATE = { peak: 0.4, offPeak: 0.22, peakStart: "14:00", peakEnd: "19:00", weekdaysOnly: true };

const KEY = "gridwise.rates.v1";
const EVENT = "gridwise-rates";
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const okRate = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 5;

function isValidPlan(p: unknown): p is RatePlan {
  const x = p as RatePlan;
  if (!x || typeof x !== "object") return false;
  if (x.kind === "flat") return okRate(x.rate);
  return x.kind === "tou" && okRate(x.peak) && okRate(x.offPeak)
    && HHMM.test(x.peakStart) && HHMM.test(x.peakEnd) && typeof x.weekdaysOnly === "boolean";
}

function read(): RatePlan {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return isValidPlan(parsed) ? parsed : PLACEHOLDER_PLAN;
  } catch {
    return PLACEHOLDER_PLAN;
  }
}

function write(plan: RatePlan) {
  try { localStorage.setItem(KEY, JSON.stringify(plan)); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Replace the saved plan; null goes back to the placeholder. */
export function replacePlan(plan: RatePlan | null) {
  if (plan === null) { try { localStorage.removeItem(KEY); } catch { /* storage blocked */ } window.dispatchEvent(new Event(EVENT)); return; }
  write(plan);
}

export function useRates() {
  const [plan, setPlan] = useState<RatePlan>(read);
  useEffect(() => {
    const sync = () => setPlan(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const save = useCallback((p: RatePlan) => write({ ...p, confirmed: true }), []);
  return { plan, save };
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** $/kWh in force at a moment, in the browser's local time. */
export function rateAt(plan: RatePlan, ms: number): number {
  if (plan.kind === "flat") return plan.rate;
  const d = new Date(ms);
  const day = d.getDay();
  if (plan.weekdaysOnly && (day === 0 || day === 6)) return plan.offPeak;
  const m = d.getHours() * 60 + d.getMinutes();
  const s = minutesOf(plan.peakStart), e = minutesOf(plan.peakEnd);
  const inPeak = s <= e ? m >= s && m < e : m >= s || m < e; // second case: peak wraps past midnight
  return inPeak ? plan.peak : plan.offPeak;
}

const SLICE = 5 * 60_000;

/** Dollars for a run that draws `kwh` evenly from `start` to `end`. */
export function runCost(plan: RatePlan, start: number, end: number, kwh: number): number {
  const span = end - start;
  if (!(span > 0) || !(kwh > 0)) return 0;
  let dollars = 0;
  for (let t = start; t < end; t += SLICE) {
    const slice = Math.min(SLICE, end - t);
    dollars += kwh * (slice / span) * rateAt(plan, t + slice / 2);
  }
  return dollars;
}

/** What waiting for [start, end) saves versus starting now. Negative = costs more. */
export function moneySaved(plan: RatePlan, now: number, start: number, end: number, kwh: number): { now: number; window: number; saved: number } {
  const duration = end - start;
  const ifNow = runCost(plan, now, now + duration, kwh);
  const inWindow = runCost(plan, start, end, kwh);
  return { now: ifNow, window: inWindow, saved: ifNow - inWindow };
}

export function dollars(n: number): string {
  const abs = Math.abs(n);
  return `${n < 0 ? "−" : ""}$${abs < 10 ? abs.toFixed(2) : abs.toFixed(1)}`;
}

export function describePlan(plan: RatePlan): string {
  if (plan.kind === "flat") return `Flat ${dollars(plan.rate)}/kWh${plan.confirmed ? "" : " (placeholder)"}`;
  return `Time-of-use · peak ${dollars(plan.peak)} ${plan.peakStart}–${plan.peakEnd}${plan.weekdaysOnly ? " weekdays" : ""} · off-peak ${dollars(plan.offPeak)}`;
}
