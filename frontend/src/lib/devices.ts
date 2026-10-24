import { useCallback, useEffect, useState } from "react";

export type DeviceType = "ev" | "washer" | "dryer" | "dishwasher" | "water_heater" | "space_heater" | "other";

export type HomeDevice = {
  id: string;
  name: string;
  type: DeviceType;
  smart: boolean;       // smart plug = starts automatically; manual = reminder
  hours: number;        // typical run time
  kwh: number;          // energy per run (estimate, editable)
  plugHost?: string;    // optional smart plug IP for real control
  simulated: boolean;
};

// Defaults per type. Energy values are rough estimates; replace with cited figures before the demo.
export const TYPE_PRESETS: Record<DeviceType, { label: string; hours: number; kwh: number; smart: boolean }> = {
  ev: { label: "EV charger", hours: 3, kwh: 10, smart: true },
  washer: { label: "Washing machine", hours: 1, kwh: 0.5, smart: false },
  dryer: { label: "Clothes dryer", hours: 1, kwh: 3, smart: false },
  dishwasher: { label: "Dishwasher", hours: 2, kwh: 1.5, smart: false },
  water_heater: { label: "Water heater", hours: 2, kwh: 4, smart: true },
  space_heater: { label: "Space heater", hours: 2, kwh: 3, smart: true },
  other: { label: "Other", hours: 1, kwh: 1, smart: false },
};

const SEED: HomeDevice[] = [
  { id: "ev", name: "Car charger", type: "ev", smart: true, hours: 3, kwh: 10, simulated: true },
  { id: "washer", name: "Washing machine", type: "washer", smart: false, hours: 1, kwh: 0.5, simulated: true },
  { id: "dishwasher", name: "Dishwasher", type: "dishwasher", smart: false, hours: 2, kwh: 1.5, simulated: true },
  { id: "dryer", name: "Clothes dryer", type: "dryer", smart: false, hours: 1, kwh: 3, simulated: true },
];

export const FALLBACK_DEVICE: HomeDevice = { id: "none", name: "Appliance", type: "other", smart: false, hours: 1, kwh: 1, simulated: true };

const KEY = "gridwise.devices.v1";
const EVENT = "gridwise-devices";

function read(): HomeDevice[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return SEED;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidDevice) : SEED;
  } catch {
    return SEED;
  }
}

export const MAX_DEVICES = 20;

function isValidDevice(d: unknown): d is HomeDevice {
  const x = d as HomeDevice;
  return !!x && typeof x.id === "string" && typeof x.name === "string" && x.name.trim().length > 0
    && x.type in TYPE_PRESETS && typeof x.smart === "boolean"
    && Number.isFinite(x.hours) && x.hours > 0 && x.hours <= 24
    && Number.isFinite(x.kwh) && x.kwh > 0 && x.kwh <= 150;
}

function write(list: HomeDevice[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(EVENT));
}

export function deviceById(list: HomeDevice[], id: string): HomeDevice {
  return list.find((d) => d.id === id) ?? list[0] ?? FALLBACK_DEVICE;
}

export function useDevices() {
  const [devices, setDevices] = useState<HomeDevice[]>(read);

  useEffect(() => {
    const sync = () => setDevices(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);

  const add = useCallback((d: Omit<HomeDevice, "id">) => {
    const device = { ...d, id: crypto.randomUUID() };
    write([...read(), device]);
    return device;
  }, []);
  const update = useCallback((id: string, patch: Partial<HomeDevice>) =>
    write(read().map((d) => (d.id === id ? { ...d, ...patch } : d))), []);
  const remove = useCallback((id: string) => write(read().filter((d) => d.id !== id)), []);
  const reset = useCallback(() => write(SEED), []);

  return { devices, add, update, remove, reset };
}
