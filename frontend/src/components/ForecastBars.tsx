import { useMemo } from "react";
import { avgIntensity, toPoints } from "../lib/optimizer";
import { fmtClock, fmtHour, grams } from "../lib/time";
import type { ForecastPoint } from "../lib/types";

const HOUR = 3_600_000;

export type ChartWindow = { start: number; end: number; deadline: number; durationMs: number; kwh: number; best: number };

type Props = {
  points: ForecastPoint[];
  window: ChartWindow | null;
  previewDeadline: number | null;
  selected: number | null;
  onSelect: (t: number | null) => void;
};

export default function ForecastBars({ points, window: win, previewDeadline, selected, onSelect }: Props) {
  const pts = useMemo(() => toPoints(points), [points]);
  const deadline = win?.deadline ?? previewDeadline;
  const startH = Math.floor(Date.now() / HOUR) * HOUR;
  const endH = Math.min(startH + 24 * HOUR, deadline ? Math.max(deadline + 2 * HOUR, startH + 12 * HOUR) : startH + 24 * HOUR);
  const bars = pts.filter((p) => p.t >= startH && p.t < endH);

  if (bars.length < 2) return <p className="text-sm text-slate-400">Not enough forecast data to draw the chart yet.</p>;

  const values = bars.map((b) => b.v);
  const max = Math.max(...values), min = Math.min(...values);
  const height = (v: number) => 22 + (78 * (v - min)) / (max - min || 1);
  const deadlineIdx = deadline ? bars.findIndex((b) => b.t >= deadline) : -1;

  const sel = selected !== null ? bars.find((b) => b.t === selected) : undefined;
  const altAvg = sel && win ? avgIntensity(pts, sel.t, sel.t + win.durationMs) : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />Chosen window</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />Before deadline</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-600" />After deadline</span>
        <span className="ml-auto hidden sm:inline">Tap a bar to compare start times</span>
      </div>

      <div className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-1">
        <div className="relative flex min-w-[560px] items-end gap-1.5 pt-7 sm:gap-2" style={{ height: 230 }}>
          {bars.map((b, i) => {
            const inWin = !!win && b.t < win.end && b.t + HOUR > win.start;
            const late = deadline !== null && b.t >= deadline;
            const isSel = selected === b.t;
            const color = inWin ? "bg-emerald-400 hover:bg-emerald-300" : late ? "bg-slate-600 hover:bg-slate-500" : "bg-slate-400/80 hover:bg-slate-300";
            return (
              <div key={b.t} className="relative flex h-full min-w-[26px] flex-1 flex-col items-center justify-end">
                {i === deadlineIdx && (
                  <div className="pointer-events-none absolute -left-1 top-0 bottom-6 border-l-2 border-dashed border-orange-400 sm:-left-[5px]">
                    <span className="absolute -top-6 left-1 whitespace-nowrap text-xs font-semibold text-orange-300">
                      Deadline {fmtClock(deadline!)}
                    </span>
                  </div>
                )}
                <button type="button" onClick={() => onSelect(isSel ? null : b.t)}
                  aria-label={`${fmtHour(b.t)}: ${Math.round(b.v)} grams CO2 per kilowatt hour${inWin ? ", in chosen window" : ""}`}
                  aria-pressed={isSel}
                  className={`w-full rounded-t-md transition-all duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${color} ${isSel ? "ring-2 ring-white" : ""}`}
                  style={{ height: `calc(${height(b.v)}% - 24px)` }} />
                <span className={`mt-2 h-4 text-[11px] sm:text-xs ${isSel ? "font-semibold text-white" : "text-slate-400"} ${i % 2 && bars.length > 14 ? "invisible sm:visible" : ""}`}>
                  {fmtHour(b.t)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 min-h-[44px]" aria-live="polite">
        {sel ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
            <span className="font-semibold text-white">{fmtHour(sel.t)}</span>: {Math.round(sel.v)} gCO₂/kWh.
            {win && altAvg !== null && (
              <> Starting then averages {Math.round(altAvg)} g/kWh,{" "}
                {altAvg - win.best > 0.5
                  ? <span className="text-orange-300">{grams(win.kwh * (altAvg - win.best))} more CO₂ than the best window.</span>
                  : <span className="text-emerald-300">as clean as the best window.</span>}
              </>
            )}
            {win && altAvg === null && <> There isn't enough forecast after this hour to finish the run.</>}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Lower bars mean cleaner electricity.</p>
        )}
      </div>
    </div>
  );
}
