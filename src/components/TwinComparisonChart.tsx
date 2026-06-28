import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TwinHistoryPoint } from '../types';

interface TwinComparisonChartProps {
  data: TwinHistoryPoint[];
  savingsPct: number;
  energySavedKwh?: number;
}

export const TwinComparisonChart: React.FC<TwinComparisonChartProps> = ({
  data,
  savingsPct,
  energySavedKwh = 0,
}) => (
  <div className="glass-panel rounded-2xl p-5 border border-slate-800 shadow-xl min-h-[280px]">
    <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
        Điện năng tích lũy — DDPG vs RBC
      </h3>
      <div className="flex gap-2">
        {savingsPct > 0 && (
          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            −{savingsPct.toFixed(1)}%
          </span>
        )}
        {energySavedKwh > 0 && (
          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25">
            −{energySavedKwh.toFixed(3)} kWh
          </span>
        )}
      </div>
    </div>
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="twinAi" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="twinBase" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.5} />
          <XAxis dataKey="time" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} unit=" kWh" />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
            formatter={(v: number, name: string) => [`${v.toFixed(4)} kWh`, name]}
          />
          <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }} />
          <Area type="monotone" dataKey="energy_base" name="RBC" stroke="#ef4444" strokeWidth={2} fill="url(#twinBase)" isAnimationActive={false} />
          <Area type="monotone" dataKey="energy_ai" name="DDPG" stroke="#10b981" strokeWidth={2.5} fill="url(#twinAi)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);
