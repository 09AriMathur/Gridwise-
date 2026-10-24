import { createContext, useContext, useMemo, type ReactNode } from "react";
import { api } from "./api";
import { levelOf } from "./optimizer";
import type { Forecast, Level } from "./types";
import { usePolling } from "./usePolling";

type Now = { intensity: number; level: Level; ts: string } | null;
type GridState = {
  forecast: Forecast | null;
  now: Now;
  error: string | null;
  errorStatus: number | null;
  loading: boolean;
  refresh: () => void;
};

const Ctx = createContext<GridState | null>(null);

// One shared forecast for every page, refreshed every 10 minutes.
export function GridProvider({ children }: { children: ReactNode }) {
  const f = usePolling(() => api.forecast(48), 10 * 60 * 1000);

  const now = useMemo<Now>(() => {
    const pts = f.data?.points ?? [];
    if (!pts.length) return null;
    const t = Date.now();
    const closest = pts.reduce((b, p) => (Math.abs(Date.parse(p.ts) - t) < Math.abs(Date.parse(b.ts) - t) ? p : b));
    const nextDay = pts.filter((p) => { const d = Date.parse(p.ts) - t; return d > -3_600_000 && d < 86_400_000; });
    return { intensity: closest.intensity, ts: closest.ts, level: levelOf(closest.intensity, nextDay.map((p) => p.intensity)) };
  }, [f.data]);

  const value: GridState = {
    forecast: f.data, now, error: f.error, errorStatus: f.errorStatus ?? null, loading: f.loading, refresh: f.refresh,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGrid(): GridState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGrid must be used inside GridProvider");
  return v;
}
