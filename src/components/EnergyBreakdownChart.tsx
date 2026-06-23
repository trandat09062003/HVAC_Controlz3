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
    .filter(([, d]) => d.enabled && d.power_w > 0)
    .map(([key, d]) => ({ name: d.name, ai: d.power_w, base: baselineSim?.devices?.[key]?.power_w ?? 0, key }))
    .sort((a, b) => b.ai - a.ai);

  const totalAi = aiData.reduce((s, d) => s + d.ai, 0);
  const totalBase = aiData.reduce((s, d) => s + d.base, 0);

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/85 p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Phân rã công suất thiết bị
        </h4>
        <div className="flex gap-3 text-[9px] font-black font-mono">
          <span className="text-emerald-400">DDPG {totalAi.toFixed(0)} W</span>
          {baselineSim && <span className="text-slate-500">RBC {totalBase.toFixed(0)} W</span>}
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
