import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { SeasonBenchmarkResponse, TwinResponse } from '../types';
import { cn } from '../lib/utils';

function formatVnd(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} tr ₫`;
  return `${Math.round(value).toLocaleString('vi-VN')} ₫`;
}

interface DRLMonthlySavingsProps {
  twin: TwinResponse | null;
}

export const DRLMonthlySavings: React.FC<DRLMonthlySavingsProps> = ({ twin }) => {
  const [season, setSeason] = useState<SeasonBenchmarkResponse | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(true);

  useEffect(() => {
    if (!twin) return;
    let cancelled = false;
    setSeasonLoading(true);
    fetch('/api/twin/season-benchmark')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: SeasonBenchmarkResponse | null) => {
        if (!cancelled) setSeason(data);
      })
      .catch(() => { if (!cancelled) setSeason(null); })
      .finally(() => { if (!cancelled) setSeasonLoading(false); });
    return () => { cancelled = true; };
  }, [twin]);

  if (!twin) {
    return <div className="glass-panel rounded-2xl border border-slate-800 p-6 h-32 animate-pulse" />;
  }

  return (
    <div className="glass-panel rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-slate-950/80 p-4 shadow-xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[10px] font-bold text-purple-300 uppercase tracking-widest flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5" />
          DDPG vs RBC — T5–T10 Hà Nội
        </h4>
        {season && (
          <span className="text-[10px] font-black font-mono text-emerald-400">
            6T: −{season.season_6m.savings_pct.toFixed(0)}% · {season.season_6m.saved_kwh.toFixed(0)} kWh
          </span>
        )}
      </div>

      {seasonLoading ? (
        <div className="h-28 flex items-center justify-center text-[10px] text-slate-500 animate-pulse">Đang tính…</div>
      ) : season ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] font-mono">
            <thead>
              <tr className="text-slate-500 uppercase text-left border-b border-slate-800">
                <th className="py-1.5 pr-2">Tháng</th>
                <th className="py-1.5 pr-2">T̄</th>
                <th className="py-1.5 pr-2 text-emerald-400">DDPG</th>
                <th className="py-1.5 pr-2 text-red-400/80">RBC</th>
                <th className="py-1.5 pr-2 text-amber-400">−kWh</th>
                <th className="py-1.5">%</th>
              </tr>
            </thead>
            <tbody>
              {season.months.map((row) => (
                <tr key={row.month} className="border-b border-slate-900/80">
                  <td className="py-1 pr-2 font-bold text-slate-300">T{row.month}</td>
                  <td className="py-1 pr-2 text-slate-500">{row.t_mean_c}°</td>
                  <td className="py-1 pr-2 text-emerald-400">{row.monthly_ai_kwh.toFixed(0)}</td>
                  <td className="py-1 pr-2 text-slate-400">{row.monthly_base_kwh.toFixed(0)}</td>
                  <td className="py-1 pr-2 text-amber-400">{row.monthly_saved_kwh.toFixed(0)}</td>
                  <td className={cn('py-1 font-black', row.savings_pct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {row.savings_pct.toFixed(0)}%
                  </td>
                </tr>
              ))}
              <tr className="font-black text-[10px]">
                <td className="py-1.5 text-purple-300" colSpan={2}>6 tháng</td>
                <td className="py-1.5 text-emerald-400">{season.season_6m.ai_kwh.toFixed(0)}</td>
                <td className="py-1.5 text-slate-300">{season.season_6m.base_kwh.toFixed(0)}</td>
                <td className="py-1.5 text-amber-400">{season.season_6m.saved_kwh.toFixed(0)}</td>
                <td className="py-1.5 text-emerald-400">{season.season_6m.savings_pct.toFixed(0)}%</td>
              </tr>
              <tr className="font-black text-[10px] border-t border-cyan-500/20">
                <td className="py-1.5 text-cyan-300" colSpan={2}>1 năm (ước)</td>
                <td className="py-1.5 text-emerald-400">{season.annual_estimate.ai_kwh.toFixed(0)}</td>
                <td className="py-1.5 text-slate-300">{season.annual_estimate.base_kwh.toFixed(0)}</td>
                <td className="py-1.5 text-amber-400">{season.annual_estimate.saved_kwh.toFixed(0)}</td>
                <td className="py-1.5 text-emerald-400">{formatVnd(season.annual_estimate.saved_vnd)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[10px] text-red-400/80 text-center py-6">Lỗi tải dữ liệu</p>
      )}
    </div>
  );
};
