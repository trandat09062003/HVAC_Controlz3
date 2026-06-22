import React, { useState, useCallback } from 'react';
import { Settings, Save, Zap, LoaderCircle } from 'lucide-react';
import { PowerConfig } from '../types';
import { cn } from '../lib/utils';

interface DevicePowerPanelProps {
  config: PowerConfig | null;
  totalPowerW?: number;
  tariffVnd?: number;
  onSave: (updates: Partial<PowerConfig>) => Promise<void>;
}

export const DevicePowerPanel: React.FC<DevicePowerPanelProps> = ({
  config,
  totalPowerW = 0,
  tariffVnd = 2500,
  onSave,
}) => {
  const [localDevices, setLocalDevices] = useState<Record<string, { power_w: number; enabled: boolean }>>({});
  const [saving, setSaving] = useState(false);
  const [cop, setCop] = useState(config?.cop ?? 3.0);
  const [tariff, setTariff] = useState(config?.electricity_tariff_vnd ?? 2500);

  React.useEffect(() => {
    if (!config?.devices) return;
    const init: Record<string, { power_w: number; enabled: boolean }> = {};
    Object.entries(config.devices).forEach(([key, dev]) => {
      if (!dev.dynamic) {
        init[key] = { power_w: dev.power_w, enabled: dev.enabled ?? true };
      }
    });
    setLocalDevices(init);
    setCop(config.cop);
    setTariff(config.electricity_tariff_vnd);
  }, [config]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave({
        cop,
        electricity_tariff_vnd: tariff,
        devices: Object.fromEntries(
          Object.entries(localDevices).map(([key, val]) => [key, val])
        ),
      });
    } finally {
      setSaving(false);
    }
  }, [cop, tariff, localDevices, onSave]);

  if (!config) {
    return (
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 animate-pulse h-64" />
    );
  }

  const hourlyCost = (totalPowerW / 1000) * tariff;

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/85 p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Settings className="w-3.5 h-3.5" />
            Cấu hình điện năng thiết bị
          </h4>
          <p className="text-[9px] text-slate-500 mt-0.5">Theo mô hình Guo et al. (Applied Energy 2025)</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-[9px] font-black uppercase text-blue-400 transition-colors disabled:opacity-50"
        >
          {saving ? <LoaderCircle className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Lưu
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="space-y-1">
          <span className="text-[8px] text-slate-500 font-bold uppercase">COP Chiller</span>
          <input
            type="number" step="0.1" min="1" max="6" value={cop}
            onChange={e => setCop(parseFloat(e.target.value) || 3)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 focus:border-blue-500/50 outline-none"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[8px] text-slate-500 font-bold uppercase">Giá điện (VNĐ/kWh)</span>
          <input
            type="number" step="100" min="0" value={tariff}
            onChange={e => setTariff(parseFloat(e.target.value) || 2500)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 focus:border-blue-500/50 outline-none"
          />
        </label>
      </div>

      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
        {Object.entries(config.devices).map(([key, dev]) => {
          const isDynamic = dev.dynamic;
          const livePower = config.devices[key]?.power_w ?? dev.power_w;
          const local = localDevices[key];

          return (
            <div key={key} className={cn(
              'flex items-center gap-3 p-3 rounded-xl border',
              isDynamic ? 'bg-blue-500/5 border-blue-500/20' : 'bg-slate-950/40 border-slate-800'
            )}>
              <Zap className={cn('w-4 h-4 shrink-0', isDynamic ? 'text-blue-400' : 'text-amber-400')} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-300 truncate">{dev.name}</p>
                {isDynamic && (
                  <p className="text-[8px] text-blue-400/70">Tính động từ DRL (Eq. 22–24)</p>
                )}
              </div>
              {isDynamic ? (
                <span className="text-sm font-mono font-black text-blue-400">{livePower.toFixed(0)} W</span>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={local?.enabled ?? true}
                    onChange={e => setLocalDevices(prev => ({
                      ...prev,
                      [key]: { ...prev[key], power_w: prev[key]?.power_w ?? dev.power_w, enabled: e.target.checked },
                    }))}
                    className="accent-blue-500"
                  />
                  <input
                    type="number" min="0" step="1"
                    value={local?.power_w ?? dev.power_w}
                    onChange={e => setLocalDevices(prev => ({
                      ...prev,
                      [key]: { power_w: parseFloat(e.target.value) || 0, enabled: prev[key]?.enabled ?? true },
                    }))}
                    className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-right text-slate-200 outline-none"
                  />
                  <span className="text-[9px] text-slate-500">W</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
        <div>
          <p className="text-[8px] text-slate-500 uppercase font-bold">Tổng công suất mô phỏng</p>
          <p className="text-xl font-black font-mono text-white">{totalPowerW.toFixed(0)} <span className="text-sm text-slate-500">W</span></p>
        </div>
        <div className="text-right">
          <p className="text-[8px] text-slate-500 uppercase font-bold">Chi phí/giờ</p>
          <p className="text-sm font-black text-amber-400">{hourlyCost.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} VNĐ</p>
        </div>
      </div>
    </div>
  );
};
