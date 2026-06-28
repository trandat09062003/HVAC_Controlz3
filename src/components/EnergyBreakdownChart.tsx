import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { BuildingSimSnapshot } from '../types';

interface EnergyBreakdownChartProps {
  sim?: BuildingSimSnapshot | null;
  baselineSim?: BuildingSimSnapshot | null;
}

const COLORS_AI = ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#64748b'];
const COLORS_BASE = ['#64748b', '#94a3b8', '#78716c', '#a8a29e', '#9ca3af', '#6b7280', '#52525b'];

export const EnergyBreakdownChart: React.FC<EnergyBreakdownChartProps> = ({ sim, baselineSim }) => {
  if (!sim?.devices) {
    return (
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 h-48 flex items-center justify-center">
        <span className="text-xs text-slate-500 animate-pulse">Đang tính phân rã điện năng...</span>
      </div>
    );
  }

  const aiData = Object.entries(sim.devices)
    .filter(([key, d]) => d.enabled && (d.power_w > 0 || (baselineSim?.devices?.[key]?.power_w ?? 0) > 0))
    .map(([key, d]) => {
      const baseW = baselineSim?.devices?.[key]?.power_w ?? 0;
      const saved = Math.max(0, baseW - d.power_w);
      return { name: d.name, ai: d.power_w, base: baseW, saved, key };
    })
    .sort((a, b) => b.base - a.base);

  const totalAi = aiData.reduce((s, d) => s + d.ai, 0);
  const totalBase = aiData.reduce((s, d) => s + d.base, 0);
  const totalSaved = Math.max(0, totalBase - totalAi);
  const savingsPct = totalBase > 0 ? (totalSaved / totalBase) * 100 : 0;

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/85 p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Phân rã công suất thiết bị
          </h4>
      {baselineSim && totalSaved > 0 && (
            <p className="text-[9px] text-emerald-400 font-bold mt-1">
              Giảm {totalSaved.toFixed(0)} W ({savingsPct.toFixed(0)}%)
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-[9px] font-black font-mono">
          <span className="text-emerald-400">DDPG {totalAi.toFixed(0)} W</span>
          {baselineSim && <span className="text-red-400/70">RBC {totalBase.toFixed(0)} W</span>}
          {baselineSim && totalSaved > 0 && (
            <span className="text-amber-400">−{totalSaved.toFixed(0)} W</span>
          )}
        </div>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={aiData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} unit="W" />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#94a3b8', fontSize: 8 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
              formatter={(v: number, name: string) => [`${v.toFixed(1)} W`, name]}
            />
            {baselineSim && (
              <Legend wrapperStyle={{ fontSize: '9px', color: '#94a3b8' }} />
            )}
            <Bar dataKey="ai" name="DDPG" radius={[0, 4, 4, 0]} barSize={baselineSim ? 8 : 14}>
              {aiData.map((_, i) => (
                <Cell key={`ai-${i}`} fill={COLORS_AI[i % COLORS_AI.length]} fillOpacity={0.9} />
              ))}
            </Bar>
            {baselineSim && (
              <Bar dataKey="base" name="RBC" radius={[0, 4, 4, 0]} barSize={8}>
                {aiData.map((_, i) => (
                  <Cell key={`base-${i}`} fill={COLORS_BASE[i % COLORS_BASE.length]} fillOpacity={0.7} />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
