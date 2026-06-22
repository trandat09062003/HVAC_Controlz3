import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BuildingSimSnapshot } from '../types';

interface EnergyBreakdownChartProps {
  sim?: BuildingSimSnapshot | null;
  baselineSim?: BuildingSimSnapshot | null;
}

const COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#64748b'];

export const EnergyBreakdownChart: React.FC<EnergyBreakdownChartProps> = ({ sim }) => {
  if (!sim?.devices) {
    return (
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 h-48 flex items-center justify-center">
        <span className="text-xs text-slate-500 animate-pulse">Đang tính phân rã điện năng...</span>
      </div>
    );
  }

  const data = Object.entries(sim.devices)
    .filter(([, d]) => d.enabled && d.power_w > 0)
    .map(([key, d]) => ({ name: d.name, power: d.power_w, key }))
    .sort((a, b) => b.power - a.power);

  const total = data.reduce((s, d) => s + d.power, 0);

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/85 p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Phân rã công suất thiết bị (AI-Optimized)
        </h4>
        <span className="text-sm font-black font-mono text-white">{total.toFixed(0)} W</span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} unit="W" />
            <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 8 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
              formatter={(v: number) => [`${v.toFixed(1)} W`, 'Công suất']}
            />
            <Bar dataKey="power" radius={[0, 4, 4, 0]} barSize={14}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
