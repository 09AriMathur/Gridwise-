import { useMemo, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import ForecastBars, { type ChartWindow } from "../components/ForecastBars";
import DevicesRow from "../components/DevicesRow";
import DeviceDialog from "../components/DeviceDialog";
import { Note, Panel, Toggle, fieldCls, labelCls } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { deviceById, useDevices } from "../lib/devices";
import { useGrid } from "../lib/grid";
import { avgIntensity, findBestWindow, toPoints } from "../lib/optimizer";
import { liveStatus, useTasks } from "../lib/tasks";
import { dailySpan, fmtClock, grams, nextAt } from "../lib/time";
import type { TaskInput } from "../lib/types";

type Result = ChartWindow & {
  baseline: number; co2g: number; via: "server" | "browser"; note?: string;
  smart: boolean; applianceId: string; phone: string | null; input: TaskInput;
};

const HOUR = 3_600_000;

export default function Dashboard() {
  const grid = useGrid();
  const { tasks, add } = useTasks();
  const { devices, add: addDevice } = useDevices();
  const [adding, setAdding] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const [applianceId, setApplianceId] = useState(() => devices[0]?.id ?? "");
  const [hours, setHours] = useState(() => String(devices[0]?.hours ?? 1));
  const [kwh, setKwh] = useState(() => String(devices[0]?.kwh ?? 1));
  const [deadline, setDeadline] = useState("07:00");
  const [smart, setSmart] = useState(() => devices[0]?.smart ?? false);
  const [from, setFrom] = useState("21:00");
  const [until, setUntil] = useState("23:30");
  const [phone, setPhone] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [failMsg, setFailMsg] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<"no" | "saving" | "server" | "device">("no");
  const [selectedBar, setSelectedBar] = useState<number | null>(null);

  const appliance = deviceById(devices, applianceId);
  const previewDeadline = useMemo(() => nextAt(deadline, Date.now()), [deadline]);

  function pick(id: string) {
    const a = deviceById(devices, id);
    setApplianceId(a.id); setHours(String(a.hours)); setKwh(String(a.kwh)); setSmart(a.smart);
    setResult(null); setScheduled("no"); setErrors({});
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function validate(now: number) {
    const errs: Record<string, string> = {};
    const h = Number(hours), e = Number(kwh);
    if (!Number.isFinite(h) || h < 0.25 || h > 24) errs.hours = "Enter between 0.25 and 24 hours.";
    if (!Number.isFinite(e) || e <= 0 || e > 150) errs.kwh = "Enter a number above 0.";
    if (!deadline) errs.deadline = "Pick a finish time.";
    if (!smart && (!from || !until)) errs.span = "Enter when you're available.";
    else if (!smart && from === until) errs.span = "Start and end of your available hours can't be the same.";
    if (!smart && phone.trim() && !/^\+[1-9]\d{7,14}$/.test(phone.replace(/[\s\-()]/g, "")))
      errs.phone = "Use international format, e.g. +16175550123.";
    const dl = nextAt(deadline, now);
    const span = smart ? { start: now, end: dl } : dailySpan(from, until, now);
    if (!errs.hours && Math.min(span.end, dl) - Math.max(span.start, now) < h * HOUR)
      errs.span = smart ? "Not enough time before the deadline." : "Your available hours are too short to finish before the deadline.";
    return { errs, dl, span };
  }

  async function find(e: FormEvent) {
    e.preventDefault();
    const now = Date.now();
    const { errs, dl, span } = validate(now);
    setErrors(errs); setFailMsg(null); setScheduled("no"); setSelectedBar(null);
    if (Object.keys(errs).length) return;

    const durationMs = Number(hours) * HOUR;
    const energy = Number(kwh);
    const input: TaskInput = {
      appliance: appliance.type, device_id: null, duration_min: Math.round(durationMs / 60_000), energy_kwh: energy,
      deadline: new Date(dl).toISOString(),
      availability: [{ start: new Date(Math.max(span.start, now)).toISOString(), end: new Date(span.end).toISOString() }],
      phone: !smart && phone.trim() ? phone.replace(/[\s\-()]/g, "") : null,
    };
    const base = { deadline: dl, durationMs, kwh: energy, smart, applianceId: appliance.id, phone: input.phone, input };
    const pts = grid.forecast?.points ?? [];

    setBusy(true);
    try {
      const p = await api.plan(input);
      const s = Date.parse(p.planned_start), en = Date.parse(p.planned_end);
      if (!Number.isFinite(s) || !Number.isFinite(en)) throw new ApiError("the server's plan was missing a start or end time", 200, "bad_shape");
      if (en <= s || en > dl + 60_000 || s < now - 5 * 60_000 || Math.abs(en - s - durationMs) > 60_000)
        throw new ApiError("the server's plan didn't fit your deadline or run time", 200, "bad_plan");
      const tp = toPoints(pts);
      const best = p.avg_intensity_best || avgIntensity(tp, s, en) || 0;
      const baseline = p.avg_intensity_now || best;
      setResult({ ...base, start: s, end: en, best, baseline, co2g: p.co2_avoided_g || Math.max(0, energy * (baseline - best)), via: "server" });
    } catch (err) {
      const reason = err instanceof ApiError
        ? err.message + (err.fieldErrors[0] ? ` (${err.fieldErrors[0].field}: ${err.fieldErrors[0].message})` : "")
        : "server unavailable";
      const local = findBestWindow(pts, durationMs, dl, [{ start: Math.max(span.start, now), end: span.end }], now, energy);
      if (local) {
        setResult({ ...base, ...local, via: "browser", note: `Calculated in your browser from the live forecast (server planning unavailable: ${reason})` });
      } else {
        setResult(null);
        setFailMsg(pts.length ? "No window fits before your deadline with the current forecast. Try a later deadline or more available hours." : `Couldn't plan right now: ${reason}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function schedule() {
    if (!result) return;
    const clash = tasks.find((t) => t.appliance === result.applianceId && !["done", "cancelled"].includes(liveStatus(t))
      && Date.parse(t.start) < result.end && Date.parse(t.end) > result.start);
    if (clash) {
      setFailMsg(`${deviceById(devices, result.applianceId).name} already has a task from ${fmtClock(Date.parse(clash.start))} to ${fmtClock(Date.parse(clash.end))}. Cancel it in My home or pick a different deadline.`);
      return;
    }
    setScheduled("saving");
    let savedOn: "server" | "device" = "device";
    try { await api.createTask(result.input); savedOn = "server"; } catch { /* keep it on this device */ }
    add({
      id: crypto.randomUUID(), appliance: result.applianceId, smart: result.smart,
      start: new Date(result.start).toISOString(), end: new Date(result.end).toISOString(),
      co2g: result.co2g, best: result.best, baseline: result.baseline,
      status: "scheduled", savedOn, createdAt: new Date().toISOString(),
    });
    setScheduled(savedOn);
  }

  const clear = (...keys: string[]) => setErrors((e) => {
    if (!keys.some((k) => e[k])) return e;
    const n = { ...e }; keys.forEach((k) => delete n[k]); return n;
  });
  const err = (k: string) => errors[k] ? <p className="mt-1 text-sm text-rose-300">{errors[k]}</p> : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Run it when the grid is cleanest</h1>
        <p className="mt-1 text-sm text-slate-400 sm:text-base">Pick an appliance and a deadline. GridWise finds the lowest-carbon window on New England's grid.</p>
      </section>

      {grid.error && !grid.forecast && (
        <Note tone="warn">Live grid forecast unavailable ({grid.error}). Retrying automatically.</Note>
      )}

      <div ref={formRef} className="grid scroll-mt-24 grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Schedule a task */}
        <Panel title="Schedule a task">
          <form onSubmit={find} noValidate className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="appliance" className="text-sm font-medium text-slate-300">Device</label>
                <button type="button" onClick={() => setAdding(true)} className="text-sm font-medium text-emerald-300 hover:underline">+ Add device</button>
              </div>
              <select id="appliance" className={fieldCls} value={appliance.id} onChange={(e) => pick(e.target.value)}>
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="hours" className={labelCls}>Duration (hours)</label>
                <input id="hours" type="number" inputMode="decimal" step="0.25" min="0.25" className={fieldCls}
                  value={hours} onChange={(e) => { setHours(e.target.value); clear("hours", "span"); }} aria-invalid={!!errors.hours} />
                {err("hours")}
              </div>
              <div>
                <label htmlFor="deadline" className={labelCls}>Deadline</label>
                <input id="deadline" type="time" className={fieldCls} value={deadline}
                  onChange={(e) => { setDeadline(e.target.value); clear("deadline", "span"); }} aria-invalid={!!errors.deadline} />
                {err("deadline") ?? (deadline && (
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(previewDeadline).toDateString() === new Date().toDateString() ? "Today" : "Tomorrow"}, {fmtClock(previewDeadline)}
                  </p>
                ))}
              </div>
            </div>

            <Toggle id="smart" label="Smart device (starts automatically)" checked={smart} onChange={setSmart} />

            <fieldset disabled={smart} className="space-y-2">
              <legend className={labelCls}>Available hours {smart && <span className="font-normal text-slate-500">(not needed for smart devices)</span>}</legend>
              <div className="grid grid-cols-2 gap-3">
                <input aria-label="Available from" type="time" className={fieldCls} value={from} onChange={(e) => { setFrom(e.target.value); clear("span"); }} />
                <input aria-label="Available until" type="time" className={fieldCls} value={until} onChange={(e) => { setUntil(e.target.value); clear("span"); }} />
              </div>
              {!smart && (
                <div>
                  <label htmlFor="phone" className={labelCls}>Text me at <span className="font-normal text-slate-500">(optional)</span></label>
                  <input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+16175550123" className={fieldCls}
                    value={phone} onChange={(e) => { setPhone(e.target.value); clear("phone"); }} aria-invalid={!!errors.phone} />
                  {err("phone")}
                </div>
              )}
            </fieldset>
            {err("span")}

            <details className="text-sm text-slate-400">
              <summary className="cursor-pointer select-none py-1 hover:text-slate-200">Energy per run: {kwh} kWh</summary>
              <div className="mt-2">
                <label htmlFor="kwh" className={labelCls}>Energy per run (kWh)</label>
                <input id="kwh" type="number" inputMode="decimal" step="0.1" className={fieldCls}
                  value={kwh} onChange={(e) => { setKwh(e.target.value); clear("kwh"); }} aria-invalid={!!errors.kwh} />
                {err("kwh")}
              </div>
            </details>

            <button type="submit" disabled={busy}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 active:scale-[0.99] disabled:opacity-60">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-5 w-5" aria-hidden="true" />}
              {busy ? "Finding…" : "Find cleanest time"}
            </button>
          </form>
        </Panel>

        {/* Recommendation */}
        <Panel title="Recommendation">
          <div aria-live="polite">
            {!result && !failMsg && (
              <div className="grid h-full min-h-[220px] place-items-center rounded-xl border border-dashed border-white/10 p-6 text-center text-slate-400">
                <p>Choose an appliance and deadline, then tap <span className="font-medium text-emerald-300">Find cleanest time</span>.</p>
              </div>
            )}
            {failMsg && <Note tone="error">{failMsg}</Note>}
            {result && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-400">Best window</p>
                  <p className="text-2xl font-semibold text-white sm:text-3xl">{fmtClock(result.start)} to {fmtClock(result.end)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-700/60 p-3 text-center">
                    <p className="text-xs text-slate-300">If run now</p>
                    <p className="text-xl font-semibold text-white sm:text-2xl">{Math.round(result.baseline)} <span className="text-sm font-normal">g/kWh</span></p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/90 p-3 text-center text-slate-950">
                    <p className="text-xs">Best window</p>
                    <p className="text-xl font-semibold sm:text-2xl">{Math.round(result.best)} <span className="text-sm font-normal">g/kWh</span></p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Carbon dioxide avoided</p>
                  <p className="text-2xl font-semibold text-white">{grams(result.co2g)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${result.smart ? "bg-emerald-500/20 text-emerald-300" : "bg-orange-500/20 text-orange-300"}`}>
                    {result.smart ? "Starts automatically" : result.phone ? `We'll text you at ${fmtClock(result.start)}` : `Reminder at ${fmtClock(result.start)}`}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Assumes {result.kwh} kWh per run for {deviceById(devices, result.applianceId).name}.</p>
                {result.note && <Note>{result.note}</Note>}

                {scheduled === "no" || scheduled === "saving" ? (
                  <button type="button" onClick={schedule} disabled={scheduled === "saving"}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-60">
                    {scheduled === "saving" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Schedule this window
                  </button>
                ) : (
                  <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Scheduled{scheduled === "device" ? " on this device (the server doesn't store tasks yet)" : ""}. See it in <a className="underline" href="#/home">My home</a>.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Carbon intensity forecast" right={<span className="text-xs text-slate-500">gCO₂/kWh, New England</span>}>
        {grid.loading && !grid.forecast ? (
          <div className="h-56 animate-pulse rounded-xl bg-white/5" />
        ) : (
          <ForecastBars points={grid.forecast?.points ?? []} window={result} previewDeadline={previewDeadline}
            selected={selectedBar} onSelect={setSelectedBar} />
        )}
      </Panel>

      <Panel title="Your devices" right={<span className="text-xs text-slate-500">Simulated · tap to plan</span>}>
        <DevicesRow devices={devices} tasks={tasks} onPick={pick} onAdd={() => setAdding(true)} />
      </Panel>

      <p className="text-center text-xs text-slate-500">Planning: {appliance.name}. CO₂ figures are estimates.</p>

      <DeviceDialog open={adding} names={devices.map((d) => d.name)} onClose={() => setAdding(false)}
        onSave={(d) => { const created = addDevice(d); setAdding(false); setApplianceId(created.id); setHours(String(created.hours)); setKwh(String(created.kwh)); setSmart(created.smart); setResult(null); }} />
    </div>
  );
}
