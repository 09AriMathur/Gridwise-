import type { ReactNode } from "react";
import { ChartColumn, House, LayoutDashboard, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useGrid } from "../lib/grid";
import type { Route } from "../lib/router";
import { fmtDayTime } from "../lib/time";
import { LEVEL_UI } from "./common";
import { ModeToggle } from "./mode-toggle";
import { ActionBanner, NotificationBell, ReminderScheduler } from "./Reminders";

const NAV: { href: Route; label: string; icon: typeof House }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/home", label: "My Home", icon: House },
  { href: "/insights", label: "Insights", icon: ChartColumn },
];

function GridPill() {
  const { now, forecast, mix } = useGrid();
  if (!now) {
    return (
      <span className="flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3 text-[13px] text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> <span className="hidden sm:inline">Grid</span>
      </span>
    );
  }
  const ui = LEVEL_UI[now.level];
  const Icon = ui.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn("flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40", ui.pill)}>
          <Icon className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
          {Math.round(now.intensity)} <span className="font-normal opacity-80">g/kWh</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="rounded-lg text-[13px]">
        {ui.text} right now{mix?.now.sources[0] ? ` · ${Math.round(mix.now.sources[0].percent)}% ${mix.now.sources[0].label.toLowerCase()}` : ""} · {fmtDayTime(now.ts)}{forecast?.source === "synthetic" ? " · sample data" : ""}
      </TooltipContent>
    </Tooltip>
  );
}

export default function Shell({ route, children }: { route: Route; children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background text-foreground">
        {/* Navigation bar: translucent material with a hairline separator. */}
        <header className="material hairline-b sticky top-0 z-30">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
            <a href="#/" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40">
              <span className="grid size-8 place-items-center rounded-[24%] bg-primary text-white">
                <Zap className="size-[18px]" strokeWidth={2.5} fill="currentColor" aria-hidden="true" />
              </span>
              <span className="text-headline hidden min-[400px]:inline">GridWise</span>
            </a>

            {/* macOS-style segmented control for the three pages */}
            <nav aria-label="Main" className="hidden rounded-[9px] bg-secondary p-[2px] md:flex">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = route === href;
                return (
                  <a key={href} href={`#${href}`} aria-current={active ? "page" : undefined}
                    className={cn("flex h-8 items-center gap-1.5 rounded-[7px] px-4 text-[13px] font-semibold transition-all duration-200 ease-ios",
                      active ? "bg-card text-foreground shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] dark:bg-[#636366]" : "text-foreground/75 hover:text-foreground")}>
                    <Icon className="size-4" aria-hidden="true" /> {label}
                  </a>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <GridPill />
              <NotificationBell />
              <ModeToggle />
            </div>
          </div>
        </header>

        <main key={route} className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 md:pb-16 md:pt-8">
          <ActionBanner />
          {children}
        </main>

        {/* iOS tab bar on phones: icon over label, tint for the selected tab. */}
        <nav aria-label="Main" className="material hairline-t fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="mx-auto grid h-[50px] max-w-md grid-cols-3">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = route === href;
              return (
                <a key={href} href={`#${href}`} aria-current={active ? "page" : undefined}
                  className={cn("flex flex-col items-center justify-center gap-0.5 transition-colors", active ? "text-primary" : "text-ios-gray")}>
                  <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                </a>
              );
            })}
          </div>
        </nav>

        <ReminderScheduler />
        <Toaster position="top-center" mobileOffset={{ top: 64 }} offset={{ top: 64 }}
          toastOptions={{ classNames: { toast: "cn-toast !rounded-2xl !shadow-[0_10px_40px_rgb(0_0_0/0.16)]" } }} />
      </div>
    </TooltipProvider>
  );
}
