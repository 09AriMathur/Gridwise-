// Shapes the UI works with. api.ts maps backend responses into these.
export type Level = "low" | "moderate" | "high";

export type GridNow = { intensity: number; level: Level; timestamp: string; source: string };
export type ForecastPoint = { ts: string; intensity: number };
export type Forecast = { points: ForecastPoint[]; source: string };

export type Appliance = {
  id: string;
  name: string;
  duration_min: number;
  energy_kwh: number;
  plug_compatible: boolean;
};

export type DeviceKind = "smart" | "simulated" | "manual";
export type Device = {
  id: number;
  name: string;
  kind: DeviceKind;
  status: string;
  next_start: string | null;
};

export type TaskInput = {
  appliance: string;
  device_id: number | null;
  duration_min: number;
  energy_kwh: number;
  deadline: string;
  availability: { start: string; end: string }[];
  phone: string | null;
};

export type Plan = {
  id?: number;
  planned_start: string;
  planned_end: string;
  avg_intensity_best: number;
  avg_intensity_now: number;
  co2_avoided_g: number;
  forecast_source: string;
  status?: string;
};

export type Task = Plan & { id: number; appliance: string; status: string };
