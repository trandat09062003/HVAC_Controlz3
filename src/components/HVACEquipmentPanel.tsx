import React from 'react';
import { motion } from 'motion/react';
import { Snowflake, Fan, Wind, AirVent, Power, ArrowRight, Flame } from 'lucide-react';
import { BuildingSimSnapshot, DRLPanel, HVACState } from '../types';
import { cn } from '../lib/utils';

interface HVACEquipmentPanelProps {
  sim?: BuildingSimSnapshot | null;
  drlPanel?: DRLPanel | null;
  control?: Pick<HVACState, 'power' | 'mode' | 'fanSpeed' | 'targetTemp'> | null;
}

interface EquipmentCardProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  on: boolean;
  mode?: string;
  value: string;
  detail?: string;
  colorOn: string;
  colorOff: string;
}

function EquipmentCard({ title, subtitle, icon: Icon, on, mode, value, detail, colorOn, colorOff }: EquipmentCardProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl border p-3 transition-all',
        on ? `${colorOn} shadow-lg` : `${colorOff} opacity-80`
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center border', on ? 'bg-white/10 border-white/20' : 'bg-slate-900 border-slate-700')}>
            <Icon className={cn('w-4 h-4', on ? 'text-white' : 'text-slate-500')} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-white">{title}</p>
            <p className="text-[8px] text-slate-400 font-semibold">{subtitle}</p>
          </div>
        </div>
        <span
          className={cn(
            'flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0',
            on ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' : 'bg-slate-800 text-slate-500 border-slate-700'
          )}
        >
          <Power className="w-2.5 h-2.5" />
          {on ? 'BẬT' : 'TẮT'}
        </span>
      </div>
      <p className="text-xl font-black font-mono mt-2 text-white">{value}</p>
      {mode && (
        <p className="text-[9px] font-bold uppercase mt-1 text-slate-300/90">
          Chế độ: <span className="text-white">{mode}</span>
        </p>
      )}
      {detail && <p className="text-[8px] text-slate-400 mt-1 leading-relaxed">{detail}</p>}
      {on && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400/60 rounded-b-xl"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      )}
    </div>
  );
}

const COMFORT_T_LOW = 22.0;
const COMFORT_T_HIGH = 24.5;

export function deriveHvacState(
  sim?: BuildingSimSnapshot | null,
  drlPanel?: DRLPanel | null,
  control?: Pick<HVACState, 'power' | 'mode' | 'fanSpeed' | 'targetTemp'> | null,
) {
  const physical = drlPanel?.physical ?? {};
  let fSa = physical.f_sa ?? 0;
  let dOa = physical.D_oa ?? 0;
  const tChws = physical.T_chws ?? 15;
  let pAir = physical.P_air ?? 0;
  let targetTemp = sim?.target_temp ?? physical.target_temp ?? 25;
  const zoneTemp = sim?.zone_temp ?? null;
  const hvacDemand = sim?.hvac_demand ?? (
    zoneTemp != null && zoneTemp < targetTemp - 0.3 ? 'heat' :
    zoneTemp != null && zoneTemp > targetTemp - 0.3 ? 'cool' : 'hold'
  );

  let chillerW = sim?.devices?.chiller?.power_w ?? 0;
  let fanW = sim?.devices?.supply_fan?.power_w ?? 0;
  const pumpW = sim?.devices?.pump?.power_w ?? 0;

  let fanOn = fSa > 0.15 || fanW > 30;
  let chillerOn = hvacDemand === 'cool' && chillerW > 10;
  let needHeat = hvacDemand === 'heat';
  let damperPct = sim?.airflow?.damper_pct ?? dOa * 100;
  let damperOpen = damperPct > 5;
  let purifierOn = pAir >= 0.5;
  let manualControl = Boolean(sim?.manual_control);
  let acMode = 'Chờ (Standby)';

  if (control) {
    if (!control.power) {
      fanOn = false;
      chillerOn = false;
      purifierOn = false;
      needHeat = false;
      fSa = 0;
      dOa = 0;
      damperOpen = false;
      damperPct = 0;
      fanW = 0;
      chillerW = 0;
      manualControl = true;
      acMode = 'Hệ thống tắt';
    } else if (control.mode !== 'auto') {
      manualControl = true;
      targetTemp = control.targetTemp;

      if (control.mode === 'heat') {
        chillerOn = false;
        chillerW = 0;
        needHeat = true;
        acMode = 'Làm nóng (Heat)';
      } else if (control.mode === 'off') {
        chillerOn = false;
        chillerW = 0;
        needHeat = false;
        acMode = 'Điều hòa tắt';
      } else if (control.mode === 'cool') {
        needHeat = false;
        if (zoneTemp != null && zoneTemp > targetTemp - 0.3) {
          chillerOn = true;
        }
        acMode = chillerOn
          ? (tChws < 8 ? 'Làm mát mạnh (Cool)' : 'Làm mát (Cool)')
          : 'Làm lạnh — chờ';
      }

      if (control.fanSpeed !== 'auto') {
        if (control.fanSpeed === 'off') {
          fanOn = false;
          fSa = 0;
          dOa = 0;
          damperOpen = false;
          damperPct = 0;
          fanW = 0;
        } else {
          const fanMap: Record<string, number> = { on: 0.4, low: 0.22, medium: 0.5, high: 0.8 };
          fSa = fanMap[control.fanSpeed] ?? fSa;
          fanOn = fSa > 0.15;
          if (control.fanSpeed === 'high') {
            dOa = Math.max(dOa, 0.45);
            damperPct = Math.max(damperPct, 45);
            damperOpen = true;
          }
        }
      }
    } else if (control.fanSpeed !== 'auto') {
      manualControl = true;
      if (control.fanSpeed === 'off') {
        fanOn = false;
        fSa = 0;
        dOa = 0;
        damperOpen = false;
        damperPct = 0;
        fanW = 0;
      } else {
        const fanMap: Record<string, number> = { on: 0.4, low: 0.22, medium: 0.5, high: 0.8 };
        fSa = fanMap[control.fanSpeed] ?? fSa;
        fanOn = fSa > 0.15;
        if (control.fanSpeed === 'high') {
          dOa = Math.max(dOa, 0.45);
          damperPct = Math.max(damperPct, 45);
          damperOpen = true;
        }
      }
    }
  }

  if (acMode === 'Chờ (Standby)') {
    if (needHeat) {
      acMode = 'Làm nóng (Heat)';
    } else if (chillerOn) {
      if (tChws < 8) acMode = 'Làm mát mạnh (Cool)';
      else if (tChws < 11) acMode = 'Làm mát (Cool)';
      else acMode = 'Tự động (Auto)';
    } else if (fanOn) {
      acMode = 'Chỉ quạt / thông gió';
    }
  }

  let fanMode = 'Tắt';
  if (fanOn) {
    if (fSa >= 0.7) fanMode = 'Cao (High)';
    else if (fSa >= 0.4) fanMode = 'Trung bình (Med)';
    else fanMode = 'Thấp (Low)';
  }

  return {
    fanOn,
    chillerOn,
    damperOpen,
    purifierOn,
    fSa,
    dOa,
    tChws,
    targetTemp,
    damperPct,
    chillerW,
    fanW,
    pumpW,
    acMode,
    fanMode,
    vSa: sim?.airflow?.V_sa ?? 0,
    vOa: sim?.airflow?.V_oa ?? 0,
    zoneTemp,
    needHeat,
    hvacDemand,
    comfortRange: `${COMFORT_T_LOW}–${COMFORT_T_HIGH}°C`,
    manualControl,
  };
}

export const HVACEquipmentPanel: React.FC<HVACEquipmentPanelProps> = ({ sim, drlPanel, control }) => {
  const hvac = deriveHvacState(sim, drlPanel, control);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
          {hvac.manualControl ? 'Thiết bị HVAC — Điều khiển thủ công' : 'Thiết bị HVAC — DDPG điều khiển'}
        </p>
        <div className="flex gap-2 text-[8px] font-bold">
          {hvac.manualControl && (
            <span className="px-2 py-0.5 rounded-full bg-amber-950 border border-amber-700 text-amber-400">
              Panel phải
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-sky-950 border border-sky-800 text-sky-400">
            Setpoint DDPG: {hvac.targetTemp}°C
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-400">
            Thoải mái: {hvac.comfortRange}
          </span>
        </div>
      </div>

      {/* Flow diagram */}
      <div className="flex flex-wrap items-center justify-center gap-1 py-2 px-2 rounded-xl bg-slate-950/50 border border-slate-800 text-[7px] font-bold uppercase text-slate-500">
        <span className="text-sky-400">Ngoài trời</span>
        <ArrowRight className="w-3 h-3 text-slate-600" />
        <span className={cn(hvac.damperOpen ? 'text-cyan-400' : 'text-slate-600')}>Van {hvac.damperPct.toFixed(0)}%</span>
        <ArrowRight className="w-3 h-3 text-slate-600" />
        <span className={cn(hvac.fanOn ? 'text-blue-400' : 'text-slate-600')}>Quạt {hvac.fanOn ? 'ON' : 'OFF'}</span>
        <ArrowRight className="w-3 h-3 text-slate-600" />
        <span className={cn(hvac.chillerOn ? 'text-indigo-400' : 'text-slate-600')}>Chiller {hvac.chillerOn ? 'ON' : 'OFF'}</span>
        <ArrowRight className="w-3 h-3 text-slate-600" />
        <span className="text-emerald-400">Phòng Zone A</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <EquipmentCard
          title="Điều hòa / Chiller"
          subtitle={
            hvac.acMode === 'Điều hòa tắt' ? 'Tắt — quạt & lọc vẫn chạy'
            : hvac.needHeat || hvac.acMode.includes('nóng') ? 'Chế độ làm nóng — chiller tắt'
            : 'Làm lạnh nước → gió mát'
          }
          icon={hvac.needHeat || hvac.acMode.includes('nóng') ? Flame : Snowflake}
          on={hvac.chillerOn}
          mode={hvac.acMode}
          value={hvac.chillerOn ? `${hvac.tChws.toFixed(1)}°C` : 'TẮT'}
          detail={hvac.chillerOn
            ? `Nước lạnh T_chws • ${hvac.chillerW.toFixed(0)} W + bơm ${hvac.pumpW.toFixed(0)} W`
            : `Mục tiêu ${hvac.targetTemp}°C • phòng ${hvac.zoneTemp?.toFixed(1) ?? '—'}°C`}
          colorOn="bg-indigo-600/25 border-indigo-500/40"
          colorOff="bg-slate-900/80 border-slate-800"
        />
        <EquipmentCard
          title="Quạt cấp gió"
          subtitle="Supply fan — đẩy gió vào phòng"
          icon={Fan}
          on={hvac.fanOn}
          mode={hvac.fanMode}
          value={`${(hvac.fSa * 100).toFixed(0)}%`}
          detail={`f_sa • ${hvac.vSa.toFixed(2)} m³/s • ${hvac.fanW.toFixed(0)} W`}
          colorOn="bg-blue-600/25 border-blue-500/40"
          colorOff="bg-slate-900/80 border-slate-800"
        />
        <EquipmentCard
          title="Van gió tươi"
          subtitle="Damper — hút không khí ngoài"
          icon={Wind}
          on={hvac.damperOpen}
          mode={hvac.damperPct >= 50 ? 'Mở rộng' : hvac.damperPct >= 20 ? 'Mở vừa' : 'Hé mở'}
          value={`${hvac.damperPct.toFixed(0)}%`}
          detail={`D_oa ${(hvac.dOa * 100).toFixed(0)}% • V_oa ${hvac.vOa.toFixed(2)} m³/s`}
          colorOn="bg-cyan-600/20 border-cyan-500/35"
          colorOff="bg-slate-900/80 border-slate-800"
        />
        <EquipmentCard
          title="Máy lọc không khí"
          subtitle="Purifier — lọc PM₂.₅"
          icon={AirVent}
          on={hvac.purifierOn}
          mode={hvac.purifierOn ? 'Đang lọc' : 'Tắt tiết kiệm điện'}
          value={hvac.purifierOn ? 'ON' : 'OFF'}
          detail="P_air từ DDPG action"
          colorOn="bg-teal-600/20 border-teal-500/35"
          colorOff="bg-slate-900/80 border-slate-800"
        />
      </div>

      {/* Damper visual bar */}
      <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
        <div className="flex justify-between text-[8px] font-bold uppercase text-slate-500 mb-2">
          <span>Mở van gió tươi (D_oa)</span>
          <span className="text-cyan-400">{hvac.damperPct.toFixed(0)}%</span>
        </div>
        <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-sky-400"
            animate={{ width: `${Math.min(100, hvac.damperPct)}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[7px] text-slate-600 font-mono">
          <span>0% đóng</span>
          <span>50%</span>
          <span>100% mở</span>
        </div>
      </div>

      {/* Fan speed visual */}
      <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
        <div className="flex justify-between text-[8px] font-bold uppercase text-slate-500 mb-2">
          <span>Tốc độ quạt cấp (f_sa)</span>
          <span className={cn(hvac.fanOn ? 'text-blue-400' : 'text-slate-600')}>
            {hvac.fanOn ? `${(hvac.fSa * 100).toFixed(0)}% — ${hvac.fanMode}` : 'TẮT'}
          </span>
        </div>
        <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', hvac.fanOn ? 'bg-gradient-to-r from-blue-700 to-blue-400' : 'bg-slate-700')}
            animate={{ width: `${Math.min(100, hvac.fSa * 100)}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
      </div>
    </div>
  );
};
