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


def _rbc_action(hour: float) -> np.ndarray:
    """Rule-based baseline from replicate_and_compare.py."""
    if 6.0 <= hour < 20.0:
        return np.array([0.2, 0.125, 0.444, 1.0], dtype=np.float32)
    return np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)


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
        try:
            self.actor_weights = np.load(os.path.join(os.path.dirname(__file__), "actor_weights.npz"))
        except OSError:
            pass

    def _load_weather_day(self) -> None:
        t, om, qs, pm = self.weather.generate_day(self.month)
        self.t_oa = t
        self.omega_oa = om
        self.q_sol = qs
        self.pm_oa = pm

    def _run_drl(self, state: list[float]) -> np.ndarray:
        if self.actor_weights is None:
            return _sim_to_action(_rbc_action(state[0]))
        norm = (np.array(state, dtype=np.float32) - STATE_MIN) / (STATE_MAX - STATE_MIN + 1e-8)
        w = self.actor_weights
        h1 = np.maximum(0, np.dot(norm, w["w_z1"]) + w["b_z1"])
        h2 = np.maximum(0, np.dot(h1, w["w_z2"]) + w["b_z2"])
        return np.tanh(np.dot(h2, w["w_action"]) + w["b_action"])

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
            ai["T"], ai["RH"], ai["CO2"], ai["PM"], t_oa, physical, baseline=False
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

        action_raw = self._run_drl(state)
        a_sim = (np.clip(action_raw, -1.0, 1.0) + 1.0) / 2.0
        ai_physical = self._apply_override(_action_to_physical(a_sim, hour))
        self.last_drl_action = [float(x) for x in action_raw]
        self.last_drl_physical = ai_physical

        base_a_sim = _rbc_action(hour)
        base_physical = _action_to_physical(base_a_sim, hour)

        ai_snap = building_sim.simulate_step(
            ai["T"], ai["RH"], ai["CO2"], ai["PM"], t_oa, ai_physical, baseline=False
        )
        base_snap = building_sim.simulate_step(
            self.base_zone["T"], self.base_zone["RH"], self.base_zone["CO2"], self.base_zone["PM"],
            t_oa, base_physical, baseline=False,
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
            "model": "DDPG Actor (256-256-4)" if self.actor_weights is not None else "RBC fallback",
        }

    def get_snapshot(self) -> dict[str, Any]:
        self.maybe_advance()
        hour, t_oa, _, q_sol, pm_oa = self._weather_at(self.step)
        savings_pct = 0.0
        if self.energy_base > 1e-6:
            savings_pct = max(0.0, (self.energy_base - self.energy_ai) / self.energy_base * 100.0)

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


twin_engine = HanoiTwinEngine()
# Warm-up a few steps so UI is not empty on first load
for _ in range(5):
    twin_engine._advance()
