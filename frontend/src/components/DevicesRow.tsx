import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HomeDevice } from "../lib/devices";
import { fmtClock } from "../lib/time";
import { liveStatus, type LocalTask } from "../lib/tasks";
import { DEVICE_ICONS, DEVICE_TONES, IconChip } from "./common";

type Tone = "green" | "orange" | "idle";

export function deviceState(deviceId: string, tasks: LocalTask[]): { tone: Tone; line: string; pulse?: boolean } {
  const active = tasks
    .filter((t) => t.appliance === deviceId && !["done", "cancelled"].includes(liveStatus(t)))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  if (!active) return { tone: "idle", line: "No task scheduled" };
  const s = liveStatus(active);
  const at = fmtClock(Date.parse(active.start));
  if (s === "running") return { tone: "green", line: `Running until ${fmtClock(Date.parse(active.end))}`, pulse: true };
  if (s === "started") return { tone: "green", line: `On · turn off at ${fmtClock(Date.parse(active.end))}` };
  if (s === "due") return { tone: "orange", line: "Turn it on now", pulse: true };
  if (s === "turn_off") return { tone: "orange", line: "Turn it off now", pulse: true };
  return active.smart ? { tone: "green", line: `Auto start ${at}` } : { tone: "orange", line: `Reminder at ${at}` };
}

export const TONE_DOT: Record<Tone, string> = { green: "bg-success", orange: "bg-warning", idle: "bg-ios-gray/50" };
const TONE_TEXT: Record<Tone, string> = { green: "text-success", orange: "text-warning", idle: "text-muted-foreground" };

type Props = { devices: HomeDevice[]; tasks: LocalTask[]; onPick: (id: string) => void; onAdd: () => void };

// Accessory tiles, like the Home app.
export default function DevicesRow({ devices, tasks, onPick, onAdd }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {devices.map((d) => {
        const st = deviceState(d.id, tasks);
        const Icon = DEVICE_ICONS[d.type] ?? DEVICE_ICONS.other;
        return (
          <li key={d.id}>
            <button type="button" onClick={() => onPick(d.id)}
              className="flex h-full min-h-[120px] w-full flex-col justify-between gap-4 rounded-2xl bg-card p-3.5 text-left transition-transform duration-200 ease-ios active:scale-[0.97] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40">
              <IconChip icon={Icon} tone={DEVICE_TONES[d.type] ?? "gray"} variant="tint" className="size-10 rounded-full" />
              <span className="min-w-0">
                <span className="text-subheadline block truncate font-semibold">{d.name}</span>
                <span className={cn("text-footnote flex items-center gap-1.5", TONE_TEXT[st.tone])}>
                  <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[st.tone], st.pulse && "animate-pulse")} aria-hidden="true" />
                  <span className="truncate">{st.line}</span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
      <li>
        <button type="button" onClick={onAdd}
          className="flex h-full min-h-[120px] w-full flex-col justify-between gap-4 rounded-2xl border-[1.5px] border-dashed border-border p-3.5 text-left text-primary transition-transform duration-200 ease-ios active:scale-[0.97] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40">
          <span className="grid size-10 place-items-center rounded-full bg-accent">
            <Plus className="size-5" strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span className="text-subheadline font-semibold">Add Device</span>
        </button>
      </li>
    </ul>
  );
}
