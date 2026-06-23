import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { ChartDataPoint } from '../types';

interface SensorHistoryChartProps {
  data: ChartDataPoint[];
}

export const SensorHistoryChart: React.FC<SensorHistoryChartProps> = ({ data }) => {
  return (
    <div className="w-full h-full min-h-[300px] glass-panel rounded-2xl p-5 border shadow-xl">
      <div className="mb-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Lịch sử cảm biến thực tế</h3>
        <p className="text-[10px] text-slate-500 font-semibold tracking-wide mt-1">
          Dữ liệu từ ESP32 — nhiệt độ, CO₂, độ ẩm, PM₂.₅
        </p>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.6} />
            <XAxis dataKey="time" hide />
            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              wrapperStyle={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: '#94a3b8' }}
            />
            <Line type="monotone" dataKey="temp" name="Nhiệt độ (°C)" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="co2" name="CO₂ (ppm)" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="humidity" name="Độ ẩm (%)" stroke="#34d399" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="pm25" name="PM₂.₅" stroke="#fbbf24" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
