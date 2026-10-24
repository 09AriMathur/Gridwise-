const TZ = "America/New_York";

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

export function fmtDayTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TZ, weekday: "short", hour: "numeric", minute: "2-digit",
  });
}

export function minutesAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins)) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} h ago`;
}

// datetime-local value (browser local time) -> ISO string with timezone (UTC "Z").
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

// Date -> value accepted by <input type="datetime-local">, in browser local time.
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function grams(g: number): string {
  return g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${Math.round(g)} g`;
}

// "07:00" -> the next time it's 7:00 after `after` (today or tomorrow), in browser local time.
export function nextAt(hhmm: string, after: number): number {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(after);
  d.setHours(h || 0, m || 0, 0, 0);
  if (d.getTime() <= after) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// Daily availability window like 21:00–23:30 (may cross midnight), the occurrence that hasn't ended yet.
export function dailySpan(from: string, until: string, now: number): { start: number; end: number } {
  const [fh, fm] = from.split(":").map(Number);
  const [uh, um] = until.split(":").map(Number);
  const s = new Date(now); s.setHours(fh || 0, fm || 0, 0, 0);
  const e = new Date(s); e.setHours(uh || 0, um || 0, 0, 0);
  if (e.getTime() <= s.getTime()) e.setDate(e.getDate() + 1);
  if (e.getTime() <= now) { s.setDate(s.getDate() + 1); e.setDate(e.getDate() + 1); }
  return { start: s.getTime(), end: e.getTime() };
}

export function fmtHour(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric" }).replace(" ", "").toLowerCase();
}

export function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).toLowerCase();
}
