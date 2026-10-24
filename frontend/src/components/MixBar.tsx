import { cn } from "@/lib/utils";
import type { Mix, MixShare } from "../lib/types";

// One colour per source. Low-carbon sources get iOS system colours; fossil
// sources are grays, so a mostly-colourful bar reads as a clean grid at a glance.
export const SOURCE_COLOR: Record<string, string> = {
  nuclear: "var(--ios-purple)",
  wind: "var(--ios-teal)",
  solar: "var(--ios-yellow)",
  hydro: "var(--ios-blue)",
  biomass: "var(--ios-green)",
  geothermal: "#a2845e",
  storage: "var(--ios-indigo)",
  gas: "#8e8e93",
  coal: "#48484a",
  oil: "#6d5c4d",
  unknown: "#c7c7cc",
  imports: "#d1d1d6",
};

const colorOf = (s: MixShare) => SOURCE_COLOR[s.key] ?? "#c7c7cc";

/** Stacked bar of the mix, with an optional legend. */
export function MixBar({ mix, legend = true, className = "", height = "h-3" }: { mix: Mix; legend?: boolean; className?: string; height?: string }) {
  return (
    <div className={className}>
      <div className={cn("flex w-full overflow-hidden rounded-full bg-secondary", height)} role="img"
        aria-label={mix.sources.map((s) => `${s.label} ${Math.round(s.percent)}%`).join(", ")}>
        {mix.sources.filter((s) => s.percent >= 0.5).map((s) => (
          <span key={s.key} className="h-full transition-[width] duration-500 ease-ios first:rounded-l-full last:rounded-r-full"
            style={{ width: `${s.percent}%`, background: colorOf(s) }} />
        ))}
      </div>
      {legend && (
        <div className="text-footnote mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
          {mix.sources.filter((s) => s.percent >= 1).map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: colorOf(s) }} />
              {s.label} <span className="tabular-nums text-foreground">{Math.round(s.percent)}%</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Rows with a share bar each, like a "consumption by device" list. */
export function MixList({ mix }: { mix: Mix }) {
  return (
    <ul className="space-y-3">
      {mix.sources.map((s) => (
        <li key={s.key} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 sm:grid-cols-[6.5rem_1fr_auto]">
          <span className="text-subheadline flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(s) }} />
            {s.label}
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full rounded-full" style={{ width: `${Math.max(2, s.percent)}%`, background: colorOf(s) }} />
          </span>
          <span className="text-subheadline whitespace-nowrap text-right tabular-nums">
            {Math.round(s.percent)}% <span className="text-footnote text-muted-foreground">· {Math.round(s.mw).toLocaleString()} MW</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Why this window": the mix now vs. in the best window, with a sentence that
 * only claims what the numbers show. A lower carbon intensity doesn't always
 * mean more low-carbon power (imports and plant mix matter too).
 */
export function MixCompare({ now, best }: { now: Mix; best: Mix }) {
  const lowGain = best.lowCarbonPct - now.lowCarbonPct;
  const fossilDrop = now.fossilPct - best.fossilPct;
  const topNow = now.sources[0], topBest = best.sources[0];
  const line = lowGain >= 1
    ? `${Math.round(best.lowCarbonPct)}% low-carbon power vs ${Math.round(now.lowCarbonPct)}% now.`
    : fossilDrop >= 1
      ? `Less fossil power: ${Math.round(best.fossilPct)}% vs ${Math.round(now.fossilPct)}% now.`
      : `The mix is about the same as now (${Math.round(best.lowCarbonPct)}% low-carbon); the gain is small.`;
  return (
    <div className="space-y-3 rounded-xl bg-secondary/70 p-3.5">
      <p className="text-footnote font-semibold uppercase tracking-[0.02em] text-muted-foreground">Why this window</p>
      {[["Now", now, topNow], ["Best window", best, topBest]].map(([label, mix, top]) => (
        <div key={label as string}>
          <div className="text-footnote mb-1.5 flex justify-between">
            <span className={label === "Best window" ? "font-semibold text-primary" : "text-muted-foreground"}>{label as string}</span>
            <span className="tabular-nums text-muted-foreground">
              {Math.round((mix as Mix).lowCarbonPct)}% low-carbon{top ? ` · ${(top as MixShare).label} ${Math.round((top as MixShare).percent)}%` : ""}
            </span>
          </div>
          <MixBar mix={mix as Mix} legend={false} height="h-2.5" />
        </div>
      ))}
      <p className="text-subheadline">{line}</p>
    </div>
  );
}
