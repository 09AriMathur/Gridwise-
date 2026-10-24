import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { api } from "../lib/api";
import { MAX_DEVICES, TYPE_PRESETS, type DeviceType, type HomeDevice } from "../lib/devices";
import { Toggle, fieldCls, labelCls } from "./ui";

type Props = {
  open: boolean;
  existing?: HomeDevice | null;      // edit mode when set
  names: string[];                   // other device names, to prevent duplicates
  onClose: () => void;
  onSave: (d: Omit<HomeDevice, "id">) => void;
};

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export default function DeviceDialog({ open, existing, names, onClose, onSave }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<DeviceType>("ev");
  const [smart, setSmart] = useState(true);
  const [hours, setHours] = useState("3");
  const [kwh, setKwh] = useState("10");
  const [plugHost, setPlugHost] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      const src = existing;
      setName(src?.name ?? ""); setType(src?.type ?? "ev"); setSmart(src?.smart ?? TYPE_PRESETS.ev.smart);
      setHours(String(src?.hours ?? TYPE_PRESETS.ev.hours)); setKwh(String(src?.kwh ?? TYPE_PRESETS.ev.kwh));
      setPlugHost(src?.plugHost ?? ""); setErrors({});
      d.showModal();
    } else if (!open && d.open) d.close();
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
  const err = (k: string) => errors[k] ? <p className="mt-1 text-sm text-rose-300">{errors[k]}</p> : null;

  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose}
      className="m-auto w-[min(92vw,30rem)] rounded-2xl border border-white/10 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm">
      <form onSubmit={submit} noValidate className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{existing ? "Edit device" : "Add a device"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div>
          <label htmlFor="dev-type" className={labelCls}>Type</label>
          <select id="dev-type" className={fieldCls} value={type} onChange={(e) => pickType(e.target.value as DeviceType)}>
            {(Object.keys(TYPE_PRESETS) as DeviceType[]).map((t) => <option key={t} value={t}>{TYPE_PRESETS[t].label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="dev-name" className={labelCls}>Name</label>
          <input id="dev-name" className={fieldCls} value={name} maxLength={40} placeholder="e.g. Garage EV charger"
            onChange={(e) => { setName(e.target.value); clear("name"); }} aria-invalid={!!errors.name} autoFocus />
          {err("name")}
        </div>

        <Toggle id="dev-smart" label="Smart plug (starts automatically)" checked={smart} onChange={setSmart} />
        <p className="-mt-2 text-xs text-slate-500">
          {smart ? "GridWise switches it on at the cleanest time." : "GridWise sends you a reminder when it's time to start it."}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="dev-hours" className={labelCls}>Run time (hours)</label>
            <input id="dev-hours" type="number" inputMode="decimal" step="0.25" className={fieldCls}
              value={hours} onChange={(e) => { setHours(e.target.value); clear("hours"); }} aria-invalid={!!errors.hours} />
            {err("hours")}
          </div>
          <div>
            <label htmlFor="dev-kwh" className={labelCls}>Energy per run (kWh)</label>
            <input id="dev-kwh" type="number" inputMode="decimal" step="0.1" className={fieldCls}
              value={kwh} onChange={(e) => { setKwh(e.target.value); clear("kwh"); }} aria-invalid={!!errors.kwh} />
            {err("kwh")}
          </div>
        </div>

        {smart && (
          <div>
            <label htmlFor="dev-ip" className={labelCls}>Smart plug IP address <span className="font-normal text-slate-500">(optional)</span></label>
            <input id="dev-ip" inputMode="decimal" className={fieldCls} placeholder="192.168.1.42 (leave blank to simulate)"
              value={plugHost} onChange={(e) => { setPlugHost(e.target.value); clear("plugHost"); }} aria-invalid={!!errors.plugHost} />
            {err("plugHost")}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-white/15 px-4 font-medium text-slate-200 hover:bg-white/5">Cancel</button>
          <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-emerald-500 px-5 font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60">
            {existing ? "Save changes" : "Add device"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
