import React from 'react';
import { TrendingDown, Leaf, Zap } from 'lucide-react';
import { TwinResponse } from '../types';
import { cn } from '../lib/utils';

function formatVnd(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} tr ₫`;
  return `${Math.round(value).toLocaleString('vi-VN')} ₫`;
}

interface TwinSavingsPanelProps {
  twin: TwinResponse | null;
  compact?: boolean;
}

export const TwinSavingsPanel: React.FC<TwinSavingsPanelProps> = ({ twin, compact = false }) => {
  const s = twin?.savings_summary;
  const pct = s?.savings_pct ?? twin?.savings_pct ?? 0;
  const hasSteps = (twin?.sim_step ?? 0) > 0;
  const powerAi = s?.power_ai_w ?? twin?.buildingSim?.total_power_w ?? 0;
  const powerBase = s?.power_base_w ?? twin?.baselineSim?.total_power_w ?? 0;
  const maxPower = Math.max(powerAi, powerBase, 1);
  const energyAi = twin?.energy_ai_kwh ?? 0;
  const energyBase = twin?.energy_base_kwh ?? 0;

  if (!twin) {
    return <div className="glass-panel rounded-2xl border border-slate-800 p-6 animate-pulse h-24" />;
  }

  const hour = twin.sim_hour ?? 0;
  const simTime = `${Math.floor(hour).toString().padStart(2, '0')}:${Math.round((hour % 1) * 60).toString().padStart(2, '0')}`;

  const powerDelta = s?.power_delta_w ?? (powerBase - powerAi);
  const instantPct = s?.instant_savings_pct ?? 0;

  const powerLabel = powerDelta >= 0
    ? `−${powerDelta.toFixed(0)} W`
    : `+${Math.abs(powerDelta).toFixed(0)} W (DDPG cao hơn)`;
  const powerColor = powerDelta >= 0 ? 'text-violet-400' : 'text-amber-400';

  const metrics = compact
    ? [
        { icon: TrendingDown, label: 'Tiết kiệm tích lũy', value: `${(s?.energy_saved_kwh ?? 0).toFixed(3)} kWh`, color: 'text-emerald-400' },
        { icon: Leaf, label: 'Chi phí', value: formatVnd(s?.savings_vnd ?? 0), color: 'text-amber-400' },
        { icon: Zap, label: 'Công suất hiện tại', value: powerLabel, color: powerColor },
        { icon: Leaf, label: 'Dự báo/tháng', value: formatVnd(s?.projected_monthly_vnd ?? 0), color: 'text-cyan-400' },
      ]
    : [
        { icon: TrendingDown, label: 'Đã tiết kiệm', value: `${(s?.energy_saved_kwh ?? 0).toFixed(3)} kWh`, color: 'text-emerald-400' },
        { icon: Zap, label: 'DDPG / RBC', value: `${energyAi.toFixed(3)} / ${energyBase.toFixed(3)} kWh`, color: 'text-slate-300' },
        { icon: Leaf, label: 'Chi phí giảm', value: formatVnd(s?.savings_vnd ?? 0), color: 'text-amber-400' },
        { icon: Zap, label: 'Công suất hiện tại', value: powerLabel, color: powerColor },
        { icon: Leaf, label: 'Dự báo/ngày', value: `${(s?.projected_daily_kwh ?? 0).toFixed(2)} kWh`, color: 'text-cyan-400' },
        { icon: Leaf, label: 'Dự báo/tháng', value: `${(s?.projected_monthly_saved_kwh ?? s?.projected_monthly_kwh ?? 0).toFixed(1)} kWh · ${formatVnd(s?.projected_monthly_vnd ?? 0)}`, color: 'text-cyan-400' },
      ];

  return (
    <div className="glass-panel rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/30 to-slate-950/80 p-4 shadow-xl">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
        <div className="flex items-center gap-4 shrink-0">
          <div className={cn('relative', compact ? 'w-16 h-16' : 'w-20 h-20')}>
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none" stroke="#10b981" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${Math.min(pct, 100) * 2.64} 264`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('font-black font-mono text-emerald-400', compact ? 'text-lg' : 'text-xl')}>
                {hasSteps ? `${pct.toFixed(0)}%` : '—'}
              </span>
            </div>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase text-emerald-400 tracking-widest">Tiết kiệm tích lũy vs RBC</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Bước {twin.sim_step} • {simTime} • Tháng {twin.month} • Ngoài trời {twin.weather.outdoor_temp}°C
            </p>
            {s && (
              <p className="text-[9px] text-slate-600 mt-1">
                Thoải mái: DDPG {s.comfort_ok_ai ? '✓' : '✗'} · RBC {s.comfort_ok_base ? '✓' : '✗'}
                {' · '}Giá điện {s.tariff_vnd.toLocaleString('vi-VN')} ₫/kWh
              </p>
            )}
          </div>
        </div>

        <div className={cn(
          'flex-1 grid gap-2',
          compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6',
        )}>
          {metrics.map((item) => (
            <div key={item.label} className="rounded-lg bg-slate-950/60 border border-slate-800/80 px-2.5 py-2">
              <p className="text-[7px] font-bold uppercase text-slate-500 flex items-center gap-1">
                <item.icon className="w-2.5 h-2.5" /> {item.label}
              </p>
              <p className={cn('text-xs font-black font-mono mt-0.5', item.color)}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-[7px] font-bold uppercase text-slate-600 tracking-wider">
          Công suất tức thời bước này {instantPct !== 0 && (
            <span className={instantPct >= 0 ? 'text-emerald-500' : 'text-amber-500'}>
              ({instantPct >= 0 ? '−' : '+'}{Math.abs(instantPct).toFixed(0)}%)
            </span>
          )}
        </p>
        <div className="flex items-center gap-2 text-[8px] font-bold uppercase text-slate-500">
          <span className="w-10 text-emerald-400">DDPG</span>
          <div className="flex-1 h-2 rounded-full bg-slate-900 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(powerAi / maxPower) * 100}%` }} />
          </div>
          <span className="w-12 text-right font-mono text-emerald-400">{powerAi.toFixed(0)}W</span>
        </div>
        <div className="flex items-center gap-2 text-[8px] font-bold uppercase text-slate-500">
          <span className="w-10 text-red-400/80">RBC</span>
          <div className="flex-1 h-2 rounded-full bg-slate-900 overflow-hidden">
            <div className="h-full bg-red-500/60 rounded-full" style={{ width: `${(powerBase / maxPower) * 100}%` }} />
          </div>
          <span className="w-12 text-right font-mono text-slate-400">{powerBase.toFixed(0)}W</span>
        </div>
      </div>
    </div>
  );
};
