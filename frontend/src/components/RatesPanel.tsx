import { useEffect, useState, type FormEvent } from "react";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TOU_TEMPLATE, describePlan, useRates, type RatePlan } from "../lib/rates";
import { FieldError, Panel, Segmented, Toggle, btnSolid, fieldCls, labelCls } from "./common";

type Draft = { kind: "flat" | "tou"; rate: string; peak: string; offPeak: string; peakStart: string; peakEnd: string; weekdaysOnly: boolean };

function toDraft(p: RatePlan): Draft {
  return p.kind === "flat"
    ? { kind: "flat", rate: String(p.rate), ...stringify(TOU_TEMPLATE) }
    : { kind: "tou", rate: String(p.peak), ...stringify(p) };
}

function stringify(t: { peak: number; offPeak: number; peakStart: string; peakEnd: string; weekdaysOnly: boolean }) {
  return { peak: String(t.peak), offPeak: String(t.offPeak), peakStart: t.peakStart, peakEnd: t.peakEnd, weekdaysOnly: t.weekdaysOnly };
}

const price = (v: string) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 5 && v.trim() !== "" ? n : null; };

export default function RatesPanel() {
  const { plan, save } = useRates();
  const [draft, setDraft] = useState<Draft>(() => toDraft(plan));
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => setDraft(toDraft(plan)), [plan]);

  const set = (patch: Partial<Draft>) => { setDraft((d) => ({ ...d, ...patch })); setErrors({}); };

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const bad = "Enter a price in $/kWh, e.g. 0.28.";
    if (draft.kind === "flat") {
      const rate = price(draft.rate);
      if (rate === null) errs.rate = bad;
      setErrors(errs);
      if (rate === null) return;
      save({ kind: "flat", rate, confirmed: true });
    } else {
      const peak = price(draft.peak), offPeak = price(draft.offPeak);
      if (peak === null) errs.peak = bad;
      if (offPeak === null) errs.offPeak = bad;
      if (!draft.peakStart || !draft.peakEnd) errs.hours = "Pick when peak pricing starts and ends.";
      else if (draft.peakStart === draft.peakEnd) errs.hours = "Peak start and end can't be the same.";
      setErrors(errs);
      if (Object.keys(errs).length || peak === null || offPeak === null) return;
      save({ kind: "tou", peak, offPeak, peakStart: draft.peakStart, peakEnd: draft.peakEnd, weekdaysOnly: draft.weekdaysOnly, confirmed: true });
    }
    toast.success("Rates saved", { description: "Recommendations now show money at your rates." });
  }

  return (
    <Panel title="Electricity Rates" icon={Receipt} tone="orange" className="animate-rise-in"
      right={<span className={cn("text-footnote font-semibold", plan.confirmed ? "text-success" : "text-warning")}>{plan.confirmed ? "From your bill" : "Placeholder"}</span>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-subheadline max-w-2xl text-muted-foreground">
          Timing only changes your bill on a <span className="font-semibold text-foreground">time-of-use</span> plan.
          On a flat rate a run costs the same whenever it happens, and GridWise's win is carbon. Copy the prices from your bill.
        </p>

        <Segmented label="Rate type" className="max-w-sm" value={draft.kind} onChange={(kind) => set({ kind })}
          options={[["flat", "Flat Rate"], ["tou", "Time-of-Use"]] as const} />

        {draft.kind === "flat" ? (
          <div className="max-w-xs">
            <Label htmlFor="rate" className={labelCls}>Price ($/kWh)</Label>
            <Input id="rate" type="number" inputMode="decimal" step="0.01" min="0" className={fieldCls}
              value={draft.rate} onChange={(e) => set({ rate: e.target.value })} aria-invalid={!!errors.rate} />
            <FieldError>{errors.rate}</FieldError>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label htmlFor="peak" className={labelCls}>Peak ($/kWh)</Label>
                <Input id="peak" type="number" inputMode="decimal" step="0.01" min="0" className={fieldCls}
                  value={draft.peak} onChange={(e) => set({ peak: e.target.value })} aria-invalid={!!errors.peak} />
                <FieldError>{errors.peak}</FieldError>
              </div>
              <div>
                <Label htmlFor="offpeak" className={labelCls}>Off-peak ($/kWh)</Label>
                <Input id="offpeak" type="number" inputMode="decimal" step="0.01" min="0" className={fieldCls}
                  value={draft.offPeak} onChange={(e) => set({ offPeak: e.target.value })} aria-invalid={!!errors.offPeak} />
                <FieldError>{errors.offPeak}</FieldError>
              </div>
              <div>
                <Label htmlFor="peak-start" className={labelCls}>Peak starts</Label>
                <Input id="peak-start" type="time" className={fieldCls} value={draft.peakStart} onChange={(e) => set({ peakStart: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="peak-end" className={labelCls}>Peak ends</Label>
                <Input id="peak-end" type="time" className={fieldCls} value={draft.peakEnd} onChange={(e) => set({ peakEnd: e.target.value })} />
              </div>
            </div>
            <FieldError>{errors.hours}</FieldError>
            <div className="max-w-md">
              <Toggle id="weekdays" label="Peak on Weekdays Only" checked={draft.weekdaysOnly} onChange={(v) => set({ weekdaysOnly: v })} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t-[0.5px] border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-footnote text-muted-foreground">Current: <span className="text-foreground">{describePlan(plan)}</span></p>
          <Button type="submit" className={cn(btnSolid, "h-11 px-6")}>Save Rates</Button>
        </div>
      </form>
    </Panel>
  );
}
