import type { ReactNode } from "react";
import {
  CarFront, ChevronRight, CircleAlert, Droplets, Factory, Gauge, Heater, Info, Leaf, Plug, TriangleAlert,
  UtensilsCrossed, WashingMachine, Wind, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import type { DeviceType } from "../lib/devices";
import type { Level } from "../lib/types";

// Apple HIG toolkit: inset-grouped sections, Settings-style icon squircles,
// filled / gray / plain buttons, iOS switch and segmented control. Every
// screen pulls its styling from here.

export const meta = "text-footnote text-muted-foreground";
// Filled button (primary action). Apple dims on press rather than moving.
export const btnSolid = "h-[50px] rounded-xl bg-primary px-5 text-[17px] font-semibold text-primary-foreground shadow-none transition-opacity duration-200 hover:bg-primary hover:opacity-90 active:opacity-70";
// Gray button (secondary action).
export const btnLine = "h-[50px] rounded-xl border-0 bg-secondary px-5 text-[17px] font-semibold text-primary shadow-none transition-opacity duration-200 hover:bg-secondary hover:opacity-80 active:opacity-60 dark:bg-secondary dark:hover:bg-secondary";
// Tinted button.
export const btnTinted = "h-[50px] rounded-xl bg-accent px-5 text-[17px] font-semibold text-accent-foreground shadow-none transition-opacity duration-200 hover:bg-accent hover:opacity-85 active:opacity-70";
// Plain (text) button.
export const btnBare = "h-auto rounded-md px-1.5 py-1 text-[15px] font-normal text-primary hover:bg-transparent hover:opacity-70 active:opacity-50";
// Circular toolbar button.
export const iconBtn = "grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-primary transition-opacity duration-200 hover:opacity-80 active:opacity-60";

// iOS system colours for icon squircles.
export type Tone = "indigo" | "green" | "orange" | "blue" | "violet" | "teal" | "red" | "gray";
export const TONE_SOLID: Record<Tone, string> = {
  indigo: "bg-ios-indigo", green: "bg-ios-green", orange: "bg-ios-orange", blue: "bg-ios-blue",
  violet: "bg-ios-purple", teal: "bg-ios-teal", red: "bg-ios-red", gray: "bg-ios-gray",
};
export const TONE_TEXT: Record<Tone, string> = {
  indigo: "text-ios-indigo", green: "text-ios-green", orange: "text-ios-orange", blue: "text-ios-blue",
  violet: "text-ios-purple", teal: "text-ios-teal", red: "text-ios-red", gray: "text-ios-gray",
};
export const TONE_TINT: Record<Tone, string> = {
  indigo: "bg-ios-indigo/15 text-ios-indigo", green: "bg-ios-green/15 text-ios-green", orange: "bg-ios-orange/15 text-ios-orange",
  blue: "bg-ios-blue/15 text-ios-blue", violet: "bg-ios-purple/15 text-ios-purple", teal: "bg-ios-teal/15 text-ios-teal",
  red: "bg-ios-red/15 text-ios-red", gray: "bg-ios-gray/15 text-ios-gray",
};
/** @deprecated kept for older call sites; same as TONE_TINT. */
export const TONE = TONE_TINT;

export function Frame({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={cn("grid gap-6", className)}>{children}</div>;
}

export function Meta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={cn(meta, className)}>{children}</span>;
}

/** Large title, like an iOS navigation bar: small uppercase date line above. */
export function PageTitle({ kicker, title, sub, action }: { kicker?: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <section className="animate-rise-in flex items-end justify-between gap-4 px-1">
      <div className="min-w-0">
        {kicker && <p className="text-footnote font-semibold uppercase tracking-[0.02em] text-muted-foreground">{kicker}</p>}
        <h1 className="text-large-title mt-0.5">{title}</h1>
        {sub && <p className="text-subheadline mt-1.5 max-w-2xl text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </section>
  );
}

/** An inset-grouped section: header outside, content in a rounded card. */
export function Panel({ title, icon: Icon, tone = "indigo", right, rightOnMobile = true, children, className = "", bodyClassName = "" }: {
  title?: string; icon?: LucideIcon; tone?: Tone; right?: ReactNode; rightOnMobile?: boolean; children: ReactNode;
  className?: string; bodyClassName?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col", className)}>
      {(title || right) && (
        <header className="mb-2 flex min-h-8 items-end justify-between gap-3 px-1">
          {title && (
            <h2 className="text-title-3 flex min-w-0 items-center gap-2">
              {Icon && <Icon className={cn("size-5 shrink-0", TONE_TEXT[tone])} strokeWidth={2.25} aria-hidden="true" />}
              <span className="truncate">{title}</span>
            </h2>
          )}
          {right && <div className={cn("shrink-0 items-center", rightOnMobile ? "flex" : "hidden sm:flex")}>{right}</div>}
        </header>
      )}
      <div className={cn("flex-1 rounded-2xl bg-card p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Rows inside a grouped card, with separators inset past the icon (iOS lists). */
export function Row({ icon, tone = "gray", title, subtitle, detail, right, onClick, className = "" }: {
  icon?: LucideIcon; tone?: Tone; title: ReactNode; subtitle?: ReactNode; detail?: ReactNode; right?: ReactNode;
  onClick?: () => void; className?: string;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <li className={cn("group/row", className)}>
      <Wrapper {...(onClick ? { type: "button" as const, onClick } : {})}
        className={cn("flex w-full items-center gap-3 pl-4 text-left", onClick && "transition-colors active:bg-secondary")}>
        {icon && <IconChip icon={icon} tone={tone} />}
        <div className="flex min-w-0 flex-1 items-center gap-3 border-b-[0.5px] border-border py-3 pr-4 group-last/row:border-b-0">
          <div className="min-w-0 flex-1">
            <div className="text-[17px] leading-[22px] tracking-[-0.014em]">{title}</div>
            {subtitle && <div className="text-subheadline text-muted-foreground">{subtitle}</div>}
          </div>
          {detail && <div className="text-[17px] text-muted-foreground">{detail}</div>}
          {right}
          {onClick && !right && <ChevronRight className="size-4 shrink-0 text-tertiary-foreground" strokeWidth={2.5} aria-hidden="true" />}
        </div>
      </Wrapper>
    </li>
  );
}

const NOTE_UI = {
  info: { icon: Info, tone: "blue" as Tone },
  warn: { icon: TriangleAlert, tone: "orange" as Tone },
  error: { icon: CircleAlert, tone: "red" as Tone },
};

export function Note({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  const { icon, tone: chip } = NOTE_UI[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className="flex items-start gap-3 rounded-2xl bg-card px-4 py-3">
      <IconChip icon={icon} tone={chip} className="size-7" />
      <p className={cn("text-subheadline pt-1", tone === "error" ? "text-destructive" : "text-foreground")}>{children}</p>
    </div>
  );
}

export const LEVEL_UI: Record<Level, { text: string; pill: string; dot: string; icon: LucideIcon; tone: Tone }> = {
  low: { text: "Low carbon", pill: "bg-success/15 text-success", dot: "bg-success", icon: Leaf, tone: "green" },
  moderate: { text: "Moderate", pill: "bg-warning/15 text-warning", dot: "bg-warning", icon: Gauge, tone: "orange" },
  high: { text: "High carbon", pill: "bg-danger/15 text-danger", dot: "bg-danger", icon: Factory, tone: "red" },
};

export const DEVICE_ICONS: Record<DeviceType, LucideIcon> = {
  ev: CarFront,
  washer: WashingMachine,
  dryer: Wind,
  dishwasher: UtensilsCrossed,
  water_heater: Droplets,
  space_heater: Heater,
  other: Plug,
};

export const DEVICE_TONES: Record<DeviceType, Tone> = {
  ev: "indigo",
  washer: "blue",
  dryer: "violet",
  dishwasher: "teal",
  water_heater: "orange",
  space_heater: "red",
  other: "gray",
};

// iOS-style text field: filled, no border, 17pt text on phones.
export const fieldCls = "h-11 rounded-[10px] border-0 bg-secondary px-3 text-[17px] shadow-none md:text-[15px] dark:bg-secondary focus-visible:border-0 focus-visible:ring-[3px] focus-visible:ring-primary/30";
export const labelCls = "mb-1.5 block px-1 text-footnote font-normal text-muted-foreground";

export function FieldError({ children }: { children?: string }) {
  return children ? <p className="text-footnote mt-1.5 px-1 text-destructive">{children}</p> : null;
}

/** The iOS switch: 51×31 track, green when on. */
export function IosSwitch({ checked, onChange, id, label }: { checked: boolean; onChange: (v: boolean) => void; id?: string; label?: string }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300 ease-ios focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40",
        checked ? "bg-[var(--switch-on)]" : "bg-secondary")}>
      <span className={cn("absolute left-[2px] top-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06)] transition-transform duration-300 ease-ios",
        checked && "translate-x-5")} />
    </button>
  );
}

export function Toggle({ checked, onChange, label, id, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; id: string; hint?: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-[17px] font-normal leading-[22px] md:text-[15px]">{label}</Label>
        {hint && <p className="text-footnote text-muted-foreground">{hint}</p>}
      </div>
      <IosSwitch id={id} checked={checked} onChange={onChange} />
    </div>
  );
}

/** iOS segmented control: gray track with a raised thumb. */
export function Segmented<T extends string>({ options, value, onChange, label, className = "" }: {
  options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; label: string; className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex rounded-[9px] bg-secondary p-[2px]", className)}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={cn("h-8 flex-1 rounded-[7px] px-3 text-[13px] font-semibold transition-all duration-200 ease-ios",
            value === v ? "bg-card text-foreground shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] dark:bg-[#636366]" : "text-foreground/80 hover:text-foreground")}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** Health-style summary card: coloured icon + label, big rounded number. */
export function Stat({ icon: Icon, label, value, sub, accent = false, tone }: {
  icon: LucideIcon; label: string; value: string; sub?: string; accent?: boolean; tone?: Tone;
}) {
  const t = tone ?? (accent ? "green" : "indigo");
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl bg-card p-4">
      <p className={cn("text-subheadline flex items-center gap-1.5 font-semibold", TONE_TEXT[t])}>
        <Icon className="size-4" strokeWidth={2.5} aria-hidden="true" /> {label}
      </p>
      <p className="truncate font-rounded text-[28px] font-bold leading-[34px] tracking-[-0.01em] tabular-nums">{value}</p>
      {sub && <p className="text-footnote truncate text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Settings-style icon: white glyph on a coloured squircle. `tint` for large tiles. */
export function IconChip({ icon: Icon, tone = "indigo", className = "", variant = "solid" }: {
  icon: LucideIcon; tone?: Tone; className?: string; variant?: "solid" | "tint";
}) {
  return (
    <span className={cn("grid size-[30px] shrink-0 place-items-center rounded-[24%]",
      variant === "solid" ? cn(TONE_SOLID[tone], "text-white") : TONE_TINT[tone], className)}>
      <Icon className="size-[58%]" strokeWidth={2.25} aria-hidden="true" />
    </span>
  );
}

export function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-caption-1 font-semibold", className)}>{children}</span>;
}
