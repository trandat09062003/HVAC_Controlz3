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
}

export const TwinComparisonChart: React.FC<TwinComparisonChartProps> = ({ data, savingsPct }) => {
  return (
    <div className="w-full h-full min-h-[300px] glass-panel rounded-2xl p-5 border shadow-xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            So sánh điện năng — DDPG vs RBC
          </h3>
          <p className="text-[10px] text-slate-500 font-semibold tracking-wide mt-1">
            Mô phỏng thời tiết Hà Nội • bước 15 phút • dữ liệu ảo
          </p>
        </div>
        {savingsPct > 0 && (
          <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            AI tiết kiệm {savingsPct.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="twinAi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="twinBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.6} />
            <XAxis dataKey="time" hide />
            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(3)}`} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
              formatter={(v: number, name: string) => [`${v.toFixed(4)} kWh`, name]}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: '#94a3b8' }}
            />
            <Area type="monotone" dataKey="energy_ai" name="DDPG (AI)" stroke="#10b981" strokeWidth={2.5} fill="url(#twinAi)" isAnimationActive={false} />
            <Area type="monotone" dataKey="energy_base" name="RBC (Baseline)" stroke="#ef4444" strokeWidth={2} fill="url(#twinBase)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
