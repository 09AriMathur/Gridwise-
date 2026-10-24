import { useMemo, useRef, useState, type FormEvent } from "react";
import { CalendarCheck, CheckCircle2, ChevronDown, ChevronRight, DollarSign, Gauge, House, Leaf, Loader2, Plus, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import ForecastBars, { type ChartWindow } from "../components/ForecastBars";
import DevicesRow from "../components/DevicesRow";
import DeviceDialog from "../components/DeviceDialog";
import { MixCompare } from "../components/MixBar";
import {
  DEVICE_ICONS, DEVICE_TONES, FieldError, IconChip, Note, PageTitle, Panel, TONE_TEXT, Tag, Toggle, btnSolid, fieldCls, labelCls, type Tone,
} from "../components/common";
import { api, ApiError } from "../lib/api";
import { deviceById, useDevices } from "../lib/devices";
import { useGrid } from "../lib/grid";
import { avgIntensity, findBestWindow, toPoints } from "../lib/optimizer";
import { dollars, describePlan, moneySaved, useRates } from "../lib/rates";
import { loadDemo } from "../lib/demo";
import { permission, requestPermission, sendTest } from "../lib/notifications";
import { normalizePhone, usePhone } from "../lib/phone";
import { liveStatus, useTasks } from "../lib/tasks";
import { dailySpan, fmtClock, grams, nextAt } from "../lib/time";
import type { Mix, TaskInput } from "../lib/types";

type Result = ChartWindow & {
  baseline: number; co2g: number; via: "server" | "browser"; note?: string;
  smart: boolean; applianceId: string; phone: string | null; input: TaskInput;
  plannedAt: number; // "now" for the run-it-now comparison
  windowMix?: Mix | null; nowMix?: Mix | null; // grid mix, when the server could get it
};

const HOUR = 3_600_000;

export default function Dashboard() {
  const grid = useGrid();
  const { tasks, add } = useTasks();
  const { devices, add: addDevice } = useDevices();
  const { plan: rates } = useRates();
  const [adding, setAdding] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const [applianceId, setApplianceId] = useState(() => devices[0]?.id ?? "");
  const [hours, setHours] = useState(() => String(devices[0]?.hours ?? 1));
  const [kwh, setKwh] = useState(() => String(devices[0]?.kwh ?? 1));
  const [deadline, setDeadline] = useState("07:00");
  const [smart, setSmart] = useState(() => devices[0]?.smart ?? false);
  const [from, setFrom] = useState("21:00");
  const [until, setUntil] = useState("23:30");
  const savedPhone = usePhone();
  const [phone, setPhone] = useState(savedPhone.phone);

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
      phone: !smart && phone.trim() ? normalizePhone(phone) : null,
    };
    const base = { deadline: dl, durationMs, kwh: energy, smart, applianceId: appliance.id, phone: input.phone, input, plannedAt: now };
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
      setResult({ ...base, start: s, end: en, best, baseline, co2g: p.co2_avoided_g || Math.max(0, energy * (baseline - best)), via: "server", windowMix: p.window_mix, nowMix: p.now_mix });
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
      const msg = `${deviceById(devices, result.applianceId).name} already has a task from ${fmtClock(Date.parse(clash.start))} to ${fmtClock(Date.parse(clash.end))}. Cancel it in My home or pick a different deadline.`;
      setFailMsg(msg);
      toast.error("That device is already booked", { description: msg });
      return;
    }
    setScheduled("saving");
    let savedOn: "server" | "device" = "device";
    try { await api.createTask(result.input); savedOn = "server"; } catch { /* keep it on this device */ }
    const id = crypto.randomUUID();
    const device = deviceById(devices, result.applianceId);

    // Manual device with a number: the backend texts at the start and end, even if this tab is closed.
    let sms: string | undefined;
    if (!result.smart && result.phone) {
      try {
        const r = await api.scheduleTexts({ task_id: id, phone: result.phone, device_name: device.name,
          start: new Date(result.start).toISOString(), end: new Date(result.end).toISOString() });
        sms = result.phone;
        savedPhone.save(result.phone);
        toast.success(`We'll text ${result.phone}`, {
          description: `At ${fmtClock(result.start)} to turn it on and ${fmtClock(result.end)} to turn it off.${r.trial ? " (Twilio trial: only verified numbers get texts.)" : ""}`,
        });
      } catch (e) {
        toast.error("Couldn't set up text reminders", {
          description: `${e instanceof ApiError ? e.message : "The server didn't respond."} You'll still get reminders in GridWise.`,
        });
      }
    }

    add({
      id, appliance: result.applianceId, smart: result.smart, sms,
      start: new Date(result.start).toISOString(), end: new Date(result.end).toISOString(),
      co2g: result.co2g, best: result.best, baseline: result.baseline,
      money: moneySaved(rates, result.plannedAt, result.start, result.end, result.kwh).saved,
      status: "scheduled", savedOn, createdAt: new Date().toISOString(),
    });
    setScheduled(savedOn);
    const saved = moneySaved(rates, result.plannedAt, result.start, result.end, result.kwh).saved;
    toast.success(`Scheduled for ${fmtClock(result.start)}`, {
      description: `${deviceById(devices, result.applianceId).name} · saves ${grams(result.co2g)}${saved >= 0.005 ? ` and ${dollars(saved)}` : ""}`,
    });
    // Manual devices depend on reminders; offer to turn on system alerts.
    if (!result.smart && permission() === "default") {
      toast("Get a reminder when it's time", {
        description: `We'll tell you to turn it on at ${fmtClock(result.start)} and off at ${fmtClock(result.end)}.`,
        duration: 15_000,
        action: { label: "Enable alerts", onClick: async () => { if (await requestPermission() === "granted") sendTest(); } },
      });
    }
  }

  const clear = (...keys: string[]) => setErrors((e) => {
    if (!keys.some((k) => e[k])) return e;
    const n = { ...e }; keys.forEach((k) => delete n[k]); return n;
  });
  const err = (k: string) => <FieldError>{errors[k]}</FieldError>;
  const money = result ? moneySaved(rates, result.plannedAt, result.start, result.end, result.kwh) : null;
  const ApplianceIcon = DEVICE_ICONS[appliance.type] ?? DEVICE_ICONS.other;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const totals = tasks.filter((t) => liveStatus(t) !== "cancelled")
    .reduce((acc, t) => ({ co2: acc.co2 + (t.co2g || 0), money: acc.money + Math.max(0, t.money ?? 0) }), { co2: 0, money: 0 });

  return (
    <div className="space-y-7">
      <PageTitle kicker={today} title={greeting}
        sub={`Run your appliances when the ${grid.zoneName} grid is cleanest. Pick a device and a deadline; GridWise finds the best window.`} />

      {grid.error && !grid.forecast && (
        <Note tone="warn">Live grid forecast unavailable ({grid.error}). Retrying automatically.</Note>
      )}
      {grid.forecast?.source === "synthetic" && (
        <Note tone="warn">The server couldn't reach Electricity Maps, so this is sample data, not a real forecast.</Note>
      )}

      {/* Device capsules */}
      <div role="radiogroup" aria-label="Device" className="scrollbar-thin -mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0">
        {devices.map((d) => {
          const Icon = DEVICE_ICONS[d.type] ?? DEVICE_ICONS.other;
          const active = d.id === appliance.id;
          return (
            <button key={d.id} type="button" role="radio" aria-checked={active} onClick={() => pick(d.id)}
              className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium transition-colors duration-200 ease-ios focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40",
                active ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-card/70")}>
              <Icon className="size-4" strokeWidth={2.25} aria-hidden="true" /> {d.name}
            </button>
          );
        })}
        <button type="button" onClick={() => setAdding(true)} aria-label="Add device"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-primary transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40">
          <Plus className="size-[18px]" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      <div ref={formRef} className="grid scroll-mt-24 grid-cols-1 gap-7 lg:grid-cols-12 lg:gap-5">
        {/* Schedule a task */}
        <Panel title="Schedule" icon={CalendarCheck} className="animate-rise-in lg:col-span-5">
          <form onSubmit={find} noValidate className="space-y-4">
            <div className="flex items-center gap-3">
              <IconChip icon={ApplianceIcon} tone={DEVICE_TONES[appliance.type] ?? "gray"} className="size-11" />
              <div className="min-w-0">
                <p className="text-headline truncate">{appliance.name}</p>
                <p className="text-footnote text-muted-foreground">{appliance.smart ? "Smart plug" : "Manual · we'll remind you"} · {appliance.kwh} kWh</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="hours" className={labelCls}>Duration (hours)</Label>
                <Input id="hours" type="number" inputMode="decimal" step="0.25" min="0.25" className={fieldCls}
                  value={hours} onChange={(e) => { setHours(e.target.value); clear("hours", "span"); }} aria-invalid={!!errors.hours} />
                {err("hours")}
              </div>
              <div>
                <Label htmlFor="deadline" className={labelCls}>Finish by</Label>
                <Input id="deadline" type="time" className={fieldCls} value={deadline}
                  onChange={(e) => { setDeadline(e.target.value); clear("deadline", "span"); }} aria-invalid={!!errors.deadline} />
                {errors.deadline ? err("deadline") : deadline && (
                  <p className="text-footnote mt-1.5 px-1 text-muted-foreground">
                    {new Date(previewDeadline).toDateString() === new Date().toDateString() ? "Today" : "Tomorrow"}, {fmtClock(previewDeadline)}
                  </p>
                )}
              </div>
            </div>

            <Toggle id="smart" label="Smart Device" hint="Starts automatically at the best time" checked={smart} onChange={setSmart} />

            <fieldset disabled={smart} className="space-y-2 transition-opacity disabled:opacity-40">
              <legend className={labelCls}>Available hours{smart && " · not needed for smart devices"}</legend>
              <div className="grid grid-cols-2 gap-3">
                <Input aria-label="Available from" type="time" className={fieldCls} value={from} onChange={(e) => { setFrom(e.target.value); clear("span"); }} />
                <Input aria-label="Available until" type="time" className={fieldCls} value={until} onChange={(e) => { setUntil(e.target.value); clear("span"); }} />
              </div>
              {!smart && (
                <div className="pt-2">
                  <Label htmlFor="phone" className={labelCls}>Text me at (optional)</Label>
                  <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+16175550123" className={fieldCls}
                    value={phone} onChange={(e) => { setPhone(e.target.value); clear("phone"); }} aria-invalid={!!errors.phone} />
                  {err("phone")}
                  <p className="text-footnote mt-1.5 px-1 text-muted-foreground">
                    We'll text you when to turn it on and off, even if GridWise is closed. Without a number, reminders show in GridWise.
                  </p>
                </div>
              )}
            </fieldset>
            {err("span")}

            <Collapsible>
              <CollapsibleTrigger className="group text-subheadline flex w-full items-center justify-between px-1 py-1 text-muted-foreground hover:text-foreground">
                <span>Energy per run: <span className="text-foreground">{kwh} kWh</span></span>
                <ChevronDown className="size-4 transition-transform duration-300 ease-ios group-data-[state=open]:rotate-180" aria-hidden="true" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <Label htmlFor="kwh" className={labelCls}>Energy per run (kWh)</Label>
                <Input id="kwh" type="number" inputMode="decimal" step="0.1" className={fieldCls}
                  value={kwh} onChange={(e) => { setKwh(e.target.value); clear("kwh"); }} aria-invalid={!!errors.kwh} />
                {err("kwh")}
              </CollapsibleContent>
            </Collapsible>

            <Button type="submit" disabled={busy} className={cn(btnSolid, "w-full")}>
              {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Sparkles className="size-5" aria-hidden="true" />}
              {busy ? "Finding…" : "Find Cleanest Time"}
            </Button>
          </form>
        </Panel>

        {/* Recommendation */}
        <Panel title="Recommendation" icon={Wand2} tone="violet" className="animate-rise-in lg:col-span-7">
          <div aria-live="polite" className="h-full">
            {!result && !failMsg && (
              <div className="flex h-full min-h-[340px] flex-col items-center justify-center gap-4 text-center">
                <IconChip icon={ApplianceIcon} tone={DEVICE_TONES[appliance.type] ?? "gray"} variant="tint" className="size-20 rounded-full" />
                <div>
                  <p className="text-title-3">No Window Yet</p>
                  <p className="text-subheadline mx-auto mt-1 max-w-xs text-muted-foreground">
                    Choose when it needs to finish, then tap Find Cleanest Time to see the best window for your {appliance.name.toLowerCase()}.
                  </p>
                </div>
              </div>
            )}
            {failMsg && <Note tone="error">{failMsg}</Note>}
            {result && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-footnote font-semibold uppercase tracking-[0.02em] text-primary">Best Window</p>
                    <p className="font-rounded text-[52px] font-bold leading-[1.05] tracking-[-0.02em] tabular-nums">{fmtClock(result.start)}</p>
                    <p className="text-subheadline text-muted-foreground">
                      until {fmtClock(result.end)} · {deviceById(devices, result.applianceId).name}
                    </p>
                  </div>
                  <IconChip icon={Leaf} tone="green" className="size-12" />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Tag className={result.smart ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}>
                    {result.smart ? "Starts automatically" : `${result.phone ? "Texts" : "Reminders"} at ${fmtClock(result.start)} & ${fmtClock(result.end)}`}
                  </Tag>
                  <Tag className="bg-secondary text-muted-foreground">{result.via === "server" ? "Planned by GridWise" : "Planned on this device"}</Tag>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ResultTile icon={Gauge} tone="gray" label="Now" value={`${Math.round(result.baseline)}`} unit="g/kWh" />
                  <ResultTile icon={Sparkles} tone="indigo" label="Best" value={`${Math.round(result.best)}`} unit="g/kWh" />
                  <ResultTile icon={Leaf} tone="green" label="CO₂ Saved" value={grams(result.co2g)} unit="per run" />
                  {money && (rates.kind === "tou" ? (
                    <ResultTile icon={DollarSign} tone={money.saved <= -0.005 ? "red" : "orange"}
                      label={money.saved <= -0.005 ? "Extra" : "Saved"} value={dollars(Math.abs(money.saved))} unit={`vs ${dollars(money.now)} now`} />
                  ) : (
                    <ResultTile icon={DollarSign} tone="orange" label="Cost" value={dollars(money.window)} unit="same any time" />
                  ))}
                </div>

                {result.windowMix && result.nowMix && <MixCompare now={result.nowMix} best={result.windowMix} />}

                <div className="space-y-1">
                  <p className="text-footnote text-muted-foreground">Assumes {result.kwh} kWh per run · {describePlan(rates)}</p>
                  {rates.kind === "flat" ? (
                    <p className="text-footnote text-muted-foreground">
                      {rates.confirmed ? "On a flat rate the bill is the same whenever it runs; the win here is carbon." : "Costs use a placeholder rate."}{" "}
                      <a href="#/home" className="text-primary hover:opacity-70">{rates.confirmed ? "On time-of-use? Set it" : "Set your rates"}</a>
                    </p>
                  ) : money && money.saved <= -0.005 ? (
                    <p className="text-footnote text-danger">The cleanest window falls in your peak hours, so it costs a little more than running now.</p>
                  ) : null}
                </div>
                {result.note && <Note>{result.note}</Note>}

                {scheduled === "no" || scheduled === "saving" ? (
                  <Button type="button" onClick={schedule} disabled={scheduled === "saving"} className={cn(btnSolid, "w-full")}>
                    {scheduled === "saving" ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <CalendarCheck className="size-5" aria-hidden="true" />}
                    Schedule This Window
                  </Button>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl bg-success/12 px-3 py-2.5">
                    <CheckCircle2 className="size-5 shrink-0 text-success" strokeWidth={2.5} aria-hidden="true" />
                    <span className="text-subheadline">
                      Scheduled{scheduled === "device" ? " on this device" : ""}.{" "}
                      <a className="text-primary hover:opacity-70" href="#/home">View in My Home</a>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Carbon Forecast" icon={Gauge} tone="blue" className="animate-rise-in"
        right={<span className="text-footnote text-muted-foreground">gCO₂/kWh · {grid.zoneName}</span>} rightOnMobile={false}>
        {grid.loading && !grid.forecast ? (
          <Skeleton className="h-60 rounded-xl" />
        ) : (
          <ForecastBars points={grid.forecast?.points ?? []} window={result} previewDeadline={previewDeadline}
            selected={selectedBar} onSelect={setSelectedBar} />
        )}
      </Panel>

      <Panel title="Devices" icon={House} tone="orange" className="animate-rise-in" bodyClassName="bg-transparent p-0 sm:p-0"
        right={<span className="text-footnote text-muted-foreground">Simulated · tap to plan</span>} rightOnMobile={false}>
        <DevicesRow devices={devices} tasks={tasks} onPick={pick} onAdd={() => setAdding(true)} />
      </Panel>

      {tasks.length === 0 && (
        <button type="button" onClick={() => { loadDemo(); toast.success("Demo data loaded", { description: "Rates, tasks, savings and reminders are filled in." }); }}
          className="animate-rise-in flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left transition-opacity active:opacity-70">
          <IconChip icon={Sparkles} tone="violet" className="size-11" />
          <div className="min-w-0 flex-1">
            <p className="text-headline">Try It With Demo Data</p>
            <p className="text-subheadline text-muted-foreground">Fill in rates, tasks, savings and reminders to see everything GridWise does.</p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-tertiary-foreground" strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}

      {totals.co2 > 0 && (
        <a href="#/home" className="animate-rise-in flex items-center gap-3 rounded-2xl bg-card p-4 transition-opacity active:opacity-70">
          <IconChip icon={Leaf} tone="green" className="size-11" />
          <div className="min-w-0 flex-1">
            <p className="text-headline">
              You've avoided {grams(totals.co2)} of CO₂{totals.money >= 0.005 ? ` and saved ${dollars(totals.money)}` : ""}
            </p>
            <p className="text-subheadline text-muted-foreground">Keep going. Every shifted run counts.</p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-tertiary-foreground" strokeWidth={2.5} aria-hidden="true" />
        </a>
      )}

      <DeviceDialog open={adding} names={devices.map((d) => d.name)} onClose={() => setAdding(false)}
        onSave={(d) => {
          const created = addDevice(d); setAdding(false); setApplianceId(created.id); setHours(String(created.hours));
          setKwh(String(created.kwh)); setSmart(created.smart); setResult(null);
          toast.success(`${created.name} added`);
        }} />
    </div>
  );
}

// Health-style mini summary: coloured label, big rounded number.
function ResultTile({ icon: Icon, tone, label, value, unit }: { icon: typeof Leaf; tone: Tone; label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl bg-secondary/70 p-3">
      <p className={cn("text-footnote flex items-center gap-1 font-semibold", TONE_TEXT[tone])}>
        <Icon className="size-3.5" strokeWidth={2.5} aria-hidden="true" /> {label}
      </p>
      <p className="mt-1 truncate font-rounded text-[22px] font-bold leading-7 tabular-nums">{value}</p>
      <p className="text-caption-1 truncate text-muted-foreground">{unit}</p>
    </div>
  );
}
