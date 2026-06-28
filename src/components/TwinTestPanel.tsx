import React from 'react';
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
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

export const TwinTestPanel: React.FC<TwinTestPanelProps> = ({ twin, onAction, busy }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => onAction(twin?.paused ? 'play' : 'pause')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border cursor-pointer',
          twin?.paused
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
        )}
      >
        {twin?.paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
        {twin?.paused ? 'Chạy' : 'Dừng'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onAction('step')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30 cursor-pointer"
      >
        <SkipForward className="w-3 h-3" />
        +1 bước
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onAction('reset')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer"
      >
        <RotateCcw className="w-3 h-3" />
        Reset
      </button>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[8px] font-bold uppercase text-slate-500">Tháng:</span>
      {MONTHS.map((m) => (
        <button
          key={m.v}
          type="button"
          disabled={busy}
          onClick={() => onAction('set_month', m.v)}
          className={cn(
            'px-2 py-1 rounded-md text-[9px] font-black border cursor-pointer',
            twin?.month === m.v
              ? 'bg-violet-600/25 text-violet-300 border-violet-500/40'
              : 'bg-slate-900 text-slate-500 border-slate-800'
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  </div>
);
