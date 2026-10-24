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

// What the grid is made of (shares of supply, adding up to 100).
export type MixShare = { key: string; label: string; mw: number; percent: number; lowCarbon: boolean };
export type Mix = { sources: MixShare[]; lowCarbonPct: number; fossilPct: number; importsPct: number; totalMw: number };
export type MixHour = { ts: string; lowCarbonPct: number; fossilPct: number; top: { key: string; label: string; percent: number } | null };
export type GridMix = { zone: string; zoneName: string; now: Mix; forecast: MixHour[] };

export type BacktestRun = {
  id: string; habit_start: string; habit_end: string; habit_avg: number;
  best_start: string; best_end: string; best_avg: number; co2_saved_g: number;
};
export type Backtest = {
  days_requested: number; days_covered: number; flex_hours: number; fresh: boolean;
  days: { habit_start: string; tasks: BacktestRun[] }[];
  per_task: { id: string; co2_saved_g: number }[];
  total_co2_saved_g: number;
  next_ready: string | null;
};
export type BacktestInput = {
  tasks: { id: string; kwh: number; duration_min: number }[];
  habit_minutes: number; tz_offset_min: number; flex_hours: number; days: 1 | 7;
};

export type SmsStatus = { ready: boolean; missing: string[]; trial: boolean | null; reason: string };

export type Plan = {
  id?: number;
  planned_start: string;
  planned_end: string;
  avg_intensity_best: number;
  avg_intensity_now: number;
  co2_avoided_g: number;
  forecast_source: string;
  status?: string;
  window_mix?: Mix | null;
  now_mix?: Mix | null;
};

export type Task = Plan & { id: number; appliance: string; status: string };
