import React from 'react';
import { Brain, ArrowRight } from 'lucide-react';
import { DRLPanel } from '../types';
import { cn } from '../lib/utils';

interface DRLModelPanelProps {
  panel?: DRLPanel;
  policy?: string;
}

const STATE_UNITS: Record<string, string> = {
  hour: 'h', T_outdoor: '°C', 'ω_outdoor': 'kg/kg', q_solar: 'W/m²',
  CO2_outdoor: 'ppm', PM_outdoor: 'µg/m³', T_zone: '°C', 'ω_zone': 'kg/kg',
  CO2_zone: 'ppm', PM_zone: 'µg/m³',
};

const ACTION_DESC: Record<string, string> = {
  T_chws: 'Nhiệt độ nước lạnh [5–15°C]',
  D_oa: 'Van gió tươi [20–100%]',
  f_sa: 'Tốc độ quạt cấp [10–100%]',
  P_air: 'Máy lọc không khí ON/OFF',
};

export const DRLModelPanel: React.FC<DRLModelPanelProps> = ({ panel, policy }) => {
  if (!panel) {
    return <div className="glass-panel rounded-2xl p-6 border border-slate-800 h-64 animate-pulse" />;
  }

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/85 p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            DDPG Agent — Applied Energy 2025
          </h4>
          <p className="text-[9px] text-slate-500 mt-0.5">{panel.model} • DOI: 10.1016/j.apenergy.2024.124467</p>
        </div>
        <div className="text-right">
          <p className="text-[8px] text-slate-500 uppercase font-bold">Reward (Eq. 15–20)</p>
          <p className={cn(
            'text-lg font-black font-mono',
            (panel.reward ?? 0) > -5 ? 'text-emerald-400' : 'text-amber-400'
          )}>
            {panel.reward?.toFixed(3) ?? '--'}
          </p>
        </div>
      </div>

      {/* State vector */}
      <div>
        <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-2">State s_t (10 chiều — Table 4)</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {panel.state.map(s => (
            <div key={s.label} className="bg-slate-950/60 border border-slate-800 rounded-lg p-2">
              <p className="text-[7px] text-slate-500 font-bold truncate">{s.label}</p>
              <p className="text-xs font-mono font-black text-slate-200">
                {s.value.toFixed(s.label.includes('omega') || s.label.startsWith('ω') ? 4 : 1)}
                <span className="text-[8px] text-slate-600 ml-0.5">{STATE_UNITS[s.label] ?? ''}</span>
              </p>
              <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500/70 rounded-full" style={{ width: `${Math.min(100, s.norm * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action arrow */}
      <div className="flex items-center justify-center gap-2 py-1">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
        <ArrowRight className="w-4 h-4 text-purple-400" />
        <span className="text-[8px] font-black text-purple-400 uppercase">Actor π(s)</span>
        <ArrowRight className="w-4 h-4 text-purple-400" />
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
      </div>

      {/* Action vector */}
      <div>
        <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-2">Action a_t (4 chiều — Table 5)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {panel.action.map((a, i) => {
            const physKey = ['T_chws', 'D_oa', 'f_sa', 'P_air'][i];
            const physVal = panel.physical?.[physKey];
            return (
              <div key={a.label} className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3">
                <p className="text-[8px] text-purple-300 font-bold">{a.label}</p>
                <p className="text-[7px] text-slate-500 mb-1">{ACTION_DESC[a.label]}</p>
                <p className="text-sm font-mono font-black text-white">
                  {physKey === 'P_air' ? (physVal ? 'ON' : 'OFF') : physVal !== undefined ? (
                    physKey === 'D_oa' || physKey === 'f_sa' ? `${(physVal * 100).toFixed(0)}%` : `${physVal}${physKey === 'T_chws' ? '°C' : ''}`
                  ) : a.normalized.toFixed(2)}
                </p>
                <p className="text-[7px] text-slate-600 mt-0.5">tanh: {a.raw.toFixed(3)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {policy && (
        <p className="text-[9px] text-slate-500 text-center">
          Chính sách zone: <span className="text-purple-400 font-bold">{policy}</span> • Occupancy cố định 1 người
        </p>
      )}
    </div>
  );
};
