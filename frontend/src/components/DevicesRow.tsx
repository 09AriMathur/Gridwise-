import { Plus } from "lucide-react";
import type { HomeDevice } from "../lib/devices";
import { fmtClock } from "../lib/time";
import { liveStatus, type LocalTask } from "../lib/tasks";

type Tone = "green" | "orange" | "idle";

export function deviceState(deviceId: string, tasks: LocalTask[]): { tone: Tone; line: string; pulse?: boolean } {
  const active = tasks
    .filter((t) => t.appliance === deviceId && !["done", "cancelled"].includes(liveStatus(t)))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  if (!active) return { tone: "idle", line: "No task scheduled" };
  const s = liveStatus(active);
  const at = fmtClock(Date.parse(active.start));
  if (s === "running") return { tone: "green", line: `Running until ${fmtClock(Date.parse(active.end))}`, pulse: true };
  if (s === "started") return { tone: "green", line: "Started, thanks!" };
  if (s === "due") return { tone: "orange", line: "Start it now", pulse: true };
  return active.smart ? { tone: "green", line: `Auto start ${at}` } : { tone: "orange", line: `Notify at ${at}` };
}

const TONE: Record<Tone, string> = {
  green: "border-emerald-400/40 bg-emerald-500/90 text-slate-950 hover:bg-emerald-400",
  orange: "border-orange-300/40 bg-orange-500/90 text-slate-950 hover:bg-orange-400",
  idle: "border-white/10 bg-slate-800/80 text-slate-200 hover:bg-slate-700",
};

type Props = { devices: HomeDevice[]; tasks: LocalTask[]; onPick: (id: string) => void; onAdd: () => void };

export default function DevicesRow({ devices, tasks, onPick, onAdd }: Props) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {devices.map((d) => {
        const st = deviceState(d.id, tasks);
        return (
          <li key={d.id}>
            <button type="button" onClick={() => onPick(d.id)}
              className={`flex min-h-[84px] w-full flex-col items-center justify-center rounded-2xl border px-4 py-4 text-center transition active:scale-[0.98] ${TONE[st.tone]} ${st.pulse ? "animate-pulse" : ""}`}>
              <span className="text-base font-semibold">{d.name}</span>
              <span className="text-sm opacity-90">{st.line}</span>
            </button>
          </li>
        );
      })}
      <li>
        <button type="button" onClick={onAdd}
          className="flex min-h-[84px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 px-4 py-4 text-slate-300 transition hover:border-emerald-400/60 hover:text-emerald-300">
          <Plus className="h-5 w-5" aria-hidden="true" /> Add device
        </button>
      </li>
    </ul>
  );
}
