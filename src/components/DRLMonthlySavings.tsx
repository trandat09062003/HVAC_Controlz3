import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { SeasonBenchmarkResponse, TwinResponse } from '../types';
import { cn } from '../lib/utils';

function formatVnd(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} tr ₫`;
  return `${Math.round(value).toLocaleString('vi-VN')} ₫`;
}

interface DRLMonthlySavingsProps {
  twin: TwinResponse | null;
  onTwinRefresh?: (twin: TwinResponse) => void;
}

export const DRLMonthlySavings: React.FC<DRLMonthlySavingsProps> = ({ twin, onTwinRefresh }) => {
  const [season, setSeason] = useState<SeasonBenchmarkResponse | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(true);
  const [presetBusy, setPresetBusy] = useState(false);

  const activePreset = twin?.baseline_preset ?? season?.baseline_preset ?? 'office';
  const presetOptions = twin?.baseline_presets ?? season?.baseline_presets ?? {
    office: 'BMS văn phòng',
    paper: 'Bài báo (cũ)',
    eco: 'BMS tiết kiệm',
  };

  const loadSeason = useCallback(async (preset: string) => {
    setSeasonLoading(true);
    try {
      const response = await fetch(`/api/twin/season-benchmark?preset=${encodeURIComponent(preset)}`);
      if (!response.ok) throw new Error('benchmark failed');
      const data: SeasonBenchmarkResponse = await response.json();
      setSeason(data);
    } catch {
      setSeason(null);
    } finally {
      setSeasonLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!twin) return;
    loadSeason(activePreset);
  }, [twin, activePreset, loadSeason]);

  const handlePresetChange = async (preset: string) => {
    if (preset === activePreset || presetBusy) return;
    setPresetBusy(true);
    setSeasonLoading(true);
    try {
      const response = await fetch('/api/twin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_baseline', preset }),
      });
      if (!response.ok) throw new Error('set baseline failed');
      const data = await response.json();
      if (data.twin) onTwinRefresh?.(data.twin);
    } catch {
      setSeasonLoading(false);
    } finally {
      setPresetBusy(false);
    }
  };

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

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[9px] text-slate-500 uppercase tracking-wider mr-1">Baseline RBC</span>
        {Object.entries(presetOptions).map(([key, label]) => (
          <button
            key={key}
            type="button"
            disabled={presetBusy}
            onClick={() => handlePresetChange(key)}
            className={cn(
              'px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide border transition-colors',
              activePreset === key
                ? 'bg-purple-500/20 border-purple-400/50 text-purple-200'
                : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200',
              presetBusy && 'opacity-60 cursor-wait',
            )}
          >
            {label}
          </button>
        ))}
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
