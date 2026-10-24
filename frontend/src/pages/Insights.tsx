import { CalendarClock, Cloud, Leaf, TrendingDown } from "lucide-react";
import ForecastChart from "../components/ForecastChart";
import { LEVEL_UI, Note, Panel } from "../components/ui";
import { useGrid } from "../lib/grid";
import { fmtDayTime } from "../lib/time";

export default function Insights() {
  const { forecast, now, error } = useGrid();
  const t = Date.now();
  const next24 = (forecast?.points ?? []).filter((p) => { const d = Date.parse(p.ts) - t; return d >= -3_600_000 && d < 86_400_000; });
  const cleanest = next24.length ? next24.reduce((a, b) => (b.intensity < a.intensity ? b : a)) : null;
  const dirtiest = next24.length ? next24.reduce((a, b) => (b.intensity > a.intensity ? b : a)) : null;
  const spread = cleanest && dirtiest && dirtiest.intensity > 0 ? Math.round((1 - cleanest.intensity / dirtiest.intensity) * 100) : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Grid insights</h1>
        <p className="mt-1 text-sm text-slate-400 sm:text-base">How clean New England's electricity will be over the next day.</p>
      </section>

      {error && !forecast && <Note tone="warn">Forecast unavailable right now ({error}).</Note>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Right now" value={now ? `${Math.round(now.intensity)} g` : "–"} sub={now ? LEVEL_UI[now.level].text : ""} />
        <Stat label="Cleanest hour" value={cleanest ? `${Math.round(cleanest.intensity)} g` : "–"} sub={cleanest ? fmtDayTime(cleanest.ts) : ""} good />
        <Stat label="Dirtiest hour" value={dirtiest ? `${Math.round(dirtiest.intensity)} g` : "–"} sub={dirtiest ? fmtDayTime(dirtiest.ts) : ""} />
        <Stat label="Clean vs dirty" value={spread !== null ? `${spread}%` : "–"} sub="less CO₂ per kWh" good />
      </div>

      <Panel title="Next 24 hours" right={<span className="text-xs text-slate-500">gCO₂/kWh</span>}>
        {next24.length > 1 ? <ForecastChart points={next24} plan={null} /> : <p className="text-sm text-slate-400">Waiting for forecast data…</p>}
      </Panel>

      <Panel title="How GridWise works">
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { icon: Cloud, title: "Read the grid", text: "We pull New England's carbon intensity forecast from Electricity Maps." },
            { icon: CalendarClock, title: "Find the window", text: "We check every start time that fits your deadline and available hours, and pick the cleanest." },
            { icon: Leaf, title: "Act at the right time", text: "Smart devices start automatically. For everything else, we text you when it's time." },
          ].map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <span className="text-xs text-slate-500">Step {i + 1}</span>
              </div>
              <p className="font-semibold text-white">{title}</p>
              <p className="mt-1 text-sm text-slate-400">{text}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <TrendingDown className="h-6 w-6 text-emerald-300" aria-hidden="true" />
            <p className="text-slate-200">Shifting heavy appliances to the cleanest hours cuts their emissions without buying a battery.</p>
          </div>
          <a href="#/" className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-emerald-400">Plan a task</a>
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value, sub, good = false }: { label: string; value: string; sub: string; good?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${good ? "text-emerald-300" : "text-white"}`}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>
    </div>
  );
}
