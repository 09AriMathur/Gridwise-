import { useCallback } from "react";
import { Bell, BellOff, BellRing, Power, PowerOff, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "../lib/api";
import { deviceById, useDevices } from "../lib/devices";
import {
  sendTest, useNotifications, usePermission, useReminderScheduler, type AppNotification,
} from "../lib/notifications";
import { liveStatus, useTasks, type LocalTask } from "../lib/tasks";
import { fmtClock, minutesAgo } from "../lib/time";
import { DEVICE_ICONS, DEVICE_TONES, IconChip, btnBare, btnLine, btnSolid, iconBtn } from "./common";

// "I turned it on/off" for a manual device. One place, so the bell, the banner,
// the toast and My home all mean the same thing.
export function useDeviceSwitch() {
  const { update } = useTasks();
  const turnOn = useCallback((t: LocalTask) => { update(t.id, { status: "started" }); toast.dismiss(`${t.id}:on`); toast.success("Marked as on", { description: `We'll remind you to turn it off at ${fmtClock(Date.parse(t.end))}.` }); }, [update]);
  const turnOff = useCallback((t: LocalTask) => {
    update(t.id, { status: "finished" }); toast.dismiss(`${t.id}:off`); toast.success("Marked as off. Nice work!");
    if (t.sms) api.cancelTexts(t.id, ["off"]).catch(() => undefined); // no "turn it off" text needed now
  }, [update]);
  const cancel = useCallback((t: LocalTask, message: string) => {
    update(t.id, { status: "cancelled" }); toast.dismiss(`${t.id}:on`); toast(message);
    if (t.sms) api.cancelTexts(t.id).catch(() => undefined);
  }, [update]);
  return { turnOn, turnOff, cancel };
}

/** Runs the reminder checks for the whole app and pops a toast with an action. */
export function ReminderScheduler() {
  const { tasks } = useTasks();
  const { devices } = useDevices();
  const { turnOn, turnOff } = useDeviceSwitch();
  const onRaise = useCallback((n: AppNotification, task: LocalTask) => {
    toast(n.title, {
      id: n.id, // same id as the inbox entry, so acting elsewhere can dismiss it
      description: n.body,
      duration: 20_000,
      action: n.kind === "on" ? { label: "I turned it on", onClick: () => turnOn(task) }
        : n.kind === "off" ? { label: "I turned it off", onClick: () => turnOff(task) } : undefined,
    });
  }, [turnOn, turnOff]);
  useReminderScheduler(tasks, devices, onRaise);
  return null;
}

/** iOS-notification-style banner on every page while a manual device needs switching on or off. */
export function ActionBanner() {
  const { tasks } = useTasks();
  const { devices } = useDevices();
  const { turnOn, turnOff, cancel } = useDeviceSwitch();
  const pending = tasks
    .map((t) => ({ t, s: liveStatus(t) }))
    .filter(({ t, s }) => !t.smart && (s === "due" || s === "turn_off"))
    .sort((a, b) => Date.parse(a.t.start) - Date.parse(b.t.start));
  if (!pending.length) return null;

  return (
    <div className="mb-6 space-y-3">
      {pending.map(({ t, s }) => {
        const device = deviceById(devices, t.appliance);
        const on = s === "due";
        const Icon = DEVICE_ICONS[device.type] ?? DEVICE_ICONS.other;
        return (
          <div key={t.id} role="status"
            className="animate-rise-in rounded-[22px] bg-card p-4 shadow-[0_8px_30px_rgb(0_0_0/0.08)] ring-[0.5px] ring-border dark:shadow-none">
            <div className="flex items-start gap-3">
              <IconChip icon={Icon} tone={DEVICE_TONES[device.type] ?? "gray"} className="size-10" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-footnote font-semibold uppercase tracking-[0.02em] text-muted-foreground">GridWise · Reminder</p>
                  <span className={cn("text-footnote flex items-center gap-1 font-semibold", on ? "text-primary" : "text-warning")}>
                    <span className={cn("size-1.5 animate-pulse rounded-full", on ? "bg-primary" : "bg-warning")} /> now
                  </span>
                </div>
                <p className="text-headline mt-0.5">{on ? `Turn on your ${device.name.toLowerCase()}` : `Turn off your ${device.name.toLowerCase()}`}</p>
                <p className="text-subheadline text-muted-foreground">
                  {on ? `The grid is at its cleanest until ${fmtClock(Date.parse(t.end))}.` : `Its clean window ended at ${fmtClock(Date.parse(t.end))}.`}
                </p>
                <div className="mt-3 flex gap-2">
                  {on ? (
                    <>
                      <Button className={cn(btnSolid, "h-9 flex-1 rounded-full px-4 text-[15px] sm:flex-none")} onClick={() => turnOn(t)}>
                        <Power className="size-4" strokeWidth={2.5} aria-hidden="true" /> I turned it on
                      </Button>
                      <Button className={cn(btnLine, "h-9 rounded-full px-4 text-[15px]")}
                        onClick={() => cancel(t, `Skipped this run of ${device.name}`)}>
                        Skip
                      </Button>
                    </>
                  ) : (
                    <Button className={cn(btnSolid, "h-9 flex-1 rounded-full px-4 text-[15px] sm:flex-none")} onClick={() => turnOff(t)}>
                      <PowerOff className="size-4" strokeWidth={2.5} aria-hidden="true" /> I turned it off
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const KIND_UI = {
  on: { icon: Power, tone: "green" as const },
  off: { icon: PowerOff, tone: "orange" as const },
  test: { icon: BellRing, tone: "indigo" as const },
};

/** Header bell with unread count, permission controls and the inbox. */
export function NotificationBell() {
  const { items, unread, markRead, markAllRead, clear } = useNotifications();
  const { permission, ask } = usePermission();
  const { tasks } = useTasks();
  const { devices } = useDevices();
  const { turnOn, turnOff } = useDeviceSwitch();

  async function enable() {
    const p = await ask();
    if (p === "granted") { sendTest(); toast.success("Desktop notifications on"); }
    else if (p === "denied") toast.error("Notifications are blocked", { description: "Allow them for this site in your browser settings." });
  }

  return (
    <Popover onOpenChange={(open) => { if (!open && unread) markAllRead(); }}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(iconBtn, "relative")} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell className="size-[18px]" strokeWidth={2.25} aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ios-red px-1 text-[11px] font-semibold leading-none text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-[min(92vw,24rem)] rounded-[18px] bg-popover p-0 ring-0 shadow-[0_20px_60px_rgb(0_0_0/0.22)]">
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <p className="text-title-3">Notifications</p>
          {items.length > 0 && (
            <button type="button" onClick={clear} className={btnBare}>Clear</button>
          )}
        </div>

        {/* Permission state */}
        <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl bg-secondary p-3">
          <IconChip icon={permission === "granted" ? BellRing : BellOff} tone={permission === "granted" ? "green" : "orange"} />
          <div className="text-subheadline min-w-0 flex-1">
            {permission === "granted" && <><p className="font-medium">Desktop alerts on</p><p className="text-xs text-muted-foreground">Keep GridWise open in a tab to get them.</p></>}
            {permission === "default" && <><p className="font-medium">Get turn-on/off alerts</p><p className="text-xs text-muted-foreground">For devices without a smart plug.</p></>}
            {permission === "denied" && <><p className="font-medium">Alerts blocked</p><p className="text-xs text-muted-foreground">Allow notifications for this site in browser settings. Reminders still show here.</p></>}
            {permission === "unsupported" && <><p className="font-medium">Not supported here</p><p className="text-xs text-muted-foreground">This browser can't show alerts. Reminders still show here.</p></>}
          </div>
          {permission === "default" && <Button className={cn(btnSolid, "h-8 rounded-full px-3.5 text-[13px]")} onClick={enable}>Turn On</Button>}
          {permission === "granted" && (
            <Button variant="outline" className={cn(btnLine, "h-8 rounded-full bg-card px-3.5 text-[13px] dark:bg-card")} onClick={() => { sendTest(); toast("Test notification sent"); }}>
              <Send className="size-3.5" aria-hidden="true" /> Test
            </Button>
          )}
        </div>

        <ul className="scrollbar-thin max-h-[min(60vh,26rem)] overflow-y-auto px-3 pb-3">
          {items.length === 0 && (
            <li className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <IconChip icon={Bell} tone="indigo" className="size-12" />
              <p className="text-headline">No Notifications</p>
              <p className="text-footnote text-muted-foreground">Schedule a non-smart device and we'll remind you when to turn it on and off.</p>
            </li>
          )}
          {items.map((n) => {
            const ui = KIND_UI[n.kind];
            const task = n.taskId ? tasks.find((t) => t.id === n.taskId) : undefined;
            const s = task ? liveStatus(task) : null;
            const canOn = n.kind === "on" && task && (s === "due" || s === "scheduled");
            const canOff = n.kind === "off" && task && (s === "turn_off" || s === "started");
            const device = task ? deviceById(devices, task.appliance) : null;
            return (
              <li key={n.id} className={cn("flex gap-3 rounded-xl p-3 transition-colors", !n.read && "bg-accent")} onMouseEnter={() => { if (!n.read) markRead(n.id); }}>
                <IconChip icon={device && n.kind !== "test" ? DEVICE_ICONS[device.type] ?? ui.icon : ui.icon}
                  tone={device && n.kind !== "test" ? DEVICE_TONES[device.type] ?? ui.tone : ui.tone} className="size-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-subheadline font-semibold">{n.title}</p>
                    {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </div>
                  <p className="text-footnote mt-0.5 text-muted-foreground">{n.body}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-caption-1 text-muted-foreground">{minutesAgo(n.at)}</span>
                    {canOn && (
                      <Button className={cn(btnSolid, "h-7 rounded-full px-3 text-[13px]")} onClick={() => turnOn(task!)}>
                        <ui.icon className="size-3.5" aria-hidden="true" /> I turned it on
                      </Button>
                    )}
                    {canOff && (
                      <Button className={cn(btnSolid, "h-7 rounded-full px-3 text-[13px]")} onClick={() => turnOff(task!)}>
                        <ui.icon className="size-3.5" aria-hidden="true" /> I turned it off
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
