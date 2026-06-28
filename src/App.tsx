import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Thermometer, 
  Droplets, 
  Wind, 
  Activity, 
  Maximize2, 
  Bell, 
  User, 
  History,
  AlertTriangle,
  CloudRain,
  CloudSun,
  MapPin,
  Building2,
  Brain,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import mainLogo from '../img/main_logo_2.png';
import { MetricCard } from './components/MetricCard';
import { SensorHistoryChart } from './components/SensorHistoryChart';
import { TwinComparisonChart } from './components/TwinComparisonChart';
import { TwinSavingsPanel } from './components/TwinSavingsPanel';
import { ControlPanel } from './components/ControlPanel';
import { BuildingVisualization } from './components/BuildingVisualization';
import { DRLModelPanel } from './components/DRLModelPanel';
import { DRLMonthlySavings } from './components/DRLMonthlySavings';
import { EnergyBreakdownChart } from './components/EnergyBreakdownChart';
import { SensorReading, ChartDataPoint, HVACState, Status, TelemetryResponse, RemoteControlPayload, RemoteControlResponse, RemoteControlState, ZoneManagerInfo, DashboardTab, BuildingSimSnapshot, DRLPanel, BuildingInfo, TwinResponse } from './types';
import { cn } from './lib/utils';

// Helper to determine status based on thresholds
const getStatus = (id: string, value: number): Status => {
  if (id === 'temp') {
    if (value > 26 || value < 18) return 'warning';
    return 'good';
  }
  if (id === 'humidity') {
    if (value > 60 || value < 30) return 'warning';
    return 'good';
  }
  if (id === 'co2') {
    if (value > 1000) return 'critical';
    if (value > 800) return 'warning';
    return 'good';
  }
  if (id === 'pm25') {
    if (value > 35) return 'critical';
    if (value > 12) return 'warning';
    return 'good';
  }
  return 'good';
};

interface HanoiWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  minTemp: number;
  maxTemp: number;
  precipitationProbability: number;
  weatherCode: number;
}

type ControlField = keyof HVACState;

interface PendingControl {
  commandId: number;
  previousState: HVACState;
  desiredState: HVACState;
  fields: ControlField[];
}

interface ToastMessage {
  id: number;
  type: 'error' | 'info';
  message: string;
}

const CONTROL_FIELDS: ControlField[] = ['power', 'mode', 'targetTemp', 'fanSpeed'];

const getOrCreateClientId = () => {
  const key = 'smart-hvac-client-id';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const next = window.crypto?.randomUUID?.() ?? `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, next);
  return next;
};

const remoteToHVACState = (controlState: RemoteControlState): HVACState => ({
  power: controlState.power,
  mode: controlState.operationMode as any,
  targetTemp: controlState.temp,
  fanSpeed: controlState.fanPower as any,
  co2Max: controlState.co2Max ?? 800,
  humidityMax: controlState.humidityMax ?? 60,
});

const getControlRevision = (controlState: RemoteControlState) =>
  controlState.lastModifiedAt || controlState.time;

const formatClientLabel = (id: string) => `Người dùng ${id === 'unknown' ? 'khác' : id.slice(-6)}`;

const getWeatherLabel = (code: number) => {
  if (code === 0) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Partly Cloudy';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Cloudy';
};

export default function App() {
  // --- STATE ---
  const [readings, setReadings] = useState<SensorReading[]>([
    { id: 'temp', name: 'Ambient Temp', value: 22.4, unit: '°C', status: 'good', trend: 1.2, icon: 'Thermometer' },
    { id: 'humidity', name: 'Relative Humidity', value: 45.1, unit: '%', status: 'good', trend: -0.5, icon: 'Droplets' },
    { id: 'co2', name: 'CO2 Levels', value: 420.0, unit: 'ppm', status: 'good', trend: 2.1, icon: 'Wind' },
    { id: 'pm25', name: 'Particulates (PM2.5)', value: 8.5, unit: 'µg/m³', status: 'good', trend: 0.8, icon: 'Activity' },
  ]);

  const [history, setHistory] = useState<ChartDataPoint[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isDeviceOnline, setIsDeviceOnline] = useState(false);
  const [lastTelemetryTime, setLastTelemetryTime] = useState<string | null>(null);
  const [hvacState, setHvacState] = useState<HVACState>({
    power: true,
    mode: 'auto',
    targetTemp: 25.0,
    fanSpeed: 'auto',
    co2Max: 800,
    humidityMax: 60,
  });
  const [pendingControl, setPendingControl] = useState<PendingControl | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [hanoiWeather, setHanoiWeather] = useState<HanoiWeather | null>(null);
  const [isControlStateReady, setIsControlStateReady] = useState(false);
  const clientId = useMemo(getOrCreateClientId, []);
  const commandSequenceRef = useRef(0);
  const hvacStateRef = useRef(hvacState);
  const pendingControlRef = useRef<PendingControl | null>(null);
  const controlReadyRef = useRef(false);
  const lastControlRevisionRef = useRef<string | null>(null);
  const [zoneManager, setZoneManager] = useState<ZoneManagerInfo | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [buildingInfo, setBuildingInfo] = useState<BuildingInfo | null>(null);
  const [twin, setTwin] = useState<TwinResponse | null>(null);
  const [twinBusy, setTwinBusy] = useState(false);

  useEffect(() => {
    hvacStateRef.current = hvacState;
  }, [hvacState]);

  useEffect(() => {
    pendingControlRef.current = pendingControl;
  }, [pendingControl]);

  useEffect(() => {
    controlReadyRef.current = isControlStateReady;
  }, [isControlStateReady]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    setToast({ id: Date.now(), type, message });
  }, []);

  const postRemoteControl = useCallback(async (nextState: HVACState, requestedAt: string) => {
    const payload: RemoteControlPayload = {
      device_id: deviceId ?? 'indoor-01',
      power: nextState.power,
      temp: nextState.targetTemp,
      operationMode: nextState.mode,
      fanPower: nextState.fanSpeed,
      co2Max: nextState.co2Max,
      humidityMax: nextState.humidityMax,
      clientId,
      requestedAt,
    };
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch('/api/remote-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Remote control request failed: ${response.status}`);
      }

      const result: RemoteControlResponse = await response.json();
      return remoteToHVACState(result.command);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }, [clientId, deviceId]);

  const sendRemoteControl = useCallback(async (getNextState: (state: HVACState) => HVACState) => {
    const previousState = hvacStateRef.current;
    const baseState = pendingControlRef.current?.desiredState ?? previousState;
    const desiredState = getNextState(baseState);
    const fields = CONTROL_FIELDS.filter(field => previousState[field] !== desiredState[field]);
    const commandId = commandSequenceRef.current + 1;
    commandSequenceRef.current = commandId;

    if (fields.length === 0) {
      pendingControlRef.current = null;
      setPendingControl(null);
      return;
    }

    const nextPendingControl = {
      commandId,
      previousState,
      desiredState,
      fields,
    };
    pendingControlRef.current = nextPendingControl;
    setPendingControl(nextPendingControl);

    try {
      const officialState = await postRemoteControl(desiredState, new Date().toISOString());
      if (pendingControlRef.current?.commandId !== commandId) return;

      setHvacState(officialState);
      pendingControlRef.current = null;
      setPendingControl(null);
      void fetch('/api/twin')
        .then((response) => (response.ok ? response.json() : null))
        .then((data: TwinResponse | null) => {
          if (data) setTwin(data);
        });
    } catch {
      if (pendingControlRef.current?.commandId !== commandId) return;

      setHvacState(previousState);
      pendingControlRef.current = null;
      setPendingControl(null);
      showToast('error', 'Kết nối tới thiết bị thất bại');
    }
  }, [postRemoteControl, showToast]);

  // --- DATABASE TELEMETRY ---
  useEffect(() => {
    const updateReading = (reading: SensorReading, nextValue: number | null): SensorReading => {
      if (nextValue === null || Number.isNaN(nextValue)) {
        return reading;
      }

      return {
        ...reading,
        value: nextValue,
        status: getStatus(reading.id, nextValue),
        trend: reading.value === 0 ? 0 : ((nextValue - reading.value) / reading.value) * 100,
      };
    };

    const fetchTelemetry = async () => {
      try {
        const response = await fetch('/api/telemetry');
        if (!response.ok) {
          throw new Error(`Telemetry request failed: ${response.status}`);
        }

        const telemetry: TelemetryResponse = await response.json();
        setHistory(telemetry.history);
        if (telemetry.latest) {
          setDeviceId(telemetry.latest.device_id ?? telemetry.controlState?.device_id ?? null);
          setIsDeviceOnline(telemetry.latest.is_online ?? false);
          setLastTelemetryTime(telemetry.latest.time ?? null);
        }
        if (telemetry.zoneManager) {
          setZoneManager(telemetry.zoneManager);
        }
        if (telemetry.building) setBuildingInfo(telemetry.building);
        if (telemetry.controlState) {
          const incomingState = remoteToHVACState(telemetry.controlState);
          const incomingRevision = getControlRevision(telemetry.controlState);
          const isNewRevision = lastControlRevisionRef.current !== incomingRevision;
          const isExternalChange = telemetry.controlState.lastModifiedBy !== clientId;
          const wasReady = controlReadyRef.current;

          setHvacState(prevState => {
            const pending = pendingControlRef.current;
            if (!pending) return incomingState;

            return CONTROL_FIELDS.reduce<HVACState>((nextState, field) => {
              if (pending.fields.includes(field)) {
                return nextState;
              }

              return {
                ...nextState,
                [field]: incomingState[field],
              };
            }, prevState);
          });

          if (isNewRevision && wasReady && isExternalChange) {
            showToast('info', `${formatClientLabel(telemetry.controlState.lastModifiedBy)} vừa đổi nhiệt độ`);
          }

          lastControlRevisionRef.current = incomingRevision;
        }
        if (!controlReadyRef.current) {
          controlReadyRef.current = true;
          setIsControlStateReady(true);
        }
        setReadings(prev => prev.map(reading => {
          if (reading.id === 'temp') return updateReading(reading, telemetry.latest.temperature);
          if (reading.id === 'humidity') return updateReading(reading, telemetry.latest.humidity);
          if (reading.id === 'co2') return updateReading(reading, telemetry.latest.co2);
          if (reading.id === 'pm25') return updateReading(reading, telemetry.latest.dust);
          return reading;
        }));
      } catch (error) {
        console.error(error);
      }
    };

    fetchTelemetry();
    const interval = window.setInterval(fetchTelemetry, 2000);

    return () => window.clearInterval(interval);
  }, [clientId, showToast]);

  // Digital twin — synthetic Hanoi weather (separate from live sensors)
  useEffect(() => {
    if (activeTab === 'overview') return;

    const fetchTwin = async () => {
      try {
        const response = await fetch('/api/twin');
        if (!response.ok) throw new Error(`Twin request failed: ${response.status}`);
        const data: TwinResponse = await response.json();
        setTwin(data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchTwin();
    const interval = window.setInterval(fetchTwin, 3000);
    return () => window.clearInterval(interval);
  }, [activeTab]);

  const twinAction = useCallback(async (action: 'reset' | 'step' | 'pause' | 'play' | 'set_month', month?: number) => {
    setTwinBusy(true);
    try {
      const response = await fetch('/api/twin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, month }),
      });
      if (!response.ok) throw new Error('Twin action failed');
      const data = await response.json();
      setTwin(data.twin);
      if (action === 'reset') showToast('info', 'Đã reset mô phỏng');
    } catch {
      showToast('error', 'Thao tác mô phỏng thất bại');
    } finally {
      setTwinBusy(false);
    }
  }, [showToast]);

  const twinBuildingSim = twin?.buildingSim ?? null;
  const twinBaselineSim = twin?.baselineSim ?? null;
  const twinDrlPanel = twin?.drlPanel ?? null;
  const twinBuilding = twin?.building ?? buildingInfo;

  const pageTitle = useMemo(() => {
    if (activeTab === 'overview') return 'Giám sát cảm biến Zone A';
    if (activeTab === 'building') return 'Tòa nhà Hà Nội — Mô phỏng';
    if (activeTab === 'ai') return 'DDPG — Mô phỏng';
    return 'Điện năng — So sánh DDPG vs RBC';
  }, [activeTab]);

  // --- WEATHER ---
  useEffect(() => {
    const fetchHanoiWeather = async () => {
      try {
        const params = new URLSearchParams({
          latitude: '21.0245',
          longitude: '105.8412',
          current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
          timezone: 'Asia/Bangkok',
          forecast_days: '1',
        });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Weather request failed: ${response.status}`);
        }

        const weather = await response.json();
        setHanoiWeather({
          temperature: weather.current.temperature_2m,
          apparentTemperature: weather.current.apparent_temperature,
          humidity: weather.current.relative_humidity_2m,
          windSpeed: weather.current.wind_speed_10m,
          weatherCode: weather.current.weather_code,
          minTemp: weather.daily.temperature_2m_min[0],
          maxTemp: weather.daily.temperature_2m_max[0],
          precipitationProbability: weather.daily.precipitation_probability_max[0],
        });
      } catch (error) {
        console.error(error);
      }
    };

    fetchHanoiWeather();
    const interval = window.setInterval(fetchHanoiWeather, 2 * 60 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, []);

  // Derived stats
  const activeAlerts = useMemo(() => readings.filter(r => r.status !== 'good').length, [readings]);
  const displayHvacState = pendingControl?.desiredState ?? hvacState;
  const pendingFields = useMemo(() => {
    return pendingControl?.fields.reduce<Partial<Record<ControlField, boolean>>>((fields, field) => {
      fields[field] = true;
      return fields;
    }, {}) ?? {};
  }, [pendingControl]);

  const TABS: { id: DashboardTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Tổng quan', icon: Activity },
    { id: 'building', label: 'Tòa nhà', icon: Building2 },
    { id: 'ai', label: 'DDPG', icon: Brain },
    { id: 'energy', label: 'Điện năng', icon: Zap },
  ];

  return (
    <div className="min-h-screen text-slate-100 overflow-x-clip selection:bg-blue-500/20">
      {/* --- TOP BAR --- */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#080c14]/80 backdrop-blur-md border-b border-slate-900/80 z-50 px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={mainLogo} alt="HVAC Sentinel Logo" className="h-9 object-contain" />
          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-black uppercase tracking-widest bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">HVAC Sentinel</span>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tight">AI-IoT Optimization Platform</span>
          </div>
        </div>

        {/* System Status Indicators */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 border-r border-slate-800 pr-6 mr-2">
            <div className="flex items-center gap-2">
              <span className={cn("w-1.5 h-1.5 rounded-full", isDeviceOnline ? "bg-emerald-500 animate-pulse animate-glow-emerald" : "bg-red-500")} />
              <span className="text-[9px] font-black uppercase text-slate-400">
                Node ESP32: {isDeviceOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("w-1.5 h-1.5 rounded-full", isDeviceOnline ? "bg-emerald-500 animate-pulse animate-glow-emerald" : "bg-amber-500")} />
              <span className="text-[9px] font-black uppercase text-slate-400">
                MQTT: {isDeviceOnline ? 'Connected' : 'Waiting'}
              </span>
            </div>
            <div className="flex flex-col items-end pl-2">
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Occupancy</span>
              <span className="text-[10px] font-mono text-amber-400 font-bold">1 người</span>
            </div>
          </div>

          <div className="relative cursor-pointer">
            <Bell className="w-4 h-4 text-slate-400 hover:text-slate-200 transition-colors" />
            {activeAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-[#080c14] animate-pulse animate-glow-red" />
            )}
          </div>
          <div className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden">
             <User className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="pt-24 pb-8 px-4 md:px-8 max-w-[1600px] mx-auto">
        <div className={cn('grid grid-cols-1 gap-6', activeTab === 'overview' && 'lg:grid-cols-12')}>
          
          <div className={cn('space-y-6', activeTab === 'overview' ? 'lg:col-span-8' : 'col-span-full')}>
            
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black tracking-tight text-white uppercase">{pageTitle}</h2>
                <p className="text-slate-500 text-xs mt-0.5">
                  {activeTab === 'overview' ? (
                    <>
                      {buildingInfo?.zone_id ?? 'Zone A'} • {deviceId ?? 'Chưa kết nối'}
                      {lastTelemetryTime && (
                        <span className="ml-2">• {new Date(lastTelemetryTime).toLocaleString('vi-VN')}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-sky-400/90">
                      Khí hậu Hà Nội mô phỏng • Tháng {twin?.month ?? '—'}
                      {twin?.weather && (
                        <span className="text-slate-500 ml-2">
                          • {twin.weather.outdoor_temp}°C ngoài trời
                        </span>
                      )}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-1 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer',
                      activeTab === tab.id
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-500 hover:text-slate-300'
                    )}
                  >
                    <tab.icon className="w-3 h-3" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {!isDeviceOnline && activeTab === 'overview' && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  ESP32 chưa gửi dữ liệu mới (quá 30 giây). Kiểm tra WiFi, MQTT broker (<code className="text-amber-100">host:1885</code>) và upload lại firmware.
                </span>
              </div>
            )}

            {/* Tab: Overview */}
            {activeTab === 'overview' && (
              <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <MetricCard reading={readings[0]} icon={Thermometer} />
              <MetricCard reading={readings[1]} icon={Droplets} />
              <MetricCard reading={readings[2]} icon={Wind} />
              <MetricCard reading={readings[3]} icon={Activity} />
            </div>

            <SensorHistoryChart data={history} />

            <div className="glass-panel rounded-2xl p-5 border border-slate-800/85 shadow-xl">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Trạng thái điều khiển AI</h4>
              <div className="flex flex-wrap gap-3 items-center mb-3">
                <span className="text-[8px] font-black uppercase text-slate-300 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full">
                  {zoneManager?.currentPolicy === 'working_hours' && '💼 Giờ làm việc'}
                  {zoneManager?.currentPolicy === 'night_eco' && '🌙 Ngủ đêm ECO'}
                  {zoneManager?.currentPolicy === 'eco_standby' && '🍃 Chờ tiết kiệm'}
                  {zoneManager?.currentPolicy === 'manual' && '👤 Thủ công'}
                  {!zoneManager && '—'}
                </span>
                <span className={cn(
                  'text-[8px] font-black uppercase px-2 py-0.5 rounded-full border',
                  isDeviceOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                )}>
                  ESP32 {isDeviceOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {zoneManager?.aiRecommendation || 'Đang chờ dữ liệu cảm biến từ ESP32...'}
              </p>
            </div>
              </>
            )}

            {/* Tab: Building */}
            {activeTab === 'building' && (
              <div className="space-y-4">
                <TwinSavingsPanel twin={twin} compact />
                <BuildingVisualization
                  building={twinBuilding ?? undefined}
                  sim={twinBuildingSim}
                  baselineSim={twinBaselineSim}
                  drlPanel={twinDrlPanel ?? undefined}
                  twin={twin}
                  temperature={twinBuildingSim?.zone_temp}
                  onTwinAction={twinAction}
                  twinBusy={twinBusy}
                />
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-4">
                <DRLMonthlySavings twin={twin} />
                <DRLModelPanel panel={twinDrlPanel ?? undefined} />
              </div>
            )}

            {activeTab === 'energy' && (
              <div className="space-y-4">
                <TwinSavingsPanel twin={twin} />
                <TwinComparisonChart
                  data={twin?.history ?? []}
                  savingsPct={twin?.savings_pct ?? 0}
                  energySavedKwh={twin?.savings_summary?.energy_saved_kwh ?? Math.max(0, (twin?.energy_base_kwh ?? 0) - (twin?.energy_ai_kwh ?? 0))}
                />
                <EnergyBreakdownChart sim={twinBuildingSim} baselineSim={twinBaselineSim} />
              </div>
            )}
          </div>

          {activeTab === 'overview' && (
          <div className="lg:col-span-4 space-y-6">
            
            {isControlStateReady ? (
                <ControlPanel
                  state={displayHvacState}
                  pendingFields={pendingFields}
                  onControlChange={sendRemoteControl}
                />
              ) : (
              <div className="glass-panel rounded-2xl p-6 border border-slate-850 shadow-2xl h-full min-h-[560px] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">AC UNIT 01</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Đang tải cấu hình...</span>
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 animate-pulse" />
                </div>
                <div className="flex-1 flex flex-col items-center justify-center gap-8">
                  <div className="w-full aspect-square max-w-[190px] rounded-full border-4 border-slate-800 bg-slate-900/20 animate-pulse" />
                  <div className="w-full space-y-3">
                    <div className="h-3 w-32 mx-auto bg-slate-900 rounded animate-pulse" />
                    <div className="grid grid-cols-3 gap-3">
                      {[0, 1, 2].map((item) => (
                        <div key={item} className="h-16 rounded-xl bg-slate-900/40 border border-slate-800 animate-pulse" />
                      ))}
                    </div>
                  </div>
                  <div className="w-full space-y-3">
                    <div className="h-3 w-24 bg-slate-900 rounded animate-pulse" />
                    <div className="h-10 rounded-xl bg-slate-900/40 border border-slate-800 animate-pulse" />
                  </div>
                </div>
              </div>
            )}

            <div className="glass-panel rounded-2xl p-5 border border-slate-800/85 shadow-xl">
               <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thời tiết Hà Nội</h4>
                  <div className="flex items-center gap-1 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                    <MapPin className="w-3 h-3" />
                    Hôm nay
                  </div>
               </div>
                {hanoiWeather ? (
                  <div className="space-y-3.5">
                    {[
                      { item: 'Nhiệt độ Hiện tại', status: `${hanoiWeather.temperature.toFixed(1)}°C`, color: 'text-blue-400' },
                      { item: 'Trạng thái', status: getWeatherLabel(hanoiWeather.weatherCode), color: 'text-sky-400' },
                      { item: 'Cảm giác thực tế', status: `${hanoiWeather.apparentTemperature.toFixed(1)}°C`, color: 'text-slate-300' },
                    ].map((step) => (
                      <div key={step.item} className="flex justify-between items-center border-b border-slate-900 pb-2">
                         <span className="text-xs text-slate-400 font-semibold">{step.item}</span>
                         <span className={cn("text-[10px] font-black uppercase tracking-wider", step.color)}>{step.status}</span>
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {[
                        { label: 'Độ ẩm', value: `${hanoiWeather.humidity}%`, icon: Droplets },
                        { label: 'Tốc độ Gió', value: `${hanoiWeather.windSpeed.toFixed(1)} km/h`, icon: Wind },
                        { label: 'Cao / Thấp', value: `${hanoiWeather.maxTemp.toFixed(1)} / ${hanoiWeather.minTemp.toFixed(1)}°C`, icon: Thermometer },
                        { label: 'Khả năng mưa', value: `${hanoiWeather.precipitationProbability}%`, icon: CloudRain },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-2 border-b border-slate-900 pb-2">
                          <div className="flex items-center gap-1 text-slate-500 mb-1">
                            <item.icon className="w-3 h-3" />
                            <span className="text-[8px] font-bold uppercase tracking-wider">{item.label}</span>
                          </div>
                          <p className="text-xs font-mono font-bold text-slate-300">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-28 flex items-center justify-center">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider animate-pulse">Đang tải thời tiết...</span>
                  </div>
                )}
            </div>

            {/* Notification Center */}
            <div className="glass-panel rounded-2xl p-5 border border-slate-800/85 shadow-xl">
               <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Cảnh báo hệ thống</h4>
               <div className="space-y-4">
                  <AnimatePresence>
                    {activeAlerts > 0 ? (
                      readings.filter(r => r.status !== 'good').map((r) => (
                        <motion.div 
                          key={r.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className={cn(
                            "p-3 rounded-xl border flex items-start gap-3",
                            r.status === 'critical' 
                              ? "bg-red-500/10 border-red-500/20 text-red-300" 
                              : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                          )}
                        >
                           <AlertTriangle className={cn("w-4 h-4 shrink-0 mt-0.5", r.status === 'critical' ? "text-red-400" : "text-amber-400")} />
                           <div className="space-y-1">
                              <p className="text-[10px] font-black uppercase tracking-wider">Phát hiện vượt ngưỡng {r.name}</p>
                              <p className="text-[9px] text-slate-400 leading-normal font-semibold">Giá trị hiện tại là {r.value.toFixed(1)}{r.unit} đã vượt quá giới hạn an toàn quy định.</p>
                           </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider">Hệ thống đang vận hành ổn định</p>
                      </div>
                    )}
                  </AnimatePresence>
               </div>
            </div>

          </div>
          )}
        </div>
      </main>
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className={cn(
              "fixed bottom-6 right-6 z-[60] max-w-sm rounded-xl border px-4 py-3 shadow-2xl flex items-start gap-3 glass-panel",
              toast.type === 'error'
                ? "border-red-500/30 text-red-400 shadow-[0_4px_20px_rgba(239,68,68,0.15)] animate-glow-red"
                : "border-blue-500/30 text-blue-400 shadow-[0_4px_20px_rgba(59,130,246,0.15)] animate-glow-blue"
            )}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs font-black uppercase tracking-wider">{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
