import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDayTime, fmtTime } from "../lib/time";
import type { ForecastPoint, Plan } from "../lib/types";

export default function ForecastChart({ points, plan }: { points: ForecastPoint[]; plan: Plan | null }) {
  const data = points.map((p) => ({ t: Date.parse(p.ts), v: p.intensity })).filter((d) => Number.isFinite(d.t));
  if (data.length < 2) return <p className="text-sm text-slate-500">Not enough forecast data to draw a chart.</p>;

  const x1 = plan ? Date.parse(plan.planned_start) : null;
  const x2 = plan ? Date.parse(plan.planned_end) : null;

  return (
    <figure className="text-slate-500">
      <div className="h-56 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]}
              tickFormatter={(t) => fmtTime(new Date(Number(t)).toISOString())}
              tick={{ fill: "currentColor", fontSize: 12 }} minTickGap={24} />
            <YAxis tick={{ fill: "currentColor", fontSize: 12 }} width={48} />
            <Tooltip
              labelFormatter={(t) => fmtDayTime(new Date(Number(t)).toISOString())}
              formatter={(value) => [`${Math.round(Number(value))} gCO₂/kWh`, "Carbon intensity"]}
            />
            {x1 !== null && x2 !== null && (
              <ReferenceArea x1={x1} x2={x2} fill="#10b981" fillOpacity={0.25} stroke="#047857" strokeOpacity={0.6} />
            )}
            <Area type="monotone" dataKey="v" stroke="#0f766e" fill="#14b8a6" fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs">
        Carbon intensity forecast for the next 24 hours{plan ? "; the shaded band is your recommended window" : ""}.
      </figcaption>
    </figure>
  );
}
