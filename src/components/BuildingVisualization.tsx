import React from 'react';
import { motion } from 'motion/react';
import { Building2, User, Wind, Thermometer, Cpu } from 'lucide-react';
import { BuildingInfo, BuildingSimSnapshot } from '../types';
import { cn } from '../lib/utils';

interface BuildingVisualizationProps {
  building?: BuildingInfo;
  sim?: BuildingSimSnapshot | null;
  temperature?: number | null;
  isOnline?: boolean;
}

export const BuildingVisualization: React.FC<BuildingVisualizationProps> = ({
  building,
  sim,
  temperature,
  isOnline,
}) => {
  const damper = sim?.airflow.damper_pct ?? 0;
  const occ = building?.occupancy ?? 1;

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/85 p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" />
            Digital Twin — Mô phỏng tòa nhà
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            {building?.building_name ?? 'Tòa nhà văn phòng'} • {building?.zone_id ?? 'Zone A'}
          </p>
        </div>
        <span className={cn(
          'text-[8px] font-black uppercase px-2 py-1 rounded-full border',
          isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'
        )}>
          {isOnline ? 'Live Sensor' : 'Offline'}
        </span>
      </div>

      <div className="relative aspect-[16/9] rounded-xl bg-gradient-to-br from-slate-950 via-[#0a1628] to-slate-950 border border-slate-800 overflow-hidden">
        {/* Building outline */}
        <svg viewBox="0 0 400 220" className="w-full h-full">
          <defs>
            <linearGradient id="zoneGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          {/* Floor slab */}
          <rect x="20" y="160" width="360" height="8" fill="#334155" rx="2" />
          {/* Zone room */}
          <rect x="60" y="60" width="280" height="100" fill="url(#zoneGrad)" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.5" rx="4" />
          <text x="200" y="85" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="bold">ZONE A — PHÒNG LÀM VIỆC</text>
          <text x="200" y="100" textAnchor="middle" fill="#64748b" fontSize="7">{building?.volume_m3?.toFixed(0) ?? '273'} m³ • {building?.floor ?? 'Tầng 12'}</text>

          {/* AHU unit */}
          <rect x="20" y="80" width="35" height="50" fill="#1e293b" stroke="#475569" rx="3" />
          <text x="37" y="108" textAnchor="middle" fill="#64748b" fontSize="6">AHU</text>

          {/* Duct */}
          <motion.rect
            x="55" y="98" width={40 + damper * 0.8}
            height="6" fill="#3b82f6" fillOpacity="0.6" rx="2"
            animate={{ width: 40 + damper * 0.8 }}
            transition={{ duration: 0.8 }}
          />

          {/* Damper */}
          <rect x="95" y="92" width="8" height="18" fill="#0ea5e9" fillOpacity={0.3 + damper / 200} stroke="#38bdf8" strokeWidth="0.5" />
          <text x="99" y="118" textAnchor="middle" fill="#38bdf8" fontSize="6">{damper.toFixed(0)}%</text>

          {/* Occupant */}
          {Array.from({ length: Math.min(occ, 3) }).map((_, i) => (
            <g key={i} transform={`translate(${140 + i * 50}, 130)`}>
              <circle cx="0" cy="-8" r="6" fill="#fbbf24" fillOpacity="0.8" />
              <rect x="-5" y="0" width="10" height="14" fill="#fbbf24" fillOpacity="0.6" rx="2" />
            </g>
          ))}
          <text x="200" y="148" textAnchor="middle" fill="#fbbf24" fontSize="7" fontWeight="bold">
            {occ} người (cố định)
          </text>

          {/* Sensor node */}
          <circle cx="320" cy="130" r="8" fill="#10b981" fillOpacity="0.3" stroke="#10b981" />
          <text x="320" y="133" textAnchor="middle" fill="#10b981" fontSize="6">IoT</text>

          {/* Temp display */}
          <rect x="280" y="70" width="50" height="28" fill="#0f172a" stroke="#334155" rx="4" />
          <text x="305" y="82" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="bold">
            {temperature?.toFixed(1) ?? '--'}°C
          </text>
          <text x="305" y="92" textAnchor="middle" fill="#64748b" fontSize="6">Trong phòng</text>

          {/* Airflow arrows */}
          <motion.path
            d="M 120 101 L 160 101"
            stroke="#60a5fa" strokeWidth="2" fill="none" markerEnd="url(#arrow)"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        </svg>

        {/* Legend */}
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-2">
          {[
            { icon: Thermometer, label: `T_zone ${temperature?.toFixed(1) ?? '--'}°C`, color: 'text-blue-400' },
            { icon: Wind, label: `V_oa ${sim?.airflow.V_oa.toFixed(2) ?? '0'} m³/s`, color: 'text-cyan-400' },
            { icon: User, label: `${occ} occupant`, color: 'text-amber-400' },
            { icon: Cpu, label: `Reward ${sim?.reward?.toFixed(2) ?? '--'}`, color: 'text-purple-400' },
          ].map(({ icon: Icon, label, color }) => (
            <span key={label} className={cn('flex items-center gap-1 text-[8px] font-bold bg-slate-950/80 px-2 py-0.5 rounded-full border border-slate-800', color)}>
              <Icon className="w-2.5 h-2.5" /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* Comfort indicators */}
      {sim?.comfort && (
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { key: 'temp_ok', label: 'Nhiệt 22–24.5°C', ok: sim.comfort.temp_ok },
            { key: 'rh_ok', label: 'RH ≤ 60%', ok: sim.comfort.rh_ok },
            { key: 'co2_ok', label: 'CO₂ < 1000', ok: sim.comfort.co2_ok },
            { key: 'pm_ok', label: 'PM₂.₅ < 10', ok: sim.comfort.pm_ok },
          ].map(item => (
            <div key={item.key} className={cn(
              'text-center py-2 rounded-lg border text-[8px] font-black uppercase',
              item.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
            )}>
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
