import type { ReactNode } from "react";
import type { Level } from "../lib/types";

export function Panel({ title, right, children, className = "" }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-lg shadow-black/20 sm:p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-white sm:text-lg">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Note({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  const cls = {
    info: "border-white/10 bg-white/5 text-slate-300",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    error: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export const LEVEL_UI: Record<Level, { text: string; pill: string; dot: string }> = {
  low: { text: "low carbon", pill: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/40", dot: "bg-emerald-400" },
  moderate: { text: "moderate", pill: "bg-amber-500/15 text-amber-300 ring-amber-400/40", dot: "bg-amber-400" },
  high: { text: "high carbon", pill: "bg-orange-600/90 text-white ring-orange-300/40", dot: "bg-white" },
};

export const fieldCls =
  "w-full min-h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-base text-white placeholder:text-slate-500 transition focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50";
export const labelCls = "mb-1.5 block text-sm font-medium text-slate-300";

export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm font-medium text-slate-200">{label}</label>
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-emerald-500" : "bg-slate-600"} focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/30`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
