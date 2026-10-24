import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { avgIntensity, levelOf, toPoints } from "../lib/optimizer";
import { fmtClock, fmtHour, grams } from "../lib/time";
import type { ForecastPoint, Level } from "../lib/types";

const HOUR = 3_600_000;

// Same tercile split as the "Grid now" pill. iOS system colours per level; the
// best window is the app tint, like a highlighted range in the Health app.
const LEVEL_BAR: Record<Level, string> = { low: "bg-success", moderate: "bg-warning", high: "bg-danger" };
const LEVEL_NAME: Record<Level, string> = { low: "Low", moderate: "Moderate", high: "High" };
const LEVEL_TEXT: Record<Level, string> = { low: "text-success", moderate: "text-warning", high: "text-danger" };

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

  if (bars.length < 2) return <p className="text-subheadline text-muted-foreground">Not enough forecast data to draw the chart yet.</p>;

  const values = bars.map((b) => b.v);
  const max = Math.max(...values), min = Math.min(...values);
  const height = (v: number) => 14 + (86 * (v - min)) / (max - min || 1);
  const deadlineIdx = deadline ? bars.findIndex((b) => b.t >= deadline) : -1;
  const inWindow = (t: number) => !!win && t < win.end && t + HOUR > win.start;

  const sel = selected !== null ? bars.find((b) => b.t === selected) : undefined;
  const altAvg = sel && win ? avgIntensity(pts, sel.t, sel.t + win.durationMs) : null;
  const now = bars[0];

  // Health-style summary above the chart: the selection, else the best window, else now.
  const summary = sel
    ? { caption: LEVEL_NAME[levelOf(sel.v, values)], value: Math.round(sel.v), range: fmtHour(sel.t), tone: LEVEL_TEXT[levelOf(sel.v, values)] }
    : win
      ? { caption: "Best window", value: Math.round(win.best), range: `${fmtClock(win.start)} – ${fmtClock(win.end)}`, tone: "text-primary" }
      : { caption: "Now", value: Math.round(now.v), range: fmtHour(now.t), tone: LEVEL_TEXT[levelOf(now.v, values)] };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div aria-live="polite">
          <p className={cn("text-footnote font-semibold uppercase tracking-[0.02em]", summary.tone)}>{summary.caption}</p>
          <p className="font-rounded text-[28px] font-bold leading-[34px] tabular-nums">
            {summary.value}<span className="ml-1 text-[15px] font-semibold text-muted-foreground">g/kWh</span>
          </p>
          <p className="text-footnote text-muted-foreground">{summary.range}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-footnote text-muted-foreground">
          {(["low", "moderate", "high"] as Level[]).map((l) => (
            <span key={l} className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", LEVEL_BAR[l])} />{LEVEL_NAME[l]}</span>
          ))}
          {win && <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Best window</span>}
        </div>
      </div>

      <div className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-1">
        <div className="relative flex min-w-[560px] items-end gap-[3px] pt-7" style={{ height: 220 }}>
          {[0, 50, 100].map((y) => (
            <div key={y} className="pointer-events-none absolute inset-x-0 border-t-[0.5px] border-border" style={{ bottom: `calc(${y}% * 0.86 + 22px)` }} />
          ))}
          {bars.map((b, i) => {
            const inWin = inWindow(b.t);
            const late = deadline !== null && b.t >= deadline;
            const isSel = selected === b.t;
            const level = levelOf(b.v, values);
            // While inspecting one bar, the rest step back (Apple Charts selection).
            const dim = (sel && !isSel) || late;
            return (
              <div key={b.t} className="relative flex h-full min-w-[20px] flex-1 flex-col items-center justify-end">
                {i === deadlineIdx && (
                  <div className="pointer-events-none absolute -left-px bottom-[22px] top-0 z-10 border-l-[1.5px] border-dashed border-danger">
                    <span className="text-caption-2 absolute -top-0.5 left-1 whitespace-nowrap font-semibold text-danger">Deadline {fmtClock(deadline!)}</span>
                  </div>
                )}
                <div className="flex w-full flex-1 items-end justify-center">
                  <button type="button" onClick={() => onSelect(isSel ? null : b.t)}
                    aria-label={`${fmtHour(b.t)}: ${Math.round(b.v)} grams CO2 per kilowatt hour, ${LEVEL_NAME[level]}${inWin ? ", in best window" : ""}`}
                    aria-pressed={isSel}
                    className={cn("w-[70%] max-w-6 rounded-t-[5px] rounded-b-[2px] transition-[height,opacity] duration-500 ease-ios focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40",
                      inWin ? "bg-primary" : LEVEL_BAR[level], dim ? "opacity-30" : inWin || isSel ? "opacity-100" : "opacity-75")}
                    style={{ height: `${height(b.v) * 0.86}%` }} />
                </div>
                <span className={cn("text-caption-2 mt-1.5 h-4 tabular-nums", isSel || inWin ? "font-semibold text-foreground" : "text-muted-foreground",
                  i % 2 && bars.length > 14 && "invisible sm:visible")}>
                  {fmtHour(b.t)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-footnote mt-3 min-h-[36px] text-muted-foreground" aria-live="polite">
        {sel ? (
          <>
            {win && altAvg !== null ? (
              <>Starting at {fmtHour(sel.t)} averages {Math.round(altAvg)} g/kWh, {altAvg - win.best > 0.5
                ? <span className="font-semibold text-danger">{grams(win.kwh * (altAvg - win.best))} more CO₂ than the best window.</span>
                : <span className="font-semibold text-success">as clean as the best window.</span>}</>
            ) : win ? "There isn't enough forecast after this hour to finish the run." : "Tap the bar again to clear."}
          </>
        ) : "Lower bars mean cleaner electricity. Tap a bar to compare start times."}
      </p>
    </div>
  );
}
