import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Building2, Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import { BuildingInfo, BuildingSimSnapshot, DRLPanel, HVACState, TwinResponse } from '../types';
import { cn } from '../lib/utils';
import { deriveHvacState } from './HVACEquipmentPanel';

interface BuildingVisualizationProps {
  building?: BuildingInfo;
  sim?: BuildingSimSnapshot | null;
  baselineSim?: BuildingSimSnapshot | null;
  drlPanel?: DRLPanel | null;
  twin?: TwinResponse | null;
  temperature?: number | null;
  control?: Pick<HVACState, 'power' | 'mode' | 'fanSpeed' | 'targetTemp'> | null;
  onTwinAction?: (action: 'reset' | 'step' | 'pause' | 'play' | 'set_month', month?: number) => Promise<void>;
  twinBusy?: boolean;
}

const MONTHS = [5, 6, 7, 8, 9, 10];

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
  control,
  onTwinAction,
  twinBusy,
}) => {
  const zoneTemp = sim?.zone_temp ?? temperature;
  const zoneRh = sim?.zone_humidity ?? 50;
  const zoneCo2 = sim?.zone_co2 ?? 600;
  const damper = sim?.airflow.damper_pct ?? 0;
  const outdoor = twin?.weather;
  const hvac = deriveHvacState(sim, drlPanel, control);
  const savings = twin?.savings_summary;
  const savingsPct = savings?.savings_pct ?? twin?.savings_pct ?? 0;

  const hour = twin?.sim_hour ?? 12;
  const isDay = hour >= 6 && hour < 20;
  const sunX = 120 + (hour / 24) * 560;
  const simTime = `${Math.floor(hour).toString().padStart(2, '0')}:${Math.round((hour % 1) * 60).toString().padStart(2, '0')}`;

  const vSa = sim?.airflow?.V_sa ?? 0;
  const airflowIntensity = useMemo(() => Math.min(1, vSa / 1.2), [vSa]);

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/85 overflow-hidden shadow-2xl">
      <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/40 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-400" />
              Tòa nhà văn phòng Hà Nội
            </h4>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {building?.zone_id ?? 'Zone A'} • Tầng 12 • Khí hậu nóng ẩm mô phỏng
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
            <span className="px-2 py-1 rounded-lg bg-sky-950/80 border border-sky-800 text-sky-300">
              Ngoài trời {outdoor?.outdoor_temp ?? '—'}°C
            </span>
            <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
              {simTime} • bước {twin?.sim_step ?? 0}
            </span>
            {savingsPct > 0 && (
              <span className="px-2 py-1 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-400 font-black">
                Tiết kiệm {savingsPct.toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        {onTwinAction && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={twinBusy}
              onClick={() => onTwinAction(twin?.paused ? 'play' : 'pause')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border cursor-pointer',
                twin?.paused ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
              )}
            >
              {twin?.paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              {twin?.paused ? 'Chạy' : 'Dừng'}
            </button>
            <button type="button" disabled={twinBusy} onClick={() => onTwinAction('step')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border border-blue-500/30 text-blue-400 bg-blue-500/10 cursor-pointer">
              <SkipForward className="w-3 h-3" /> +1 bước
            </button>
            <button type="button" disabled={twinBusy} onClick={() => onTwinAction('reset')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border border-slate-700 text-slate-400 bg-slate-900 cursor-pointer">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
            <span className="text-[8px] font-bold uppercase text-slate-600 ml-1">Tháng:</span>
            {MONTHS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={twinBusy}
                onClick={() => onTwinAction('set_month', m)}
                className={cn(
                  'px-2 py-0.5 rounded text-[9px] font-black border cursor-pointer',
                  twin?.month === m ? 'bg-violet-600/25 text-violet-300 border-violet-500/40' : 'text-slate-500 border-slate-800 bg-slate-900'
                )}
              >
                T{m}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative min-h-[360px] bg-[#060a12]">
        <svg viewBox="0 0 720 400" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isDay ? '#0c1929' : '#050510'} />
              <stop offset="100%" stopColor="#060a12" />
            </linearGradient>
            <linearGradient id="wallLeft" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tempColor(zoneTemp)} stopOpacity="0.35" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="wallRight" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tempColor(zoneTemp)} stopOpacity="0.2" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="floorGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#334155" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0.3" />
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

          {isDay ? (
            <>
              <circle cx={sunX} cy="55" r="28" fill="#fbbf24" fillOpacity="0.15" filter="url(#glow)" />
              <circle cx={sunX} cy="55" r="14" fill="#fcd34d" fillOpacity="0.9" />
            </>
          ) : (
            <circle cx="600" cy="50" r="18" fill="#94a3b8" fillOpacity="0.2" />
          )}

          <text x="80" y="100" fill="#64748b" fontSize="9" fontWeight="bold">HÀ NỘI</text>
          <text x="80" y="118" fill="#38bdf8" fontSize="14" fontWeight="bold" fontFamily="monospace">
            {outdoor?.outdoor_temp ?? '—'}°C
          </text>
          <text x="80" y="134" fill="#64748b" fontSize="8">Ẩm {outdoor?.outdoor_humidity ?? '—'}% • PM₂.₅ {outdoor?.pm25_outdoor ?? '—'}</text>

          <g transform="translate(88, 185)">
            <path d="M0,40 L30,25 L30,85 L0,100 Z" fill={hvac.fanOn ? '#1e3a5f' : '#1e293b'} stroke={hvac.fanOn ? '#3b82f6' : '#475569'} strokeWidth="1.2" />
            <path d="M30,25 L70,5 L70,65 L30,85 Z" fill={hvac.fanOn ? '#0f2744' : '#0f172a'} stroke={hvac.fanOn ? '#2563eb' : '#334155'} strokeWidth="1.2" />
            <text x="35" y="58" fill={hvac.fanOn ? '#93c5fd' : '#64748b'} fontSize="7" fontWeight="bold">QUẠT</text>
            <g transform="translate(50, 35)">
              {hvac.fanOn ? (
                <motion.g animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2 / Math.max(0.3, airflowIntensity), ease: 'linear' }} style={{ transformOrigin: '0px 0px' }}>
                  {[0, 72, 144, 216, 288].map((deg) => (
                    <line key={deg} x1="0" y1="0" x2="0" y2="-10" stroke="#38bdf8" strokeWidth="2" transform={`rotate(${deg})`} />
                  ))}
                </motion.g>
              ) : (
                <circle r="8" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
              )}
            </g>
            <rect x="2" y="2" width="28" height="12" rx="3" fill={hvac.fanOn ? '#10b981' : '#334155'} />
            <text x="16" y="11" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">{hvac.fanOn ? 'BẬT' : 'TẮT'}</text>
          </g>

          <g transform="translate(158, 242)">
            <rect x="0" y="0" width="100" height="14" rx="3" fill="#1e3a5f" stroke={hvac.damperOpen ? '#06b6d4' : '#334155'} strokeWidth="1" />
            <text x="50" y="28" textAnchor="middle" fill={hvac.damperOpen ? '#22d3ee' : '#64748b'} fontSize="8" fontWeight="bold">VAN {damper.toFixed(0)}%</text>
          </g>

          <path d="M255 155 L255 295 L400 365 L400 225 Z" fill="url(#wallLeft)" stroke={tempColor(zoneTemp)} strokeWidth="1.2" strokeOpacity="0.6" />
          <path d="M400 225 L400 365 L580 285 L580 145 Z" fill="url(#wallRight)" stroke="#475569" strokeWidth="1" strokeOpacity="0.5" />
          <path d="M255 295 L400 365 L580 285 L435 215 Z" fill="url(#floorGrad)" stroke="#334155" strokeWidth="0.8" />
          <path d="M255 155 L400 225 L580 145 L435 75 Z" fill="url(#roofGrad)" stroke="#64748b" strokeWidth="0.8" strokeOpacity="0.6" />

          <text x="400" y="200" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="bold">ZONE A</text>
          <text x="400" y="255" textAnchor="middle" fill={tempColor(zoneTemp)} fontSize="32" fontWeight="bold" fontFamily="monospace" filter="url(#glow)">
            {zoneTemp?.toFixed(1) ?? '—'}°C
          </text>
          <text x="400" y="278" textAnchor="middle" fill="#94a3b8" fontSize="8">
            RH {zoneRh?.toFixed(0)}% • CO₂ {zoneCo2?.toFixed(0)} ppm
          </text>

          {hvac.fanOn && (
            <motion.path
              d="M 258 258 L 330 295" stroke="#38bdf8" strokeWidth={2 + airflowIntensity} fill="none"
              markerEnd="url(#arrowBlue)" strokeDasharray="4 4"
              animate={{ strokeDashoffset: [0, -16] }}
              transition={{ repeat: Infinity, duration: 1.2 / Math.max(0.3, airflowIntensity), ease: 'linear' }}
              opacity={0.5 + airflowIntensity * 0.5}
            />
          )}

          <g transform="translate(588, 220)">
            <rect x="0" y="0" width="50" height="50" rx="5" fill={hvac.chillerOn ? '#1e1b4b' : '#0f172a'} stroke={hvac.chillerOn ? '#6366f1' : '#334155'} strokeWidth="1.5" />
            <text x="25" y="22" textAnchor="middle" fill={hvac.chillerOn ? '#c7d2fe' : '#475569'} fontSize="14">❄</text>
            <text x="25" y="38" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">{hvac.chillerOn ? 'BẬT' : 'TẮT'}</text>
            <text x="25" y="58" textAnchor="middle" fill="#64748b" fontSize="6">Điều hòa</text>
          </g>
        </svg>

        {baselineSim?.zone_temp != null && (
          <div className="absolute bottom-3 right-3 px-3 py-2 rounded-lg bg-slate-950/90 border border-slate-800 text-[9px]">
            <span className="text-slate-500">RBC: </span>
            <span className="font-mono font-bold text-slate-300">{baselineSim.zone_temp.toFixed(1)}°C</span>
            <span className="text-slate-600 mx-1">|</span>
            <span className="text-slate-500">DDPG: </span>
            <span className="font-mono font-bold text-emerald-400">{zoneTemp?.toFixed(1)}°C</span>
          </div>
        )}
      </div>
    </div>
  );
};
