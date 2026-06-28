import React from 'react';
import { Brain } from 'lucide-react';
import { DRLPanel } from '../types';
import { cn } from '../lib/utils';

interface DRLModelPanelProps {
  panel?: DRLPanel;
}

const STATE_UNITS: Record<string, string> = {
  hour: 'h', T_outdoor: '°C', 'ω_outdoor': 'kg/kg', q_solar: 'W/m²',
  CO2_outdoor: 'ppm', PM_outdoor: 'µg/m³', T_zone: '°C', 'ω_zone': 'kg/kg',
  CO2_zone: 'ppm', PM_zone: 'µg/m³',
};

export const DRLModelPanel: React.FC<DRLModelPanelProps> = ({ panel }) => {
  if (!panel) {
    return <div className="glass-panel rounded-2xl p-6 border border-slate-800 h-48 animate-pulse" />;
  }

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/85 p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-purple-400" />
          DDPG Agent
        </h4>
        <p className={cn(
          'text-sm font-black font-mono',
          (panel.reward ?? 0) > -5 ? 'text-emerald-400' : 'text-amber-400',
        )}>
          r = {panel.reward?.toFixed(2) ?? '--'}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {panel.state.map((s) => (
          <div key={s.label} className="bg-slate-950/60 border border-slate-800 rounded-lg p-2">
            <p className="text-[7px] text-slate-500 font-bold truncate">{s.label}</p>
            <p className="text-xs font-mono font-black text-slate-200">
              {s.value.toFixed(s.label.includes('omega') || s.label.startsWith('ω') ? 4 : 1)}
              <span className="text-[8px] text-slate-600 ml-0.5">{STATE_UNITS[s.label] ?? ''}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {panel.action.map((a, i) => {
          const physKey = ['T_chws', 'D_oa', 'f_sa', 'P_air'][i];
          const physVal = panel.physical?.[physKey];
          return (
            <div key={a.label} className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2.5">
              <p className="text-[8px] text-purple-300 font-bold">{a.label}</p>
              <p className="text-sm font-mono font-black text-white mt-0.5">
                {physKey === 'P_air' ? (physVal ? 'ON' : 'OFF') : physVal !== undefined ? (
                  physKey === 'D_oa' || physKey === 'f_sa' ? `${(physVal * 100).toFixed(0)}%` : `${physVal}°C`
                ) : a.normalized.toFixed(2)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
