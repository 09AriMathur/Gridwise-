import { useEffect, useMemo, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "../lib/api";
import { useDevices } from "../lib/devices";
import { dollars, moneySaved, useRates } from "../lib/rates";
import { fmtClock, grams } from "../lib/time";
import type { Backtest } from "../lib/types";
import { DEVICE_ICONS, DEVICE_TONES, Note, Panel, Row, Segmented, fieldCls, labelCls } from "./common";

const HABIT_KEY = "gridwise.habit.v1";
const FLEX_HOURS = 12;

function readHabit(): string {
  try { return localStorage.getItem(HABIT_KEY) || "18:00"; } catch { return "18:00"; }
}

/**
 * "If you'd followed GridWise": replays real history. Each device runs at the
 * user's usual time, or at GridWise's pick within the next 12 hours. CO₂ comes
 * from the backend; money is worked out here with the user's own rates.
 */
export default function BacktestPanel() {
  const { devices } = useDevices();
  const { plan: rates } = useRates();
  const [habit, setHabit] = useState(readHabit);
  const [days, setDays] = useState<"1" | "7">("1");
  const [data, setData] = useState<Backtest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tasks = useMemo(() => devices.map((d) => ({ id: d.id, kwh: d.kwh, duration_min: Math.round(d.hours * 60) })), [devices]);

  useEffect(() => {
    try { localStorage.setItem(HABIT_KEY, habit); } catch { /* storage blocked */ }
    const [h, m] = habit.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m) || !tasks.length) return;
    let cancelled = false;
    setBusy(true);
    const timer = setTimeout(() => {
      api.backtest({ tasks, habit_minutes: h * 60 + m, tz_offset_min: new Date().getTimezoneOffset(), flex_hours: FLEX_HOURS, days: days === "7" ? 7 : 1 })
        .then((r) => { if (!cancelled) { setData(r); setError(null); } })
        .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : "Couldn't replay history right now."); })
        .finally(() => { if (!cancelled) setBusy(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [habit, days, tasks]);

  // Money per run at the user's rates: cost at the habit time minus cost in GridWise's window.
  const runs = (data?.days ?? []).flatMap((d) => d.tasks);
  const moneyOf = (r: (typeof runs)[number]) => {
    const kwh = devices.find((d) => d.id === r.id)?.kwh ?? 0;
    return moneySaved(rates, Date.parse(r.habit_start), Date.parse(r.best_start), Date.parse(r.best_end), kwh).saved;
  };
  const totalMoney = runs.reduce((s, r) => s + Math.max(0, moneyOf(r)), 0);
  const latest = data?.days[0];
  const habitLabel = fmtClock(new Date(`2000-01-01T${habit}:00`).getTime());

  return (
    <Panel title="Savings Backtest" icon={History} tone="green" className="animate-rise-in"
      right={busy ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" /> : undefined}>
      <div className="space-y-4">
        <p className="text-subheadline text-muted-foreground">
          Replays the real grid: each device at your usual time vs. GridWise's pick within the next {FLEX_HOURS} hours.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Label htmlFor="habit" className={labelCls}>I usually run things at</Label>
            <Input id="habit" type="time" className={fieldCls} value={habit} onChange={(e) => setHabit(e.target.value)} />
          </div>
          <Segmented label="Period" className="w-64" value={days} onChange={setDays}
            options={[["1", "Last 24 Hours"], ["7", "This Week"]] as const} />
        </div>

        {error && <Note tone="error">{error}</Note>}

        {data && data.days_covered > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-success/10 p-3.5">
                <p className="text-footnote font-semibold text-success">CO₂ you'd have saved</p>
                <p className="font-rounded text-[28px] font-bold leading-[34px] tabular-nums">{grams(data.total_co2_saved_g)}</p>
                <p className="text-footnote text-muted-foreground">{data.days_covered === 1 ? "over one day" : `over ${data.days_covered} days`}</p>
              </div>
              <div className="rounded-xl bg-warning/10 p-3.5">
                <p className="text-footnote font-semibold text-warning">Money</p>
                <p className="font-rounded text-[28px] font-bold leading-[34px] tabular-nums">{dollars(totalMoney)}</p>
                <p className="text-footnote text-muted-foreground">
                  {rates.kind !== "tou" ? "Flat rate: timing doesn't change the bill"
                    : totalMoney < 0.005 ? "Both times fall in the same rate period" : "At your time-of-use rates"}
                </p>
              </div>
            </div>

            {latest && (
              <div className="-mx-4 sm:-mx-5">
                <p className="text-footnote px-4 pb-1 font-semibold uppercase tracking-[0.02em] text-muted-foreground sm:px-5">
                  {data.days_covered > 1 ? "Most recent day" : "Your devices"}
                </p>
                <ul>
                  {latest.tasks.map((r) => {
                    const device = devices.find((d) => d.id === r.id);
                    if (!device) return null;
                    const moved = r.best_start !== r.habit_start;
                    const money = moneyOf(r);
                    return (
                      <Row key={r.id} icon={DEVICE_ICONS[device.type] ?? DEVICE_ICONS.other} tone={DEVICE_TONES[device.type] ?? "gray"}
                        title={device.name}
                        subtitle={moved
                          ? `${fmtClock(Date.parse(r.habit_start))} → ${fmtClock(Date.parse(r.best_start))} · ${Math.round(r.habit_avg)} → ${Math.round(r.best_avg)} g/kWh`
                          : `${fmtClock(Date.parse(r.habit_start))} was already the cleanest time`}
                        right={
                          <div className="shrink-0 text-right">
                            <p className="text-subheadline font-semibold tabular-nums text-success">{moved ? `−${grams(r.co2_saved_g)}` : "—"}</p>
                            {money >= 0.005 && <p className="text-footnote tabular-nums text-muted-foreground">{dollars(money)}</p>}
                          </div>
                        } />
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}

        {data && data.days_covered === 0 && (
          <Note>
            Not enough history yet for a {habitLabel} habit: the API only keeps the last 24 hours.
            {data.next_ready ? ` The first replay is ready at ${fmtClock(Date.parse(data.next_ready))}${new Date(data.next_ready).toDateString() !== new Date().toDateString() ? " tomorrow" : ""}.` : ""} Or try a different time.
          </Note>
        )}

        {data && days === "7" && data.days_covered < 7 && (
          <p className="text-footnote text-muted-foreground">
            Collecting history · {data.days_covered} of 7 days. The backend saves the grid's history every hour while it's running.
          </p>
        )}
      </div>
    </Panel>
  );
}
