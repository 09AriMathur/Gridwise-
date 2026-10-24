import { useState } from "react";
import { BatteryCharging, Bell, CheckCircle2, Leaf, Pencil, Plus, Trash2, X } from "lucide-react";
import DeviceDialog from "../components/DeviceDialog";
import { deviceState } from "../components/DevicesRow";
import { Note, Panel } from "../components/ui";
import { deviceById, TYPE_PRESETS, useDevices, type HomeDevice } from "../lib/devices";
import { liveStatus, useTasks, type LiveStatus } from "../lib/tasks";
import { fmtClock, fmtDayTime, grams } from "../lib/time";

const STATUS_UI: Record<LiveStatus, { label: string; cls: string }> = {
  scheduled: { label: "Scheduled", cls: "bg-sky-500/15 text-sky-300" },
  running: { label: "Running", cls: "bg-emerald-500/20 text-emerald-300" },
  due: { label: "Start now", cls: "bg-orange-500/20 text-orange-300" },
  started: { label: "Started", cls: "bg-emerald-500/20 text-emerald-300" },
  done: { label: "Done", cls: "bg-slate-500/20 text-slate-300" },
  cancelled: { label: "Cancelled", cls: "bg-slate-500/20 text-slate-400" },
};

export default function MyHome() {
  const { tasks, update, clearFinished } = useTasks();
  const devices = useDevices();
  const [dialog, setDialog] = useState<{ open: boolean; editing: HomeDevice | null }>({ open: false, editing: null });
  const sorted = [...tasks].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const active = sorted.filter((t) => !["done", "cancelled"].includes(liveStatus(t)));
  const history = sorted.filter((t) => ["done", "cancelled"].includes(liveStatus(t))).reverse();
  const saved = tasks.filter((t) => liveStatus(t) !== "cancelled").reduce((s, t) => s + (t.co2g || 0), 0);
  const deviceOnly = tasks.some((t) => t.savedOn === "device");

  return (
    <div className="space-y-5 sm:space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">My home</h1>
        <p className="mt-1 text-sm text-slate-400 sm:text-base">Your appliances, what's coming up, and the carbon you've avoided.</p>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat icon={Leaf} label="CO₂ avoided" value={grams(saved)} accent />
        <Stat icon={BatteryCharging} label="Upcoming tasks" value={String(active.length)} />
        <Stat icon={CheckCircle2} label="Completed" value={String(history.filter((t) => liveStatus(t) === "done").length)} />
      </div>

      <Panel title="Devices" right={
        <button onClick={() => setDialog({ open: true, editing: null })}
          className="flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400">
          <Plus className="h-4 w-4" aria-hidden="true" /> Add device
        </button>}>
        {devices.devices.length === 0 ? (
          <p className="py-6 text-center text-slate-400">No devices yet. Add your first one to start planning.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {devices.devices.map((d) => {
              const st = deviceState(d.id, tasks);
              const dot = st.tone === "green" ? "bg-emerald-400" : st.tone === "orange" ? "bg-orange-400" : "bg-slate-500";
              return (
                <li key={d.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{d.name}</p>
                      <p className="text-sm text-slate-400">
                        {TYPE_PRESETS[d.type]?.label ?? "Device"} · {d.smart ? "smart plug" : "manual reminder"}{d.simulated ? " · simulated" : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{d.hours} h · {d.kwh} kWh per run</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => setDialog({ open: true, editing: d })} aria-label={`Edit ${d.name}`}
                        className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white">
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button onClick={() => { if (window.confirm(`Remove ${d.name}?`)) devices.remove(d.id); }} aria-label={`Remove ${d.name}`}
                        className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-rose-500/15 hover:text-rose-300">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-200">
                    <span className={`h-2.5 w-2.5 rounded-full ${dot} ${st.pulse ? "animate-pulse" : ""}`} />{st.line}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Upcoming" right={<a href="#/" className="text-sm font-medium text-emerald-300 hover:underline">+ Plan a task</a>}>
        {deviceOnly && <div className="mb-3"><Note>Tasks are saved on this device until the server's tasks endpoint is ready.</Note></div>}
        {active.length === 0 ? (
          <p className="py-6 text-center text-slate-400">Nothing scheduled. <a href="#/" className="text-emerald-300 underline">Plan your first task</a>.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {active.map((t) => {
              const s = liveStatus(t);
              return (
                <li key={t.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-white">{deviceById(devices.devices, t.appliance).name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_UI[s].cls}`}>{STATUS_UI[s].label}</span>
                    </div>
                    <p className="text-sm text-slate-400">
                      {fmtDayTime(t.start)} to {fmtClock(Date.parse(t.end))} · saves {grams(t.co2g)} · {t.smart ? "auto start" : "reminder"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!t.smart && (s === "due" || s === "scheduled") && (
                      <button onClick={() => update(t.id, { status: "started" })}
                        className="flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400">
                        <Bell className="h-4 w-4" aria-hidden="true" /> I started it
                      </button>
                    )}
                    <button onClick={() => update(t.id, { status: "cancelled" })}
                      className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/15 px-3 text-sm font-medium text-slate-200 hover:bg-white/5">
                      <X className="h-4 w-4" aria-hidden="true" /> Cancel
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {history.length > 0 && (
        <Panel title="History" right={<button onClick={clearFinished} className="text-sm text-slate-400 hover:text-white">Clear</button>}>
          <ul className="space-y-2">
            {history.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-300">{deviceById(devices.devices, t.appliance).name} · {fmtDayTime(t.start)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_UI[liveStatus(t)].cls}`}>{STATUS_UI[liveStatus(t)].label}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <DeviceDialog open={dialog.open} existing={dialog.editing}
        names={devices.devices.filter((d) => d.id !== dialog.editing?.id).map((d) => d.name)}
        onClose={() => setDialog({ open: false, editing: null })}
        onSave={(d) => {
          if (dialog.editing) devices.update(dialog.editing.id, d); else devices.add(d);
          setDialog({ open: false, editing: null });
        }} />
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent = false }: { icon: typeof Leaf; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-4 ${accent ? "border-emerald-400/30 bg-emerald-500/10" : "border-white/10 bg-slate-900/70"}`}>
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${accent ? "bg-emerald-500 text-slate-950" : "bg-white/10 text-slate-200"}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-xl font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}
