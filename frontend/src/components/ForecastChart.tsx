import { Area, AreaChart, CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { levelOf, levelThresholds } from "../lib/optimizer";
import { fmtDayTime, fmtTime } from "../lib/time";
import type { ForecastPoint, Level, Plan } from "../lib/types";
import { Meta } from "./common";

const tick = { fill: "currentColor", fontSize: 11, fontFamily: "var(--font-sans)" };
const LEVEL_VAR: Record<Level, string> = { low: "var(--success)", moderate: "var(--warning)", high: "var(--danger)" };

// A ringed dot coloured by its level, like the mockup's highlighted point.
function SquareDot({ cx, cy, payload, values }: { cx?: number; cy?: number; payload?: { v: number }; values: number[] }) {
  if (cx === undefined || cy === undefined || !payload) return null;
  return <circle cx={cx} cy={cy} r={6} fill={LEVEL_VAR[levelOf(payload.v, values)]} stroke="var(--popover)" strokeWidth={3} />;
}

// Colour bands, high at the top: a gradient over the shape's bounding box
// whose stops sit exactly on the low/high thresholds.
function BandGradient({ id, top, bottom, low, high, opacity = 1 }: {
  id: string; top: number; bottom: number; low: number; high: number; opacity?: number;
}) {
  const at = (v: number) => `${Math.min(100, Math.max(0, ((top - v) / (top - bottom || 1)) * 100))}%`;
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="var(--danger)" stopOpacity={opacity} />
      <stop offset={at(high)} stopColor="var(--danger)" stopOpacity={opacity} />
      <stop offset={at(high)} stopColor="var(--warning)" stopOpacity={opacity} />
      <stop offset={at(low)} stopColor="var(--warning)" stopOpacity={opacity} />
      <stop offset={at(low)} stopColor="var(--success)" stopOpacity={opacity} />
      <stop offset="100%" stopColor="var(--success)" stopOpacity={opacity} />
    </linearGradient>
  );
}

export default function ForecastChart({ points, plan }: { points: ForecastPoint[]; plan: Plan | null }) {
  const data = points.map((p) => ({ t: Date.parse(p.ts), v: p.intensity })).filter((d) => Number.isFinite(d.t));
  if (data.length < 2) return <Meta>Not enough forecast data to draw a chart.</Meta>;

  const values = data.map((d) => d.v);
  const max = Math.max(...values), min = Math.min(...values);
  const { low, high } = levelThresholds(values);
  // Start the axis just under the day's low so the swing is visible, not flattened against 0.
  const floor = Math.max(0, Math.floor((min - 20) / 10) * 10);
  // Explicit ticks so the axis can't round its floor below the fill's.
  const step = Math.max(5, Math.ceil((max + 10 - floor) / 4 / 5) * 5);
  const ticks = [0, 1, 2, 3, 4].map((i) => floor + i * step);
  const x1 = plan ? Date.parse(plan.planned_start) : null;
  const x2 = plan ? Date.parse(plan.planned_end) : null;

  return (
    <figure className="text-muted-foreground">
      <div className="text-footnote mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" />Low ≤ {Math.round(low)}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" />Moderate</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-danger" />High ≥ {Math.round(high)}</span>
      </div>
      <div className="h-56 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
            <defs>
              {/* The line's box spans min..max; the fill's box spans max..the axis floor. */}
              <BandGradient id="intensityStroke" top={max} bottom={min} low={low} high={high} />
              <BandGradient id="intensityFill" top={max} bottom={floor} low={low} high={high} opacity={0.12} />
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={0.5} />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]}
              tickFormatter={(t) => fmtTime(new Date(Number(t)).toISOString())}
              tick={tick} minTickGap={24} axisLine={false} tickLine={false} />
            <YAxis tick={tick} width={44} domain={[floor, ticks[4]]} ticks={ticks} axisLine={false} tickLine={false} orientation="right" />
            <ReferenceLine y={high} stroke="var(--danger)" strokeDasharray="3 3" strokeOpacity={0.6}
              label={{ value: "High", position: "insideTopLeft", fill: "var(--danger)", fontSize: 11, fontWeight: 600 }} />
            <ReferenceLine y={low} stroke="var(--success)" strokeDasharray="3 3" strokeOpacity={0.6}
              label={{ value: "Low", position: "insideBottomLeft", fill: "var(--success)", fontSize: 11, fontWeight: 600 }} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              contentStyle={{ background: "var(--popover)", border: "none", borderRadius: 12, color: "var(--popover-foreground)", fontSize: 13, fontFamily: "var(--font-sans)", boxShadow: "0 10px 40px rgb(0 0 0 / 0.16)", padding: "8px 12px" }}
              labelStyle={{ color: "var(--muted-foreground)" }}
              itemStyle={{ color: "var(--foreground)" }}
              labelFormatter={(t) => fmtDayTime(new Date(Number(t)).toISOString())}
              formatter={(value) => {
                const v = Number(value);
                return [`${Math.round(v)} gCO₂/kWh · ${levelOf(v, values)}`, "Intensity"];
              }}
            />
            {x1 !== null && x2 !== null && (
              <ReferenceArea x1={x1} x2={x2} fill="var(--primary)" fillOpacity={0.12} />
            )}
            <Area type="monotone" dataKey="v" baseValue={floor} stroke="url(#intensityStroke)" fill="url(#intensityFill)" strokeWidth={3} strokeLinecap="round"
              animationEasing="ease-out" animationDuration={700} activeDot={<SquareDot values={values} />} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-3">
        <Meta>Colour shows each hour's level compared with the rest of the day{plan ? "; the shaded band is your recommended window" : ""}.</Meta>
      </figcaption>
    </figure>
  );
}
