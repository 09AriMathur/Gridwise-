import { CalendarClock, ChartLine, ChevronRight, Cloud, Factory, Leaf, Percent, Sparkles, TrendingDown, Zap } from "lucide-react";
import { fmtHour } from "../lib/time";
import type { MixHour } from "../lib/types";
import BacktestPanel from "../components/BacktestPanel";
import ForecastChart from "../components/ForecastChart";
import { MixBar, MixList } from "../components/MixBar";
import { IconChip, LEVEL_UI, Note, PageTitle, Panel, Stat } from "../components/common";
import { useGrid } from "../lib/grid";
import { fmtDayTime } from "../lib/time";

const STEPS = [
  { icon: Cloud, tone: "blue" as const, title: "Read the grid", text: "We pull your grid's carbon intensity forecast and energy mix from Electricity Maps." },
  { icon: CalendarClock, tone: "indigo" as const, title: "Find the window", text: "We check every start time that fits your deadline and available hours, and pick the cleanest." },
  { icon: Leaf, tone: "green" as const, title: "Act on time", text: "Smart devices start automatically. For everything else, we text you when it's time." },
];

export default function Insights() {
  const { forecast, now, error, mix, zoneName } = useGrid();
  const t = Date.now();
  const next24 = (forecast?.points ?? []).filter((p) => { const d = Date.parse(p.ts) - t; return d >= -3_600_000 && d < 86_400_000; });
  const cleanest = next24.length ? next24.reduce((a, b) => (b.intensity < a.intensity ? b : a)) : null;
  const dirtiest = next24.length ? next24.reduce((a, b) => (b.intensity > a.intensity ? b : a)) : null;
  const spread = cleanest && dirtiest && dirtiest.intensity > 0 ? Math.round((1 - cleanest.intensity / dirtiest.intensity) * 100) : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageTitle kicker={zoneName} title="Insights"
        sub="How clean the electricity will be over the next 24 hours." />

      {error && !forecast && <Note tone="warn">Forecast unavailable right now ({error}).</Note>}

      <div className="grid animate-rise-in grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={now ? LEVEL_UI[now.level].icon : Cloud} tone={now ? LEVEL_UI[now.level].tone : "gray"} label="Right Now"
          value={now ? `${Math.round(now.intensity)} g` : "–"} sub={now ? LEVEL_UI[now.level].text : ""} />
        <Stat icon={Leaf} tone="green" label="Cleanest" value={cleanest ? `${Math.round(cleanest.intensity)} g` : "–"} sub={cleanest ? fmtDayTime(cleanest.ts) : ""} />
        <Stat icon={Factory} tone="red" label="Dirtiest" value={dirtiest ? `${Math.round(dirtiest.intensity)} g` : "–"} sub={dirtiest ? fmtDayTime(dirtiest.ts) : ""} />
        <Stat icon={Percent} tone="indigo" label="Difference" value={spread !== null ? `${spread}%` : "–"} sub="less CO₂ per kWh" accent={spread !== null && spread > 0} />
      </div>

      <Panel title="Next 24 Hours" icon={ChartLine} tone="blue" className="animate-rise-in"
        right={<span className="text-footnote text-muted-foreground">gCO₂/kWh</span>}>
        {next24.length > 1 ? <ForecastChart points={next24} plan={null} /> : <p className="text-subheadline text-muted-foreground">Waiting for forecast data…</p>}
      </Panel>

      {mix && (
        <Panel title="What's Powering the Grid" icon={Zap} tone="orange" className="animate-rise-in"
          right={<span className="text-footnote text-muted-foreground">Right now · {mix.zoneName}</span>} rightOnMobile={false}>
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-footnote font-semibold uppercase tracking-[0.02em] text-success">Low-carbon</p>
                <p className="font-rounded text-[34px] font-bold leading-[41px] tabular-nums">{Math.round(mix.now.lowCarbonPct)}%</p>
                <p className="text-footnote text-muted-foreground">
                  {Math.round(mix.now.fossilPct)}% fossil · {Math.round(mix.now.importsPct)}% imported
                </p>
              </div>
              {mix.forecast.length > 1 && <LowCarbonSpark hours={mix.forecast} />}
            </div>
            <MixBar mix={mix.now} legend={false} height="h-4" />
            <MixList mix={mix.now} />
          </div>
        </Panel>
      )}

      <BacktestPanel />

      <Panel title="How It Works" icon={Sparkles} tone="violet" className="animate-rise-in">
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {STEPS.map(({ icon, tone, title, text }, i) => (
            <li key={title} className="rounded-xl bg-secondary/70 p-4">
              <div className="flex items-center justify-between">
                <IconChip icon={icon} tone={tone} className="size-10" />
                <span className="text-footnote font-semibold text-muted-foreground">Step {i + 1}</span>
              </div>
              <p className="text-headline mt-3">{title}</p>
              <p className="text-subheadline mt-1 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <a href="#/" className="animate-rise-in flex items-center gap-3 rounded-2xl bg-card p-4 transition-opacity active:opacity-70">
        <IconChip icon={TrendingDown} tone="green" className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="text-headline">Shift heavy appliances, skip the battery</p>
          <p className="text-subheadline text-muted-foreground">Running them in the cleanest hours cuts their emissions.</p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-tertiary-foreground" strokeWidth={2.5} aria-hidden="true" />
      </a>
    </div>
  );
}

// Next 24 hours of low-carbon share, as small bars (taller = cleaner mix).
function LowCarbonSpark({ hours }: { hours: MixHour[] }) {
  const next = hours.slice(0, 24);
  const best = next.reduce((a, b) => (b.lowCarbonPct > a.lowCarbonPct ? b : a));
  return (
    <div className="min-w-0">
      <p className="text-footnote mb-1 text-right text-muted-foreground">
        Next 24 h · cleanest mix {fmtHour(Date.parse(best.ts))} ({Math.round(best.lowCarbonPct)}%)
      </p>
      <div className="flex h-10 items-end justify-end gap-[2px]" role="img" aria-label="Low-carbon share over the next 24 hours">
        {next.map((h) => (
          <span key={h.ts} className="w-1.5 rounded-t-[2px] bg-success" title={`${fmtHour(Date.parse(h.ts))}: ${Math.round(h.lowCarbonPct)}% low-carbon`}
            style={{ height: `${Math.max(6, h.lowCarbonPct)}%`, opacity: h === best ? 1 : 0.45 }} />
        ))}
      </div>
    </div>
  );
}
