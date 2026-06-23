import React from 'react';
import { Play, Pause, SkipForward, RotateCcw, Sun, Cloud } from 'lucide-react';
import { TwinResponse } from '../types';
import { cn } from '../lib/utils';

interface TwinTestPanelProps {
  twin: TwinResponse | null;
  onAction: (action: 'reset' | 'step' | 'pause' | 'play' | 'set_month', month?: number) => Promise<void>;
  busy?: boolean;
}

const MONTHS = [
  { v: 5, label: 'T5' },
  { v: 6, label: 'T6' },
  { v: 7, label: 'T7' },
  { v: 8, label: 'T8' },
  { v: 9, label: 'T9' },
  { v: 10, label: 'T10' },
];

export const TwinTestPanel: React.FC<TwinTestPanelProps> = ({ twin, onAction, busy }) => {
  const hour = twin?.sim_hour ?? 0;
  const isDay = hour >= 6 && hour < 20;

  return (
    <div className="glass-panel rounded-2xl border border-violet-500/20 p-4 shadow-xl bg-gradient-to-r from-violet-950/30 to-slate-950/50">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-violet-400">Bảng điều khiển mô phỏng</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Thời tiết Hà Nội ảo • 1 bước = 15 phút • DDPG vs RBC song song
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction(twin?.paused ? 'play' : 'pause')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase border cursor-pointer transition-all',
              twin?.paused
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
            )}
          >
            {twin?.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {twin?.paused ? 'Chạy' : 'Tạm dừng'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction('step')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
            +1 bước
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction('reset')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mt-4">
        {[
          { label: 'Bước', value: twin?.sim_step ?? '—' },
          { label: 'Giờ mô phỏng', value: twin ? `${Math.floor(hour).toString().padStart(2, '0')}:${Math.round((hour % 1) * 60).toString().padStart(2, '0')}` : '—' },
          { label: 'Ngoài trời', value: twin ? `${twin.weather.outdoor_temp}°C` : '—' },
          { label: 'Zone (DDPG)', value: twin?.buildingSim?.zone_temp != null ? `${twin.buildingSim.zone_temp}°C` : '—' },
          { label: 'Zone (RBC)', value: twin?.baselineSim?.zone_temp != null ? `${twin.baselineSim.zone_temp}°C` : '—' },
          { label: 'Tiết kiệm', value: twin ? `${twin.savings_pct}%` : '—', accent: true },
          { label: 'Điện DDPG', value: twin ? `${twin.energy_ai_kwh.toFixed(3)} kWh` : '—' },
          { label: 'Điện RBC', value: twin ? `${twin.energy_base_kwh.toFixed(3)} kWh` : '—' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-slate-950/60 border border-slate-800/80 px-2.5 py-2">
            <p className="text-[7px] font-bold uppercase text-slate-500 tracking-wider">{item.label}</p>
            <p className={cn('text-xs font-black font-mono mt-0.5', item.accent ? 'text-emerald-400' : 'text-slate-200')}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-slate-800/80">
        <span className="text-[8px] font-bold uppercase text-slate-500">Tháng khí hậu:</span>
        {MONTHS.map((m) => (
          <button
            key={m.v}
            type="button"
            disabled={busy}
            onClick={() => onAction('set_month', m.v)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[9px] font-black border cursor-pointer transition-all',
              twin?.month === m.v
                ? 'bg-violet-600/25 text-violet-300 border-violet-500/40'
                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
            )}
          >
            {m.label}
          </button>
        ))}
        <span className={cn('ml-auto flex items-center gap-1 text-[9px] font-bold', isDay ? 'text-amber-400' : 'text-indigo-400')}>
          {isDay ? <Sun className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
          {isDay ? 'Ban ngày' : 'Ban đêm'} • Solar {twin?.weather.solar_wm2 ?? 0} W/m²
        </span>
      </div>
    </div>
  );
};
