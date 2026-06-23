import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Building2, Thermometer, Wind, Droplets, Activity,
} from 'lucide-react';
import { BuildingInfo, BuildingSimSnapshot, DRLPanel, HVACState, TwinResponse } from '../types';
import { cn } from '../lib/utils';
import { HVACEquipmentPanel, deriveHvacState } from './HVACEquipmentPanel';

interface BuildingVisualizationProps {
  building?: BuildingInfo;
  sim?: BuildingSimSnapshot | null;
  baselineSim?: BuildingSimSnapshot | null;
  drlPanel?: DRLPanel | null;
  twin?: TwinResponse | null;
  temperature?: number | null;
  synthetic?: boolean;
  control?: Pick<HVACState, 'power' | 'mode' | 'fanSpeed' | 'targetTemp'> | null;
}

function tempColor(t: number | null | undefined): string {
  if (t == null) return '#38bdf8';
  if (t < 22) return '#60a5fa';
  if (t <= 24.5) return '#34d399';
  if (t <= 28) return '#fbbf24';
  return '#f87171';
}

export const BuildingVisualization: React.FC<BuildingVisualizationProps> = ({
  building,
  sim,
  baselineSim,
  drlPanel,
  twin,
  temperature,
  synthetic = true,
  control,
}) => {
  const zoneTemp = sim?.zone_temp ?? temperature;
  const zoneRh = sim?.zone_humidity ?? 50;
  const zoneCo2 = sim?.zone_co2 ?? 600;
  const damper = sim?.airflow.damper_pct ?? 0;
  const physical = drlPanel?.physical ?? {};
  const outdoor = twin?.weather;
  const hvac = deriveHvacState(sim, drlPanel, control);

  const hour = twin?.sim_hour ?? 12;
  const isDay = hour >= 6 && hour < 20;
  const sunX = 120 + (hour / 24) * 560;

  const vSa = hvac.fanOn ? (sim?.airflow.V_sa ?? 0) : 0;
  const airflowIntensity = useMemo(() => Math.min(1, vSa / 1.2), [vSa]);

  const Metric = ({ icon: Icon, label, value, unit, color }: {
    icon: React.ElementType; label: string; value: string; unit?: string; color?: string;
  }) => (
    <div className="rounded-xl bg-slate-950/70 border border-slate-800/90 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase text-slate-500 tracking-wider mb-1">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <p className={cn('text-lg font-black font-mono leading-none', color ?? 'text-white')}>
        {value}
        {unit && <span className="text-[10px] text-slate-500 ml-1 font-bold">{unit}</span>}
      </p>
    </div>
  );

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/85 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-950/40">
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-violet-400" />
            Digital Twin — Zone A
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {building?.zone_id ?? 'Phòng làm việc'} • {building?.volume_m3?.toFixed(0) ?? 273} m³ • {building?.floor ?? 'Tầng 12'}
          </p>
        </div>
        <span className="text-[8px] font-black uppercase px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
          {synthetic ? 'Synthetic Hanoi' : 'Live'}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-0">
        {/* Main isometric scene */}
        <div className="xl:col-span-8 relative min-h-[380px] bg-[#060a12]">
          <svg viewBox="0 0 720 400" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isDay ? '#0c1929' : '#050510'} />
                <stop offset="100%" stopColor="#060a12" />
              </linearGradient>
              <linearGradient id="floorGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#1e293b" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#334155" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#1e293b" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id="wallLeft" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tempColor(zoneTemp)} stopOpacity="0.35" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="wallRight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tempColor(zoneTemp)} stopOpacity="0.2" />
                <stop offset="100%" stopColor="#1e293b" stopOpacity="0.85" />
              </linearGradient>
              <linearGradient id="roofGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#475569" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#1e293b" stopOpacity="0.8" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <marker id="arrowBlue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#38bdf8" />
              </marker>
            </defs>

            <rect width="720" height="400" fill="url(#skyGrad)" />

            {/* Grid floor */}
            {[...Array(12)].map((_, i) => (
              <line key={`g${i}`} x1={60 + i * 55} y1="320" x2={180 + i * 55} y2="400" stroke="#1e293b" strokeWidth="0.5" opacity="0.6" />
            ))}
            {[...Array(8)].map((_, i) => (
              <line key={`gv${i}`} x1="100" y1={280 + i * 18} x2="620" y2={280 + i * 18} stroke="#1e293b" strokeWidth="0.5" opacity="0.4" />
            ))}

            {/* Sun / moon */}
            {isDay ? (
              <circle cx={sunX} cy="55" r="28" fill="#fbbf24" fillOpacity="0.15" filter="url(#glow)" />
            ) : (
              <circle cx="600" cy="50" r="18" fill="#94a3b8" fillOpacity="0.2" />
            )}
            {isDay && <circle cx={sunX} cy="55" r="14" fill="#fcd34d" fillOpacity="0.9" />}

            {/* Outdoor label */}
            <text x="80" y="100" fill="#64748b" fontSize="9" fontWeight="bold" letterSpacing="2">OUTDOOR</text>
            <text x="80" y="118" fill="#38bdf8" fontSize="14" fontWeight="bold" fontFamily="monospace">
              {outdoor?.outdoor_temp ?? '—'}°C
            </text>
            <text x="80" y="134" fill="#64748b" fontSize="8">RH {outdoor?.outdoor_humidity ?? '—'}% • PM₂.₅ {outdoor?.pm25_outdoor ?? '—'}</text>

            {/* AHU + Quạt cấp gió */}
            <g transform="translate(88, 185)">
              <path d="M0,40 L30,25 L30,85 L0,100 Z" fill={hvac.fanOn ? '#1e3a5f' : '#1e293b'} stroke={hvac.fanOn ? '#3b82f6' : '#475569'} strokeWidth="1.2" />
              <path d="M30,25 L70,5 L70,65 L30,85 Z" fill={hvac.fanOn ? '#0f2744' : '#0f172a'} stroke={hvac.fanOn ? '#2563eb' : '#334155'} strokeWidth="1.2" />
              <path d="M0,40 L30,25 L70,5 L40,20 Z" fill="#334155" stroke={hvac.fanOn ? '#60a5fa' : '#475569'} strokeWidth="1" />
              <text x="18" y="58" fill={hvac.fanOn ? '#93c5fd' : '#64748b'} fontSize="7" fontWeight="bold">QUẠT</text>
              <text x="14" y="70" fill={hvac.fanOn ? '#60a5fa' : '#475569'} fontSize="6" fontWeight="bold">CẤP GIÓ</text>
              {/* Fan blades */}
              <g transform="translate(50, 35)">
                {hvac.fanOn ? (
                  <motion.g
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.2 / Math.max(0.3, airflowIntensity), ease: 'linear' }}
                    style={{ transformOrigin: '0px 0px' }}
                  >
                    {[0, 72, 144, 216, 288].map((deg) => (
                      <line key={deg} x1="0" y1="0" x2="0" y2="-10" stroke="#38bdf8" strokeWidth="2" transform={`rotate(${deg})`} />
                    ))}
                  </motion.g>
                ) : (
                  <circle r="8" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                )}
              </g>
              {/* ON/OFF badge */}
              <rect x="2" y="2" width="28" height="12" rx="3" fill={hvac.fanOn ? '#10b981' : '#334155'} fillOpacity="0.9" />
              <text x="16" y="11" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">{hvac.fanOn ? 'BẬT' : 'TẮT'}</text>
              <text x="50" y="58" textAnchor="middle" fill="#94a3b8" fontSize="6">{hvac.fanMode}</text>
            </g>

            {/* Ống gió + Van gió tươi */}
            <g transform="translate(158, 242)">
              <text x="0" y="-8" fill="#64748b" fontSize="7" fontWeight="bold">ỐNG GIÓ TƯƠI</text>
              <rect x="0" y="0" width="100" height="14" rx="3" fill="#1e3a5f" stroke={hvac.damperOpen ? '#06b6d4' : '#334155'} strokeWidth="1" />
              {/* Damper blades */}
              <g transform="translate(72, 7)">
                <motion.g
                  animate={{ rotate: hvac.damperOpen ? 75 : 0 }}
                  transition={{ duration: 0.8 }}
                  style={{ transformOrigin: '0px 0px' }}
                >
                  <line x1="-6" y1="0" x2="6" y2="0" stroke={hvac.damperOpen ? '#22d3ee' : '#64748b'} strokeWidth="2" />
                  <line x1="0" y1="-6" x2="0" y2="6" stroke={hvac.damperOpen ? '#22d3ee' : '#64748b'} strokeWidth="2" />
                </motion.g>
              </g>
              <rect x="64" y="-6" width="16" height="26" rx="2" fill="#0f172a" stroke={hvac.damperOpen ? '#06b6d4' : '#475569'} strokeWidth="0.8" />
              <text x="72" y="32" textAnchor="middle" fill={hvac.damperOpen ? '#22d3ee' : '#64748b'} fontSize="8" fontWeight="bold">VAN {damper.toFixed(0)}%</text>
              <rect x="78" y="-18" width="22" height="10" rx="2" fill={hvac.damperOpen ? '#0891b2' : '#334155'} />
              <text x="89" y="-10" textAnchor="middle" fill="white" fontSize="5" fontWeight="bold">{hvac.damperOpen ? 'MỞ' : 'ĐÓNG'}</text>
              {hvac.damperOpen && [0, 1, 2].map((i) => (
                <motion.circle
                  key={i}
                  r="2.5"
                  fill="#67e8f9"
                  animate={{ cx: [8, 88], opacity: [0, 1, 0] }}
                  transition={{ repeat: Infinity, duration: 2 / Math.max(0.3, airflowIntensity), delay: i * 0.4 }}
                  cy={7}
                />
              ))}
            </g>

            {/* Isometric room — left wall */}
            <path
              d="M255 155 L255 295 L400 365 L400 225 Z"
              fill="url(#wallLeft)"
              stroke={tempColor(zoneTemp)}
              strokeWidth="1.2"
              strokeOpacity="0.6"
            />
            {/* Right wall */}
            <path
              d="M400 225 L400 365 L580 285 L580 145 Z"
              fill="url(#wallRight)"
              stroke="#475569"
              strokeWidth="1"
              strokeOpacity="0.5"
            />
            {/* Floor */}
            <path
              d="M255 295 L400 365 L580 285 L435 215 Z"
              fill="url(#floorGrad)"
              stroke="#334155"
              strokeWidth="0.8"
            />
            {/* Roof / ceiling cut */}
            <path
              d="M255 155 L400 225 L580 145 L435 75 Z"
              fill="url(#roofGrad)"
              stroke="#64748b"
              strokeWidth="0.8"
              strokeOpacity="0.6"
            />

            {/* Zone label */}
            <text x="400" y="200" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="bold" letterSpacing="1">
              ZONE A
            </text>
            <text x="400" y="216" textAnchor="middle" fill="#64748b" fontSize="8">PHÒNG LÀM VIỆC</text>

            {/* Big temp readout inside room */}
            <text x="400" y="255" textAnchor="middle" fill={tempColor(zoneTemp)} fontSize="28" fontWeight="bold" fontFamily="monospace" filter="url(#glow)">
              {zoneTemp?.toFixed(1) ?? '—'}°
            </text>
            <text x="400" y="275" textAnchor="middle" fill="#94a3b8" fontSize="8">
              RH {zoneRh?.toFixed(0)}% • CO₂ {zoneCo2?.toFixed(0)} ppm
            </text>

            {/* Occupant desk silhouette */}
            <g transform="translate(340, 300)" opacity="0.7">
              <rect x="0" y="0" width="40" height="8" rx="2" fill="#475569" />
              <circle cx="20" cy="-12" r="7" fill="#fbbf24" fillOpacity="0.7" />
              <rect x="14" y="-5" width="12" height="14" rx="3" fill="#fbbf24" fillOpacity="0.5" />
            </g>

            {/* Supply air into room — only when fan on */}
            {hvac.fanOn && (
              <motion.path
                d="M 258 258 L 330 295"
                stroke="#38bdf8"
                strokeWidth={2 + airflowIntensity}
                fill="none"
                markerEnd="url(#arrowBlue)"
                strokeDasharray="4 4"
                animate={{ strokeDashoffset: [0, -16] }}
                transition={{ repeat: Infinity, duration: 1.2 / Math.max(0.3, airflowIntensity), ease: 'linear' }}
                opacity={0.5 + airflowIntensity * 0.5}
              />
            )}
            {!hvac.fanOn && (
              <text x="290" y="275" fill="#475569" fontSize="7" fontWeight="bold">Không có luồng gió</text>
            )}

            {/* RBC comparison ghost temp */}
            {baselineSim?.zone_temp != null && (
              <g transform="translate(520, 310)">
                <rect x="0" y="0" width="88" height="36" rx="6" fill="#0f172a" fillOpacity="0.85" stroke="#64748b" strokeWidth="0.5" />
                <text x="44" y="14" textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="bold">RBC (baseline)</text>
                <text x="44" y="28" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="bold" fontFamily="monospace">
                  {baselineSim.zone_temp.toFixed(1)}°C
                </text>
              </g>
            )}

            {/* Chiller / Điều hòa */}
            <g transform="translate(588, 205)">
              <rect x="0" y="0" width="58" height="72" rx="5" fill={hvac.chillerOn ? '#1e1b4b' : '#0f172a'} stroke={hvac.chillerOn ? '#6366f1' : '#334155'} strokeWidth="1.5" />
              <text x="29" y="16" textAnchor="middle" fill={hvac.chillerOn ? '#a5b4fc' : '#64748b'} fontSize="7" fontWeight="bold">ĐIỀU HÒA</text>
              <text x="29" y="26" textAnchor="middle" fill="#64748b" fontSize="6">CHILLER</text>
              <g transform="translate(29, 32)">
                <circle r="10" fill={hvac.chillerOn ? '#4f46e5' : '#1e293b'} fillOpacity="0.5" />
                <text x="0" y="4" textAnchor="middle" fill={hvac.chillerOn ? '#c7d2fe' : '#475569'} fontSize="12">❄</text>
              </g>
              <text x="29" y="54" textAnchor="middle" fill={hvac.chillerOn ? '#818cf8' : '#475569'} fontSize="10" fontFamily="monospace" fontWeight="bold">
                {physical.T_chws != null ? `${physical.T_chws}°C` : '—'}
              </text>
              <text x="29" y="66" textAnchor="middle" fill="#64748b" fontSize="6">nước lạnh</text>
              <rect x="8" y="4" width="24" height="11" rx="3" fill={hvac.chillerOn ? '#4f46e5' : '#334155'} />
              <text x="20" y="12" textAnchor="middle" fill="white" fontSize="5" fontWeight="bold">{hvac.chillerOn ? 'BẬT' : 'TẮT'}</text>
              <text x="29" y="78" textAnchor="middle" fill="#94a3b8" fontSize="6">{hvac.acMode}</text>
            </g>
          </svg>

          {/* HUD — setpoint */}
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            <span className={cn(
              'text-[8px] font-black uppercase px-2 py-1 rounded-md border',
              hvac.needHeat || hvac.acMode.includes('nóng')
                ? 'bg-orange-950/90 border-orange-500/40 text-orange-300'
                : 'bg-indigo-950/90 border-indigo-500/40 text-indigo-300'
            )}>
              {hvac.needHeat || hvac.acMode.includes('nóng')
                ? `Làm nóng → ${hvac.targetTemp}°C`
                : `Setpoint ${hvac.targetTemp}°C`}
            </span>
            <span className="text-[8px] font-black uppercase px-2 py-1 rounded-md bg-slate-950/80 border border-slate-700 text-amber-400">
              {hvac.acMode}
            </span>
          </div>
        </div>

        {/* Side panel */}
        <div className="xl:col-span-4 p-4 bg-slate-950/30 border-t xl:border-t-0 xl:border-l border-slate-800/80 space-y-4 max-h-[600px] overflow-y-auto">
          <HVACEquipmentPanel sim={sim} drlPanel={drlPanel} control={control} />

          <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest pt-1">Môi trường phòng</p>
          <div className="grid grid-cols-2 gap-2">
            <Metric icon={Thermometer} label="Nhiệt độ" value={zoneTemp?.toFixed(1) ?? '—'} unit="°C" color="text-sky-400" />
            <Metric icon={Droplets} label="Độ ẩm" value={zoneRh?.toFixed(0) ?? '—'} unit="%" color="text-cyan-400" />
            <Metric icon={Wind} label="CO₂" value={zoneCo2?.toFixed(0) ?? '—'} unit="ppm" color="text-violet-400" />
            <Metric icon={Activity} label="PM₂.₅" value={sim?.zone_pm?.toFixed(1) ?? '—'} unit="µg/m³" />
          </div>

          {sim?.comfort && (
            <>
              <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest pt-2">Tiêu chí thoải mái</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { ok: sim.comfort.temp_ok, label: 'Nhiệt 22–24.5°C' },
                  { ok: sim.comfort.rh_ok, label: 'RH ≤ 60%' },
                  { ok: sim.comfort.co2_ok, label: 'CO₂ < 1000' },
                  { ok: sim.comfort.pm_ok, label: 'PM₂.₅ < 10' },
                ].map((c) => (
                  <div
                    key={c.label}
                    className={cn(
                      'text-[7px] font-black uppercase text-center py-2 px-1 rounded-lg border',
                      c.ok ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-400'
                    )}
                  >
                    {c.ok ? '✓' : '✗'} {c.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
