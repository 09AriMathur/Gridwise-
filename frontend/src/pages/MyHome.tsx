import { useState } from "react";
import { BatteryCharging, CalendarClock, CheckCircle2, DollarSign, FlaskConical, History, House, Leaf, Pencil, Plus, Power, PowerOff, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import DeviceDialog from "../components/DeviceDialog";
import RatesPanel from "../components/RatesPanel";
import SmsPanel from "../components/SmsPanel";
import { useDeviceSwitch } from "../components/Reminders";
import { deviceState, TONE_DOT } from "../components/DevicesRow";
import {
  DEVICE_ICONS, DEVICE_TONES, IconChip, Note, PageTitle, Panel, Row, Stat, Tag, btnBare, btnSolid, iconBtn,
} from "../components/common";
import { loadDemo, resetAll } from "../lib/demo";
import { deviceById, TYPE_PRESETS, useDevices, type HomeDevice } from "../lib/devices";
import { dollars, useRates } from "../lib/rates";
import { liveStatus, useTasks, type LiveStatus } from "../lib/tasks";
import { fmtClock, fmtDayTime, grams } from "../lib/time";

const STATUS_UI: Record<LiveStatus, { label: string; cls: string }> = {
  scheduled: { label: "Scheduled", cls: "bg-accent text-accent-foreground" },
  running: { label: "Running", cls: "bg-success/15 text-success" },
  due: { label: "Turn On Now", cls: "bg-warning/15 text-warning" },
  started: { label: "On", cls: "bg-success/15 text-success" },
  turn_off: { label: "Turn Off Now", cls: "bg-warning/15 text-warning" },
  done: { label: "Done", cls: "bg-secondary text-muted-foreground" },
  cancelled: { label: "Cancelled", cls: "bg-secondary text-muted-foreground line-through" },
};

function StatusTag({ status }: { status: LiveStatus }) {
  return <Tag className={cn("h-5 px-2 text-[11px]", STATUS_UI[status].cls)}>{STATUS_UI[status].label}</Tag>;
}

export default function MyHome() {
  const { tasks, update, clearFinished } = useTasks();
  const { turnOn, turnOff, cancel } = useDeviceSwitch();
  const devices = useDevices();
  const [dialog, setDialog] = useState<{ open: boolean; editing: HomeDevice | null }>({ open: false, editing: null });
  const [removing, setRemoving] = useState<HomeDevice | null>(null);
  const sorted = [...tasks].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const active = sorted.filter((t) => !["done", "cancelled"].includes(liveStatus(t)));
  const history = sorted.filter((t) => ["done", "cancelled"].includes(liveStatus(t))).reverse();
  const saved = tasks.filter((t) => liveStatus(t) !== "cancelled").reduce((s, t) => s + (t.co2g || 0), 0);
  const deviceOnly = tasks.some((t) => t.savedOn === "device");
  const { plan: rates } = useRates();
  const moneySaved = tasks.filter((t) => liveStatus(t) !== "cancelled").reduce((s, t) => s + Math.max(0, t.money ?? 0), 0);
  const addDevice = () => setDialog({ open: true, editing: null });

  return (
    <div className="space-y-7">
      <PageTitle kicker="Your household" title="My Home"
        sub="Your appliances, what's coming up, and the carbon and money you've saved."
        action={<Button className={cn(btnSolid, "hidden h-9 rounded-full px-4 text-[15px] sm:inline-flex")} onClick={addDevice}>
          <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" /> Add Device
        </Button>} />

      <div className="grid animate-rise-in grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Leaf} tone="green" label="CO₂ Avoided" value={grams(saved)} sub="All time, this device" />
        <Stat icon={DollarSign} tone="orange" label="Money Saved" value={dollars(moneySaved)}
          sub={rates.kind === "tou" ? "vs. running right away" : "Flat rate: timing doesn't change the bill"} />
        <Stat icon={BatteryCharging} tone="indigo" label="Upcoming" value={String(active.length)} sub="Tasks queued" />
        <Stat icon={CheckCircle2} tone="blue" label="Completed" value={String(history.filter((t) => liveStatus(t) === "done").length)} sub="Runs finished" />
      </div>

      <Panel title="Upcoming" icon={CalendarClock} tone="indigo" bodyClassName="p-0 sm:p-0"
        right={<Button asChild variant="ghost" className={btnBare}><a href="#/">Plan a Task</a></Button>}>
        {deviceOnly && <div className="border-b-[0.5px] border-border p-3"><Note>Tasks are saved on this device until the server's tasks endpoint is ready.</Note></div>}
        {active.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <p className="text-headline">Nothing Scheduled</p>
            <p className="text-subheadline text-muted-foreground">Plan a task on the Dashboard and it shows up here.</p>
          </div>
        ) : (
          <ul>
            {active.map((t) => {
              const s = liveStatus(t);
              const device = deviceById(devices.devices, t.appliance);
              const canOn = !t.smart && (s === "due" || s === "scheduled");
              const canOff = !t.smart && (s === "started" || s === "turn_off");
              return (
                <Row key={t.id} icon={DEVICE_ICONS[device.type] ?? DEVICE_ICONS.other} tone={DEVICE_TONES[device.type] ?? "gray"}
                  title={<span className="flex flex-wrap items-center gap-2">{device.name} <StatusTag status={s} /></span>}
                  subtitle={<>
                    {fmtDayTime(t.start)} – {fmtClock(Date.parse(t.end))} · {t.smart ? "auto start" : t.sms ? `texts to ${t.sms}` : "on/off reminders"}
                    <span className="block text-success">Saves {grams(t.co2g)}{(t.money ?? 0) >= 0.005 ? ` and ${dollars(t.money!)}` : ""}</span>
                  </>}
                  right={
                    <div className="flex shrink-0 items-center gap-1">
                      {canOn && (
                        <Button className={cn(btnSolid, "h-8 rounded-full px-3 text-[13px]")} onClick={() => turnOn(t)}>
                          <Power className="size-3.5" strokeWidth={2.5} aria-hidden="true" /> On
                        </Button>
                      )}
                      {canOff && (
                        <Button className={cn(btnSolid, "h-8 rounded-full px-3 text-[13px]")} onClick={() => turnOff(t)}>
                          <PowerOff className="size-3.5" strokeWidth={2.5} aria-hidden="true" /> Off
                        </Button>
                      )}
                      <Button variant="ghost" className={cn(btnBare, "text-destructive")}
                        onClick={() => cancel(t, `Cancelled ${device.name}`)}>
                        Cancel
                      </Button>
                    </div>
                  } />
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Devices" icon={House} tone="orange" bodyClassName="p-0 sm:p-0"
        right={<Button variant="ghost" className={btnBare} onClick={addDevice}>Add</Button>}>
        {devices.devices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <p className="text-headline">No Devices</p>
            <p className="text-subheadline text-muted-foreground">Add your first one to start planning.</p>
          </div>
        ) : (
          <ul>
            {devices.devices.map((d) => {
              const st = deviceState(d.id, tasks);
              return (
                <Row key={d.id} icon={DEVICE_ICONS[d.type] ?? DEVICE_ICONS.other} tone={DEVICE_TONES[d.type] ?? "gray"}
                  title={d.name}
                  subtitle={<>
                    {TYPE_PRESETS[d.type]?.label ?? "Device"} · {d.smart ? "Smart plug" : "Reminder"}{d.simulated ? " · simulated" : ""} · {d.hours} h · {d.kwh} kWh
                    <span className="flex items-center gap-1.5">
                      <span className={cn("size-1.5 rounded-full", TONE_DOT[st.tone], st.pulse && "animate-pulse")} aria-hidden="true" />{st.line}
                    </span>
                  </>}
                  right={
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => setDialog({ open: true, editing: d })} aria-label={`Edit ${d.name}`} className={iconBtn}>
                        <Pencil className="size-4" strokeWidth={2.25} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => setRemoving(d)} aria-label={`Remove ${d.name}`} className={cn(iconBtn, "text-destructive")}>
                        <Trash2 className="size-4" strokeWidth={2.25} aria-hidden="true" />
                      </button>
                    </div>
                  } />
              );
            })}
          </ul>
        )}
      </Panel>

      <SmsPanel />

      <RatesPanel />

      {/* Demo data, so the whole app can be seen without waiting for real runs. */}
      <Panel title="Demo Data" icon={FlaskConical} tone="violet" bodyClassName="p-0 sm:p-0">
        <ul>
          <Row icon={FlaskConical} tone="violet" title="Load Demo Data"
            subtitle="Time-of-use rates, six devices, tasks in every state, savings history and notifications."
            onClick={() => { loadDemo(); toast.success("Demo data loaded", { description: "Check the Dashboard, the bell and the banners." }); }} />
          <Row icon={RotateCcw} tone="red" title={<span className="text-destructive">Reset Everything</span>}
            subtitle="Back to a fresh install: default devices, no tasks, placeholder rate."
            onClick={() => { resetAll(); toast("Everything reset"); }} />
        </ul>
      </Panel>

      {history.length > 0 && (
        <Panel title="History" icon={History} tone="gray" bodyClassName="p-0 sm:p-0"
          right={<Button variant="ghost" className={btnBare} onClick={clearFinished}>Clear</Button>}>
          <ul>
            {history.slice(0, 8).map((t) => {
              const device = deviceById(devices.devices, t.appliance);
              return (
                <Row key={t.id} icon={DEVICE_ICONS[device.type] ?? DEVICE_ICONS.other} tone="gray"
                  title={device.name} subtitle={fmtDayTime(t.start)} right={<StatusTag status={liveStatus(t)} />} />
              );
            })}
          </ul>
        </Panel>
      )}

      <DeviceDialog open={dialog.open} existing={dialog.editing}
        names={devices.devices.filter((d) => d.id !== dialog.editing?.id).map((d) => d.name)}
        onClose={() => setDialog({ open: false, editing: null })}
        onSave={(d) => {
          if (dialog.editing) devices.update(dialog.editing.id, d); else devices.add(d);
          toast.success(dialog.editing ? `${d.name} updated` : `${d.name} added`);
          setDialog({ open: false, editing: null });
        }} />

      {/* iOS alert: centred, title + message, side-by-side tint buttons split by hairlines. */}
      <AlertDialog open={!!removing} onOpenChange={(o) => { if (!o) setRemoving(null); }}>
        <AlertDialogContent className="w-[270px] max-w-[270px] gap-0 overflow-hidden rounded-[14px] bg-popover p-0 ring-0 shadow-[0_20px_60px_rgb(0_0_0/0.25)] sm:max-w-[270px]">
          <AlertDialogHeader className="items-center gap-0.5 px-4 pb-4 pt-5 text-center sm:items-center sm:text-center">
            <AlertDialogTitle className="text-headline">Remove “{removing?.name}”?</AlertDialogTitle>
            <AlertDialogDescription className="text-footnote text-foreground/80">
              It disappears from your devices. Tasks already scheduled for it stay in your history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="m-0 grid grid-cols-2 gap-0 border-0 border-t-[0.5px] border-border bg-transparent p-0 sm:flex-none">
            <AlertDialogCancel className="h-11 rounded-none border-0 border-r-[0.5px] border-border bg-transparent text-[17px] font-normal text-primary shadow-none hover:bg-secondary dark:bg-transparent dark:hover:bg-secondary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => {
              if (removing) { devices.remove(removing.id); toast(`Removed ${removing.name}`); }
              setRemoving(null);
            }} className="h-11 rounded-none bg-transparent text-[17px] font-semibold text-destructive hover:bg-secondary dark:bg-transparent dark:hover:bg-secondary">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
