"""Digital twin — synthetic Hanoi weather, DDPG vs RBC (independent from live ESP32)."""
from __future__ import annotations

import os
import time
from datetime import datetime
from typing import Any

import numpy as np

from building_simulator import ACTION_LABELS, STATE_LABELS, building_sim
from weather_simulator import WeatherGenerator

STATE_MIN = np.array([0, 18, 0.006, 0, 390, 0, 15, 0.003, 400, 0], dtype=np.float32)
STATE_MAX = np.array([24, 42, 0.026, 900, 520, 80, 35, 0.022, 2000, 50], dtype=np.float32)
STEP_INTERVAL_S = 4.0
DT_H = 15.0 / 60.0


def _sim_to_action(a_sim: np.ndarray) -> np.ndarray:
    return np.clip(a_sim * 2.0 - 1.0, -1.0, 1.0)


def _action_to_physical(a_sim: np.ndarray, hour: float) -> dict[str, float]:
    if 6.0 <= hour < 20.0:
        t_chws = 5.0 + a_sim[0] * 10.0
        d_oa = 0.2 + a_sim[1] * 0.8
        f_sa = 0.1 + a_sim[2] * 0.9
    else:
        t_chws = 15.0
        d_oa = a_sim[1] * 0.3
        f_sa = 0.1
    p_air = 1.0 if a_sim[3] > 0.5 else 0.0
    return {
        "T_chws": float(round(t_chws, 2)),
        "D_oa": float(round(d_oa, 3)),
        "f_sa": float(round(f_sa, 3)),
        "P_air": float(p_air),
        "target_temp": float(round(22.0 + (t_chws - 5.0) / 2.0, 1)),
    }


def _sim_action(t_chws_c: float, d_oa: float, f_sa: float, p_air_on: bool) -> np.ndarray:
    """Map physical setpoints to normalized sim action [0,1]^4."""
    return np.array(
        [
            np.clip((t_chws_c - 5.0) / 10.0, 0.0, 1.0),
            np.clip((d_oa - 0.2) / 0.8, 0.0, 1.0),
            np.clip((f_sa - 0.1) / 0.9, 0.0, 1.0),
            1.0 if p_air_on else 0.0,
        ],
        dtype=np.float32,
    )


def _rbc_bms(
    hour: float,
    t_zone: float,
    t_oa: float,
    co2_zone: float,
    *,
    setpoint: float = 24.0,
    setback: float = 26.5,
    occ_start: float = 7.0,
    occ_end: float = 18.0,
) -> np.ndarray:
    """VN office BMS — thermostat theo nhiệt độ phòng, không cố định công suất cả ngày."""
    occupied = occ_start <= hour < occ_end

    if not occupied:
        if t_zone <= setback + 1.5:
            return _sim_action(14.0, 0.08, 0.08, co2_zone > 1000.0)
        return _sim_action(12.0, 0.10, 0.12, co2_zone > 1000.0)

    if t_oa < t_zone - 1.5 and t_zone <= setback + 1.5:
        return _sim_action(12.0, min(0.55, 0.30 + (t_zone - t_oa) * 0.04), 0.14, co2_zone > 950.0)

    # Giờ làm việc — chấp nhận 26–27°C như văn phòng VN thực tế, chỉ tăng tải khi >28°C
    comfort_hi = setpoint + 3.0
    warm_hi = setpoint + 5.5

    if t_zone <= comfort_hi:
        return _sim_action(12.0, 0.14, 0.10, co2_zone > 950.0)
    if t_zone <= comfort_hi + 1.5:
        return _sim_action(10.0, 0.18, 0.14, co2_zone > 900.0)
    if t_zone <= warm_hi:
        return _sim_action(8.0, 0.22, 0.18, co2_zone > 850.0)
    if t_zone <= warm_hi + 1.5:
        return _sim_action(7.0, 0.25, 0.22, True)
    return _sim_action(6.5, 0.28, 0.24, True)


def _rbc_action(
    hour: float,
    *,
    t_zone: float = 24.0,
    t_oa: float = 30.0,
    co2_zone: float = 620.0,
) -> np.ndarray:
    return _rbc_bms(hour, t_zone, t_oa, co2_zone, setpoint=24.0, setback=28.0)


def _evolve_zone(
    zone: dict[str, float],
    t_oa: float,
    q_sol: float,
    pm_oa: float,
    physical: dict[str, float],
) -> dict[str, float]:
    f_sa = physical["f_sa"]
    d_oa = physical["D_oa"]
    t_chws = physical["T_chws"]
    target = physical.get("target_temp", 24.0)
    vent = f_sa * d_oa

    need_cool = zone["T"] > target + 0.3
    need_heat = zone["T"] < target - 0.3

    cooling = 0.0
    if need_cool:
        cooling = f_sa * max(0.0, zone["T"] - (10.0 + (15.0 - t_chws) * 0.4)) * 0.35

    heat = max(0.0, t_oa - zone["T"]) * 0.08 + q_sol * 0.004 + 0.12
    if need_heat:
        heat += 0.10  # tải nhiệt người + thiết bị
        if t_oa > zone["T"]:
            heat += vent * (t_oa - zone["T"]) * 0.20  # thông gió thu nhiệt ngoài trời

    t_next = zone["T"] + (heat - cooling) * DT_H
    t_next = float(np.clip(t_next, 20.0, 38.0))
    rh_oa = WeatherGenerator.omega_to_rh(0.016, t_oa)
    rh_next = zone["RH"] + (rh_oa - zone["RH"]) * vent * 0.4 * DT_H
    rh_next = float(np.clip(rh_next, 35.0, 85.0))

    co2_gain = 80.0 * DT_H
    co2_vent = vent * 350.0 * DT_H
    co2_next = zone["CO2"] + co2_gain - co2_vent
    co2_next = float(np.clip(co2_next, 400.0, 1800.0))

    pm_next = zone["PM"] + (pm_oa - zone["PM"]) * vent * 0.25 * DT_H
    pm_next = float(np.clip(pm_next, 2.0, 80.0))

    return {"T": t_next, "RH": rh_next, "CO2": co2_next, "PM": pm_next}


class HanoiTwinEngine:
    def __init__(self) -> None:
        self.weather = WeatherGenerator(seed=42)
        self.month = datetime.now().month if 5 <= datetime.now().month <= 10 else 7
        self._load_weather_day()
        self.step = 0
        self.last_advance = 0.0
        self.ai_zone = {"T": 24.0, "RH": 52.0, "CO2": 620.0, "PM": 8.0}
        self.base_zone = {"T": 24.0, "RH": 52.0, "CO2": 620.0, "PM": 8.0}
        self.energy_ai = 0.0
        self.energy_base = 0.0
        self.history: list[dict[str, Any]] = []
        self.last_ai_snap: dict[str, Any] | None = None
        self.last_base_snap: dict[str, Any] | None = None
        self.last_drl_state: list[float] | None = None
        self.last_drl_action: list[float] | None = None
        self.last_drl_physical: dict[str, float] | None = None
        self.last_reward: float | None = None
        self.actor_weights = None
        self.paused = False
        self.manual_override: dict[str, Any] | None = None

    def _load_weather_day(self) -> None:
        t, om, qs, pm = self.weather.generate_day(self.month)
        self.t_oa = t
        self.omega_oa = om
        self.q_sol = qs
        self.pm_oa = pm

    def _opt_rbc_action(
        self,
        hour: float,
        t_zone: float,
        t_oa: float,
        co2_zone: float,
    ) -> np.ndarray:
        """Optimized Rule-Based Control (RBC) replacing DRL in twin simulation."""
        # 1. Determine policy
        if 8.0 <= hour < 22.0:
            policy = "working_hours"
        else:
            policy = "night_eco"

        # Free cooling check
        if t_oa < t_zone - 1.5:
            # target_temp = 28.0, op_mode = fan, fan = high (f_sa = 0.8), damper = 1.0, fresh air fan on
            return _sim_action(15.0, 1.0, 0.8, True)

        if policy == "working_hours":
            # target_temp = 24.5, op_mode = auto, fan = auto (f_sa = 0.5), damper = 0.5, fresh air if co2 > 700
            return _sim_action(10.0, 0.5, 0.5, co2_zone > 700.0)
        else:
            # target_temp = 26.5, op_mode = auto, fan = low (f_sa = 0.22), damper = 0.3, fresh air if co2 > 950
            return _sim_action(14.0, 0.3, 0.22, co2_zone > 950.0)

    def _weather_at(self, idx: int) -> tuple[float, float, float, float, float]:
        i = idx % 96
        hour = i * 0.25
        t_oa = float(self.t_oa[i])
        omega = float(self.omega_oa[i])
        q_sol = float(self.q_sol[i])
        pm_oa = float(self.pm_oa[i])
        return hour, t_oa, omega, q_sol, pm_oa

    def maybe_advance(self) -> None:
        if self.paused:
            return
        now = time.time()
        if now - self.last_advance < STEP_INTERVAL_S:
            return
        self._advance()
        self.last_advance = now

    def step_once(self) -> None:
        self._advance()
        self.last_advance = time.time()

    def set_paused(self, paused: bool) -> None:
        self.paused = paused

    def set_month(self, month: int) -> None:
        if month in WeatherGenerator.T_MEAN:
            self.month = month
            self._load_weather_day()
            self.reset()

    def set_manual_override(self, command: dict[str, Any]) -> None:
        """Apply dashboard manual control to the twin (same as ESP32 remote-control)."""
        if command.get("clientId") == "ai-zone-manager":
            return
        self.manual_override = {
            "until": time.time() + 900,
            "power": bool(command.get("power", True)),
            "temp": command.get("temp"),
            "operationMode": command.get("operationMode", "auto"),
            "fanPower": command.get("fanPower", "auto"),
        }
        if self.last_drl_physical:
            self._recompute_ai_snap(self._apply_override(dict(self.last_drl_physical)))

    def _active_override(self) -> dict[str, Any] | None:
        if not self.manual_override:
            return None
        if time.time() > float(self.manual_override.get("until", 0)):
            self.manual_override = None
            return None
        return self.manual_override

    def _apply_override(self, physical: dict[str, float]) -> dict[str, float]:
        ov = self._active_override()
        if not ov:
            return physical

        out = dict(physical)
        fan = ov.get("fanPower", "auto")
        mode = ov.get("operationMode", "auto")

        if not ov.get("power", True):
            out["f_sa"] = 0.0
            out["D_oa"] = 0.0
            out["P_air"] = 0.0
            out["operation_mode"] = "off"
            return out

        out["operation_mode"] = mode
        temp = ov.get("temp")

        if fan == "off":
            out["f_sa"] = 0.0
            out["D_oa"] = 0.0
        elif fan == "low":
            out["f_sa"] = 0.22
        elif fan == "medium":
            out["f_sa"] = 0.50
        elif fan in ("on", "high"):
            out["f_sa"] = 0.80
            out["D_oa"] = max(out.get("D_oa", 0.0), 0.45)

        if temp is not None and mode != "auto":
            t_target = float(temp)
            out["target_temp"] = t_target

        if mode == "off":
            out["T_chws"] = 15.0
        elif mode == "cool":
            out["T_chws"] = min(out.get("T_chws", 10.0), 8.0)
            if temp is not None:
                out["target_temp"] = float(temp)
        elif mode == "heat":
            out["T_chws"] = 15.0
            if temp is not None:
                out["target_temp"] = float(temp)
        elif temp is not None:
            out["T_chws"] = float(np.clip(5.0 + (float(temp) - 22.0) * 2.0, 5.0, 15.0))

        return out

    def _recompute_ai_snap(self, physical: dict[str, float]) -> None:
        if self.step <= 0:
            return
        ai = self.ai_zone
        hour, t_oa, _, _, _ = self._weather_at(self.step - 1)
        snap = building_sim.simulate_step(
            ai["T"], ai["RH"], ai["CO2"], ai["PM"], t_oa, physical, baseline=False, dt_h=DT_H
        )
        self.last_drl_physical = physical
        self.last_ai_snap = {
            **snap,
            "zone_temp": round(ai["T"], 2),
            "zone_humidity": round(ai["RH"], 1),
            "zone_co2": round(ai["CO2"], 0),
            "zone_pm": round(ai["PM"], 1),
            "manual_control": True,
        }

    def _advance(self) -> None:
        hour, t_oa, omega_oa, q_sol, pm_oa = self._weather_at(self.step)
        rh_oa = WeatherGenerator.omega_to_rh(omega_oa, t_oa)

        ai = self.ai_zone
        state = [
            hour, t_oa, omega_oa, q_sol, 450.0, pm_oa,
            ai["T"], building_sim.rh_to_omega(ai["RH"], ai["T"]), ai["CO2"], ai["PM"],
        ]
        self.last_drl_state = state

        a_sim = self._opt_rbc_action(hour, ai["T"], t_oa, ai["CO2"])
        ai_physical = self._apply_override(_action_to_physical(a_sim, hour))
        action_raw = a_sim * 2.0 - 1.0
        self.last_drl_action = [float(x) for x in action_raw]
        self.last_drl_physical = ai_physical

        base_a_sim = _rbc_action(
            hour,
            t_zone=self.base_zone["T"],
            t_oa=t_oa,
            co2_zone=self.base_zone["CO2"],
        )
        base_physical = _action_to_physical(base_a_sim, hour)

        ai_snap = building_sim.simulate_step(
            ai["T"], ai["RH"], ai["CO2"], ai["PM"], t_oa, ai_physical, baseline=False, dt_h=DT_H
        )
        base_snap = building_sim.simulate_step(
            self.base_zone["T"], self.base_zone["RH"], self.base_zone["CO2"], self.base_zone["PM"],
            t_oa, base_physical, baseline=False, dt_h=DT_H,
        )

        self.energy_ai += ai_snap["energy_step_kwh"]
        self.energy_base += base_snap["energy_step_kwh"]
        self.last_reward = ai_snap["reward"]

        self.ai_zone = _evolve_zone(ai, t_oa, q_sol, pm_oa, ai_physical)
        self.base_zone = _evolve_zone(self.base_zone, t_oa, q_sol, pm_oa, base_physical)

        self.last_ai_snap = {
            **ai_snap,
            "zone_temp": round(self.ai_zone["T"], 2),
            "zone_humidity": round(self.ai_zone["RH"], 1),
            "zone_co2": round(self.ai_zone["CO2"], 0),
            "zone_pm": round(self.ai_zone["PM"], 1),
        }
        self.last_base_snap = {
            **base_snap,
            "zone_temp": round(self.base_zone["T"], 2),
            "zone_humidity": round(self.base_zone["RH"], 1),
            "zone_co2": round(self.base_zone["CO2"], 0),
            "zone_pm": round(self.base_zone["PM"], 1),
        }

        self.history.append({
            "time": f"{int(hour):02d}:{int((hour % 1) * 60):02d}",
            "step": self.step,
            "outdoor_temp": round(t_oa, 1),
            "outdoor_humidity": round(rh_oa, 0),
            "solar": round(q_sol, 0),
            "energy_ai": round(self.energy_ai, 5),
            "energy_base": round(self.energy_base, 5),
            "power_ai": ai_snap["total_power_w"],
            "power_base": base_snap["total_power_w"],
            "zone_temp_ai": self.ai_zone["T"],
            "zone_temp_base": self.base_zone["T"],
        })
        if len(self.history) > 96:
            self.history = self.history[-96:]

        self.step += 1

    def reset(self) -> None:
        self.step = 0
        self.last_advance = 0.0
        self.ai_zone = {"T": 24.0, "RH": 52.0, "CO2": 620.0, "PM": 8.0}
        self.base_zone = {"T": 24.0, "RH": 52.0, "CO2": 620.0, "PM": 8.0}
        self.energy_ai = 0.0
        self.energy_base = 0.0
        self.history = []
        self._load_weather_day()
        for _ in range(3):
            self._advance()

    def get_drl_panel(self) -> dict[str, Any]:
        state = self.last_drl_state or [0.0] * 10
        action = self.last_drl_action or [0.0] * 4
        physical = self.last_drl_physical or {}
        state_min = STATE_MIN.tolist()
        state_max = STATE_MAX.tolist()
        return {
            "state": [
                {
                    "label": STATE_LABELS[i],
                    "value": round(state[i], 4),
                    "norm": round((state[i] - state_min[i]) / (state_max[i] - state_min[i] + 1e-8), 3),
                }
                for i in range(10)
            ],
            "action": [
                {
                    "label": ACTION_LABELS[i],
                    "raw": round(action[i], 4),
                    "normalized": round((action[i] + 1) / 2, 3),
                }
                for i in range(4)
            ],
            "physical": physical,
            "reward": self.last_reward,
            "model": "Luật Ngưỡng Tối Ưu (RBC Optimized)",
        }

    def _savings_summary(self) -> dict[str, Any]:
        cfg = building_sim.get_config()
        tariff = float(cfg.get("electricity_tariff_vnd", 2500))
        saved_kwh = max(0.0, self.energy_base - self.energy_ai)
        savings_pct = 0.0
        if self.energy_base > 1e-6:
            savings_pct = max(0.0, saved_kwh / self.energy_base * 100.0)

        power_ai = float((self.last_ai_snap or {}).get("total_power_w", 0))
        power_base = float((self.last_base_snap or {}).get("total_power_w", 0))
        power_delta = power_base - power_ai
        power_saved = max(0.0, power_delta)
        instant_pct = 0.0
        if power_base > 1e-6:
            instant_pct = power_delta / power_base * 100.0

        steps = max(1, self.step)
        steps_per_day = 96
        projected_daily_ai = self.energy_ai / steps * steps_per_day
        projected_daily_base = self.energy_base / steps * steps_per_day
        projected_daily_saved = max(0.0, projected_daily_base - projected_daily_ai)
        projected_monthly_ai = projected_daily_ai * 30.0
        projected_monthly_base = projected_daily_base * 30.0
        projected_monthly_saved = projected_daily_saved * 30.0

        ai_comfort = (self.last_ai_snap or {}).get("comfort", {})
        base_comfort = (self.last_base_snap or {}).get("comfort", {})

        return {
            "energy_saved_kwh": round(saved_kwh, 4),
            "savings_vnd": round(saved_kwh * tariff),
            "power_ai_w": round(power_ai, 1),
            "power_base_w": round(power_base, 1),
            "power_saved_w": round(power_saved, 1),
            "power_delta_w": round(power_delta, 1),
            "instant_savings_pct": round(instant_pct, 1),
            "projected_daily_kwh": round(projected_daily_saved, 3),
            "projected_monthly_kwh": round(projected_monthly_saved, 2),
            "projected_daily_ai_kwh": round(projected_daily_ai, 3),
            "projected_daily_base_kwh": round(projected_daily_base, 3),
            "projected_monthly_ai_kwh": round(projected_monthly_ai, 2),
            "projected_monthly_base_kwh": round(projected_monthly_base, 2),
            "projected_monthly_saved_kwh": round(projected_monthly_saved, 2),
            "projected_daily_vnd": round(projected_daily_saved * tariff),
            "projected_monthly_vnd": round(projected_monthly_saved * tariff),
            "tariff_vnd": tariff,
            "comfort_ok_ai": bool(
                ai_comfort.get("temp_ok")
                and ai_comfort.get("rh_ok")
                and ai_comfort.get("co2_ok")
                and ai_comfort.get("pm_ok")
            ),
            "comfort_ok_base": bool(
                base_comfort.get("temp_ok")
                and base_comfort.get("rh_ok")
                and base_comfort.get("co2_ok")
                and base_comfort.get("pm_ok")
            ),
            "savings_pct": round(savings_pct, 1),
        }

    def get_snapshot(self) -> dict[str, Any]:
        self.maybe_advance()
        hour, t_oa, _, q_sol, pm_oa = self._weather_at(self.step)
        savings = self._savings_summary()
        savings_pct = savings["savings_pct"]

        return {
            "mode": "synthetic",
            "label": "Mô phỏng thời tiết Hà Nội (dữ liệu ảo)",
            "month": self.month,
            "sim_step": self.step,
            "sim_hour": round(hour, 2),
            "weather": {
                "outdoor_temp": round(t_oa, 1),
                "outdoor_humidity": round(WeatherGenerator.omega_to_rh(float(self.omega_oa[self.step % 96]), t_oa), 0),
                "solar_wm2": round(q_sol, 0),
                "pm25_outdoor": round(pm_oa, 1),
            },
            "buildingSim": self.last_ai_snap,
            "baselineSim": self.last_base_snap,
            "drlPanel": self.get_drl_panel(),
            "energy_ai_kwh": round(self.energy_ai, 4),
            "energy_base_kwh": round(self.energy_base, 4),
            "savings_pct": round(savings_pct, 1),
            "savings_summary": savings,
            "history": self.history[-40:],
            "building": {
                "building_name": "Tòa nhà văn phòng — Zone A (Mô phỏng)",
                "floor": "Tầng 12",
                "zone_id": "Zone-A / Phòng làm việc",
                "occupancy": 1,
                "occupancy_label": "1 người (cố định)",
                "volume_m3": 273.0,
                "sensor_online": False,
            },
            "powerConfig": building_sim.get_config(),
            "paused": self.paused,
            "step_interval_s": STEP_INTERVAL_S,
            "manual_control": self._active_override() is not None,
        }


_SEASON_BENCH_CACHE: tuple[float, dict[str, Any]] | None = None
_SEASON_BENCH_CACHE_TTL = 600.0


def _invalidate_season_cache() -> None:
    global _SEASON_BENCH_CACHE
    _SEASON_BENCH_CACHE = None


def compute_season_benchmark() -> dict[str, Any]:
    """Run 1 simulated day (96×15min) per month T5–T10; scale ×30 for monthly totals."""
    global _SEASON_BENCH_CACHE
    now = time.time()
    if _SEASON_BENCH_CACHE and now - _SEASON_BENCH_CACHE[0] < _SEASON_BENCH_CACHE_TTL:
        return _SEASON_BENCH_CACHE[1]

    cfg = building_sim.get_config()
    tariff = float(cfg.get("electricity_tariff_vnd", 2500))
    months = sorted(WeatherGenerator.T_MEAN.keys())
    month_rows: list[dict[str, Any]] = []
    season_ai = 0.0
    season_base = 0.0

    for month in months:
        bench = HanoiTwinEngine()
        bench.month = month
        bench._load_weather_day()
        bench.step = 0
        bench.ai_zone = {"T": 24.0, "RH": 52.0, "CO2": 620.0, "PM": 8.0}
        bench.base_zone = {"T": 24.0, "RH": 52.0, "CO2": 620.0, "PM": 8.0}
        bench.energy_ai = 0.0
        bench.energy_base = 0.0
        bench.history = []
        bench.paused = False
        for _ in range(96):
            bench._advance()

        daily_ai = bench.energy_ai
        daily_base = bench.energy_base
        monthly_ai = daily_ai * 30.0
        monthly_base = daily_base * 30.0
        monthly_saved = max(0.0, monthly_base - monthly_ai)
        pct = (monthly_saved / monthly_base * 100.0) if monthly_base > 1e-9 else 0.0
        season_ai += monthly_ai
        season_base += monthly_base
        month_rows.append({
            "month": month,
            "t_mean_c": WeatherGenerator.T_MEAN[month],
            "daily_ai_kwh": round(daily_ai, 3),
            "daily_base_kwh": round(daily_base, 3),
            "monthly_ai_kwh": round(monthly_ai, 1),
            "monthly_base_kwh": round(monthly_base, 1),
            "monthly_saved_kwh": round(monthly_saved, 1),
            "savings_pct": round(pct, 1),
        })

    season_saved = max(0.0, season_base - season_ai)
    season_pct = (season_saved / season_base * 100.0) if season_base > 1e-9 else 0.0
    # Winter (T11–T4) not in weather model — annual ≈ hot season + 35% of hot-season HVAC load
    winter_factor = 0.35
    annual_ai = season_ai + season_ai * winter_factor
    annual_base = season_base + season_base * winter_factor
    annual_saved = max(0.0, annual_base - annual_ai)
    annual_pct = (annual_saved / annual_base * 100.0) if annual_base > 1e-9 else 0.0

    result = {
        "months": month_rows,
        "season_6m": {
            "ai_kwh": round(season_ai, 1),
            "base_kwh": round(season_base, 1),
            "saved_kwh": round(season_saved, 1),
            "savings_pct": round(season_pct, 1),
            "saved_vnd": round(season_saved * tariff),
        },
        "annual_estimate": {
            "ai_kwh": round(annual_ai, 1),
            "base_kwh": round(annual_base, 1),
            "saved_kwh": round(annual_saved, 1),
            "savings_pct": round(annual_pct, 1),
            "saved_vnd": round(annual_saved * tariff),
            "method": "6 tháng mùa nóng (T5–T10) + 35% tải mùa đông (T11–T4, ước lượng)",
        },
        "tariff_vnd": tariff,
        "benchmark_7d_reference": {
            "source": "scripts/replicate_and_compare.py — 7 ngày tháng 7",
            "drl_kwh_per_day": 17.9,
            "rbc_kwh_per_day": 31.8,
            "savings_pct": round((31.8 - 17.9) / 31.8 * 100, 1),
        },
    }
    _SEASON_BENCH_CACHE = (now, result)
    return result


twin_engine = HanoiTwinEngine()
# Warm-up a few steps so UI is not empty on first load
for _ in range(5):
    twin_engine._advance()
