import type { ReactNode } from "react";
import { Zap, LayoutDashboard, House, LineChart } from "lucide-react";
import { useGrid } from "../lib/grid";
import type { Route } from "../lib/router";
import { LEVEL_UI } from "./ui";

const NAV: { href: Route; label: string; icon: typeof House }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/home", label: "My home", icon: House },
  { href: "/insights", label: "Insights", icon: LineChart },
];

export default function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { now } = useGrid();
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.12),_transparent_55%)] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href="#/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30">
              <Zap className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">GridWise</span>
          </a>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map(({ href, label, icon: Icon }) => (
              <a key={href} href={`#${href}`} aria-current={route === href ? "page" : undefined}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${route === href ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </a>
            ))}
          </nav>

          {now ? (
            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 sm:text-sm ${LEVEL_UI[now.level].pill}`}>
              Grid now: {LEVEL_UI[now.level].text}
            </span>
          ) : (
            <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-slate-400 ring-1 ring-white/10 sm:text-sm">Grid: loading…</span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-12">{children}</main>

      {/* Bottom tab bar on phones */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-slate-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <a key={href} href={`#${href}`} aria-current={route === href ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${route === href ? "text-emerald-300" : "text-slate-400"}`}>
              <Icon className="h-5 w-5" aria-hidden="true" /> {label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
