export type Status = 'good' | 'warning' | 'critical' | 'active';

export interface SensorReading {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: Status;
  trend: number;
  icon: string;
}

export interface ChartDataPoint {
  time: string;
  temp: number | null;
  outdoorTemp: number | null;
  humidity?: number | null;
  co2: number | null;
  pm25: number | null;
  power: number | null;
  energy: number | null;
  power_base: number | null;
  energy_base: number | null;
  power_ac: number | null;
  power_fan: number | null;
  valve_angle?: number | null;
}

export interface ZoneManagerInfo {
  currentPolicy: 'working_hours' | 'night_eco' | 'eco_standby' | 'manual';
  overrideActive: boolean;
  remainingOverride: number;
  scheduledPolicy: 'working_hours' | 'night_eco' | 'eco_standby';
  aiRecommendation: string;
}

export interface DevicePowerEntry {
  name: string;
  power_w: number;
  enabled: boolean;
  note?: string;
  dynamic?: boolean;
  ratio_of_chiller?: number;
}

export interface BuildingSimSnapshot {
  occupancy: number;
  zone_volume_m3: number;
  airflow: { V_sa: number; V_oa: number; damper_pct: number };
  devices: Record<string, DevicePowerEntry>;
  total_power_w: number;
  energy_step_kwh: number;
  reward: number;
  comfort: { temp_ok: boolean; rh_ok: boolean; co2_ok: boolean; pm_ok: boolean };
  baseline_mode: boolean;
  paper_ref: string;
}

export interface DRLStateEntry {
  label: string;
  value: number;
  norm: number;
}

export interface DRLActionEntry {
  label: string;
  raw: number;
  normalized: number;
}

export interface DRLPanel {
  state: DRLStateEntry[];
  action: DRLActionEntry[];
  physical: Record<string, number>;
  reward: number | null;
  model: string;
}

export interface BuildingInfo {
  building_name: string;
  floor: string;
  zone_id: string;
  occupancy: number;
  occupancy_label: string;
  volume_m3: number;
  sensor_online: boolean;
}

export interface PowerConfig {
  occupancy_count: number;
  electricity_tariff_vnd: number;
  cop: number;
  devices: Record<string, DevicePowerEntry & { power_w: number }>;
}

export interface TelemetryResponse {
  latest: {
    device_id: string | null;
    is_online: boolean;
    temperature: number | null;
    outdoor_temperature: number | null;
    humidity: number | null;
    co2: number | null;
    dust: number | null;
    time: string | null;
    power: number | null;
    energy: number | null;
    power_base: number | null;
    energy_base: number | null;
    power_ac: number | null;
    power_fan: number | null;
    valve_angle?: number | null;
  };
  history: ChartDataPoint[];
  controlState: RemoteControlState | null;
  zoneManager: ZoneManagerInfo;
  building?: BuildingInfo;
  buildingSim?: BuildingSimSnapshot | null;
  drlPanel?: DRLPanel;
  powerConfig?: PowerConfig;
}

export interface HVACState {
  power: boolean;
  mode: 'auto' | 'cool' | 'heat' | 'off' | 'fan';
  targetTemp: number;
  fanSpeed: 'auto' | 'on' | 'off' | 'low' | 'medium' | 'high';
  co2Max: number;
  humidityMax: number;
}

export interface RemoteControlPayload {
  device_id: string;
  power: boolean;
  temp: number;
  operationMode: HVACState['mode'];
  fanPower: HVACState['fanSpeed'];
  co2Max: number;
  humidityMax: number;
  clientId: string;
  requestedAt: string;
}

export interface RemoteControlState extends RemoteControlPayload {
  time: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
}

export interface RemoteControlResponse {
  ok: boolean;
  topic: string;
  command: RemoteControlState;
}

export type DashboardTab = 'overview' | 'building' | 'ai' | 'energy';
