import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "../lib/api";
import { MAX_DEVICES, TYPE_PRESETS, type DeviceType, type HomeDevice } from "../lib/devices";
import { cn } from "@/lib/utils";
import { DEVICE_ICONS, DEVICE_TONES, FieldError, IconChip, Toggle, btnLine, btnSolid, fieldCls, labelCls } from "./common";

type Props = {
  open: boolean;
  existing?: HomeDevice | null;      // edit mode when set
  names: string[];                   // other device names, to prevent duplicates
  onClose: () => void;
  onSave: (d: Omit<HomeDevice, "id">) => void;
};

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export default function DeviceDialog({ open, existing, names, onClose, onSave }: Props) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<DeviceType>("ev");
  const [smart, setSmart] = useState(true);
  const [hours, setHours] = useState("3");
  const [kwh, setKwh] = useState("10");
  const [plugHost, setPlugHost] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const src = existing;
    setName(src?.name ?? ""); setType(src?.type ?? "ev"); setSmart(src?.smart ?? TYPE_PRESETS.ev.smart);
    setHours(String(src?.hours ?? TYPE_PRESETS.ev.hours)); setKwh(String(src?.kwh ?? TYPE_PRESETS.ev.kwh));
    setPlugHost(src?.plugHost ?? ""); setErrors({});
  }, [open, existing]);

  function pickType(t: DeviceType) {
    setType(t);
    const p = TYPE_PRESETS[t];
    setHours(String(p.hours)); setKwh(String(p.kwh)); setSmart(p.smart);
    if (!name.trim() || Object.values(TYPE_PRESETS).some((x) => x.label === name)) setName(p.label === "Other" ? "" : p.label);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const n = name.trim(), h = Number(hours), k = Number(kwh);
    if (!existing && names.length >= MAX_DEVICES) errs.name = `You can have up to ${MAX_DEVICES} devices. Remove one first.`;
    else if (!n) errs.name = "Give it a name.";
    else if (n.length > 30) errs.name = "Keep it under 30 characters.";
    else if (names.some((x) => x.toLowerCase() === n.toLowerCase())) errs.name = "You already have a device with this name.";
    if (!Number.isFinite(h) || h < 0.25 || h > 24) errs.hours = "Enter 0.25 to 24 hours.";
    if (!Number.isFinite(k) || k <= 0 || k > 150) errs.kwh = "Enter a number above 0.";
    if (smart && plugHost.trim() && !IPV4.test(plugHost.trim())) errs.plugHost = "Enter an IP like 192.168.1.42, or leave it blank.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const device: Omit<HomeDevice, "id"> = {
      name: n, type, smart, hours: h, kwh: k,
      plugHost: smart && plugHost.trim() ? plugHost.trim() : undefined,
      simulated: !(smart && plugHost.trim()),
    };
    setSaving(true);
    if (!existing) await api.createDevice(device).catch(() => undefined); // saved locally regardless
    setSaving(false);
    onSave(device);
  }

  const clear = (k: string) => setErrors((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; });
  const TypeIcon = DEVICE_ICONS[type];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="gap-0 rounded-[22px] bg-popover p-0 ring-0 shadow-[0_20px_60px_rgb(0_0_0/0.25)] sm:max-w-md"
        onOpenAutoFocus={(e) => { e.preventDefault(); nameRef.current?.focus(); }}>
        <form onSubmit={submit} noValidate className="space-y-4 p-5 sm:p-6">
          <DialogHeader className="flex-row items-center gap-3.5 space-y-0 pr-8 text-left">
            <IconChip icon={TypeIcon} tone={DEVICE_TONES[type]} className="size-12" />
            <div>
              <DialogTitle className="text-title-3">{existing ? "Edit device" : "Add a device"}</DialogTitle>
              <DialogDescription className="text-footnote">{existing ? "Update how GridWise plans for it." : "GridWise plans its runs around the cleanest hours."}</DialogDescription>
            </div>
          </DialogHeader>

          <div>
            <Label htmlFor="dev-type" className={labelCls}>Type</Label>
            <Select value={type} onValueChange={(v) => pickType(v as DeviceType)}>
              <SelectTrigger id="dev-type" className={cn(fieldCls, "w-full data-[size=default]:h-11")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl p-1 shadow-[0_10px_40px_rgb(0_0_0/0.16)]">
                {(Object.keys(TYPE_PRESETS) as DeviceType[]).map((t) => {
                  const Icon = DEVICE_ICONS[t];
                  return (
                    <SelectItem key={t} value={t} className="rounded-md py-2 text-[15px]">
                      <Icon className="text-muted-foreground" aria-hidden="true" /> {TYPE_PRESETS[t].label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="dev-name" className={labelCls}>Name</Label>
            <Input ref={nameRef} id="dev-name" className={fieldCls} value={name} maxLength={40} placeholder="e.g. Garage EV charger"
              onChange={(e) => { setName(e.target.value); clear("name"); }} aria-invalid={!!errors.name} />
            <FieldError>{errors.name}</FieldError>
          </div>

          <Toggle id="dev-smart" label="Smart plug" checked={smart} onChange={setSmart}
            hint={smart ? "GridWise switches it on at the cleanest time." : "GridWise reminds you when it's time to start it."} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dev-hours" className={labelCls}>Run time (hours)</Label>
              <Input id="dev-hours" type="number" inputMode="decimal" step="0.25" className={fieldCls}
                value={hours} onChange={(e) => { setHours(e.target.value); clear("hours"); }} aria-invalid={!!errors.hours} />
              <FieldError>{errors.hours}</FieldError>
            </div>
            <div>
              <Label htmlFor="dev-kwh" className={labelCls}>Energy (kWh)</Label>
              <Input id="dev-kwh" type="number" inputMode="decimal" step="0.1" className={fieldCls}
                value={kwh} onChange={(e) => { setKwh(e.target.value); clear("kwh"); }} aria-invalid={!!errors.kwh} />
              <FieldError>{errors.kwh}</FieldError>
            </div>
          </div>

          {smart && (
            <div>
              <Label htmlFor="dev-ip" className={labelCls}>Smart plug IP address <span className="opacity-70">(optional)</span></Label>
              <Input id="dev-ip" inputMode="decimal" className={fieldCls} placeholder="192.168.1.42 (leave blank to simulate)"
                value={plugHost} onChange={(e) => { setPlugHost(e.target.value); clear("plugHost"); }} aria-invalid={!!errors.plugHost} />
              <FieldError>{errors.plugHost}</FieldError>
            </div>
          )}

          <DialogFooter className="mx-0 mb-0 gap-2 border-0 bg-transparent p-0 pt-2">
            <Button type="button" variant="outline" className={cn(btnLine, "sm:flex-1")} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className={cn(btnSolid, "sm:flex-1")}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {existing ? "Save changes" : "Add device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
