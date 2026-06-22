"""
Building HVAC digital twin — runtime simulation aligned with Guo et al. (Applied Energy 2025).
Uses live sensor readings as zone state; fixed 1-person occupancy; paper Eq. 15–24 power model.
"""
from __future__ import annotations

import json
import math
import os
from copy import deepcopy
from datetime import datetime
from typing import Any

import numpy as np

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "power_config.json")

# Paper Table 3 — scaled for 1 occupant (N_OCC_MAX = 6 in original)
PAPER = {
    "N_OCC_MAX": 6,
    "Q_LIG_MAX": 465.0,
    "Q_EQP_MAX": 865.0,
    "Q_OCC_SEN": 120.0,
    "V_ZONE": 56 * 4.88,
    "COP": 3.0,
    "T_U": 24.5,
    "T_L": 22.0,
    "PHI_U": 0.60,
    "CO2_LIMIT": 1000,
    "PM_LIMIT": 10,
    "ALPHA": [1.0, 2.5, 5.0, 1.0, 1.0],
}

STATE_LABELS = [
    "hour", "T_outdoor", "ω_outdoor", "q_solar", "CO2_outdoor",
    "PM_outdoor", "T_zone", "ω_zone", "CO2_zone", "PM_zone",
]

ACTION_LABELS = ["T_chws", "D_oa", "f_sa", "P_air"]

DEFAULT_CONFIG: dict[str, Any] = {
    "occupancy_count": 1,
    "electricity_tariff_vnd": 2500,
    "cop": 3.0,
    "devices": {
        "sensor_node": {"name": "Node cảm biến ESP32", "power_w": 5, "enabled": True},
        "chiller": {"name": "Chiller / AHU", "power_w": 0, "enabled": True, "dynamic": True},
        "pump": {"name": "Bơm nước lạnh", "power_w": 0, "enabled": True, "dynamic": True, "ratio_of_chiller": 0.05},
        "supply_fan": {"name": "Quạt cấp gió", "power_w": 0, "enabled": True, "dynamic": True},
        "purifier": {"name": "Máy lọc không khí", "power_w": 42, "enabled": True},
        "lighting": {"name": "Chiếu sáng (1 người)", "power_w": 78, "enabled": True},
        "equipment": {"name": "Thiết bị văn phòng", "power_w": 144, "enabled": True},
        "occupant": {"name": "Tải nhiệt người (1 người)", "power_w": 120, "enabled": True},
    },
}


class BuildingSimulator:
    def __init__(self) -> None:
        self.config = self._load_config()
        self.last_drl_state: list[float] | None = None
        self.last_drl_action: list[float] | None = None
        self.last_drl_action_physical: dict[str, float] | None = None
        self.last_reward: float | None = None
        self.last_sim_snapshot: dict[str, Any] | None = None

    def _load_config(self) -> dict[str, Any]:
        if os.path.exists(CONFIG_PATH):
            try:
                with open(CONFIG_PATH, encoding="utf-8") as f:
                    data = json.load(f)
                merged = deepcopy(DEFAULT_CONFIG)
                merged.update({k: v for k, v in data.items() if k != "devices"})
                if "devices" in data:
                    for key, dev in data["devices"].items():
                        merged["devices"][key] = {**merged["devices"].get(key, {}), **dev}
                return merged
            except (json.JSONDecodeError, OSError):
                pass
        return deepcopy(DEFAULT_CONFIG)

    def save_config(self, updates: dict[str, Any]) -> dict[str, Any]:
        if "devices" in updates:
            for key, dev in updates["devices"].items():
                if key in self.config["devices"]:
                    self.config["devices"][key].update(dev)
                else:
                    self.config["devices"][key] = dev
        for key in ("occupancy_count", "electricity_tariff_vnd", "cop"):
            if key in updates:
                self.config[key] = updates[key]
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)
        return self.get_config()

    def get_config(self) -> dict[str, Any]:
        return deepcopy(self.config)

    @staticmethod
    def rh_to_omega(rh_pct: float, t_c: float) -> float:
        p_sat = 0.6112 * math.exp(17.67 * t_c / (t_c + 243.5))
        p_v = (rh_pct / 100.0) * p_sat
        return float(np.clip(0.622 * p_v / (101.325 - p_v), 0.001, 0.030))

    @staticmethod
    def solar_estimate(hour: float) -> float:
        if 6.0 <= hour <= 18.0:
            return max(0.0, 600.0 * math.sin(math.pi * (hour - 6.0) / 12.0))
        return 0.0

    def build_state_vector(
        self,
        temperature: float,
        humidity: float,
        co2: float,
        dust: float,
        outdoor_temp: float | None = None,
    ) -> list[float]:
        now = datetime.now()
        hour = now.hour + now.minute / 60.0
        t_oa = outdoor_temp if outdoor_temp is not None else temperature + 3.0
        omega_za = self.rh_to_omega(humidity, temperature)
        omega_oa = self.rh_to_omega(max(humidity - 5, 20), t_oa)
        state = [
            hour, t_oa, omega_oa, self.solar_estimate(hour),
            450.0, max(dust * 1.2, 8.0), temperature, omega_za, co2, dust,
        ]
        self.last_drl_state = state
        return state

    def map_action_physical(self, action: np.ndarray, hour: float) -> dict[str, float]:
        a = (np.clip(action, -1, 1) + 1) / 2
        if 6 <= hour < 20:
            t_chws = 5.0 + a[0] * 10.0
            d_oa = 0.2 + a[1] * 0.8
            f_sa = 0.1 + a[2] * 0.9
        else:
            t_chws = 15.0
            d_oa = a[1] * 0.3
            f_sa = 0.1
        p_air = 1.0 if a[3] > 0.5 else 0.0
        physical = {
            "T_chws": round(t_chws, 2),
            "D_oa": round(d_oa, 3),
            "f_sa": round(f_sa, 3),
            "P_air": p_air,
            "target_temp": round(22.0 + (t_chws - 5.0) / 2.0, 1),
        }
        self.last_drl_action = [float(x) for x in action]
        self.last_drl_action_physical = physical
        return physical

    def calc_fan_power_kw(self, f_sa: float) -> float:
        b = [0.01, -0.02, 0.5, 3.0]
        return max(0.0, b[0] + b[1] * f_sa + b[2] * f_sa ** 2 + b[3] * f_sa ** 3)

    def calc_airflow(self, f_sa: float, d_oa: float) -> tuple[float, float, float]:
        v_sa = max(0.0, 0.01 + 1.15 * f_sa)
        frac = max(0.0, -0.05 + 1.05 * d_oa)
        v_oa = max(0.0, frac * v_sa)
        return v_sa, v_oa, v_sa - v_oa

    def compute_reward(
        self,
        energy_kwh: float,
        t_zone: float,
        rh: float,
        co2: float,
        pm: float,
    ) -> float:
        a1, a2, a3, a4, a5 = PAPER["ALPHA"]
        f_t = max(0, t_zone - PAPER["T_U"]) + max(0, PAPER["T_L"] - t_zone)
        f_phi = max(0, rh / 100 - PAPER["PHI_U"])
        f_co2 = 1.0 if co2 >= PAPER["CO2_LIMIT"] else 0.0
        f_pm = 1.0 if pm >= PAPER["PM_LIMIT"] else 0.0
        occ = max(1, int(self.config.get("occupancy_count", 1)))
        # Always treat as occupied when simulating 1 person in room (user requirement)
        if occ >= 1:
            reward = -(a1 * energy_kwh + a2 * f_t + a3 * f_phi + a4 * f_co2 + a5 * f_pm)
        else:
            reward = -a1 * energy_kwh
        self.last_reward = float(reward)
        return self.last_reward

    def simulate_step(
        self,
        temperature: float,
        humidity: float,
        co2: float,
        dust: float,
        outdoor_temp: float | None,
        drl_physical: dict[str, float] | None,
        baseline: bool = False,
    ) -> dict[str, Any]:
        cfg = self.config
        occ = max(1, int(cfg.get("occupancy_count", 1)))
        scale = occ / PAPER["N_OCC_MAX"]

        if baseline or drl_physical is None:
            f_sa, d_oa, t_chws, purifier_on = 0.55, 0.5, 10.0, 0.0
        else:
            f_sa = drl_physical["f_sa"]
            d_oa = drl_physical["D_oa"]
            t_chws = drl_physical["T_chws"]
            purifier_on = drl_physical["P_air"]

        v_sa, v_oa, _ = self.calc_airflow(f_sa, d_oa)
        t_oa = outdoor_temp if outdoor_temp is not None else temperature + 3.0
        t_sa = 12.5
        q_hvac = max(0.0, 1005 * 1.2 * v_sa * max(0.0, temperature - t_sa))
        cop = float(cfg.get("cop", PAPER["COP"]))
        chiller_kw = q_hvac / cop / 1000
        pump_kw = chiller_kw * cfg["devices"].get("pump", {}).get("ratio_of_chiller", 0.05)
        fan_kw = self.calc_fan_power_kw(f_sa)

        devices = cfg["devices"]
        breakdown: dict[str, dict[str, Any]] = {}

        def add_device(key: str, power_w: float, note: str = "") -> None:
            dev = devices.get(key, {})
            if not dev.get("enabled", True):
                breakdown[key] = {"name": dev.get("name", key), "power_w": 0, "enabled": False, "note": note}
                return
            breakdown[key] = {
                "name": dev.get("name", key),
                "power_w": round(power_w, 1),
                "enabled": True,
                "note": note,
            }

        add_device("sensor_node", devices["sensor_node"]["power_w"])
        add_device("chiller", chiller_kw * 1000, f"T_chws={t_chws:.1f}°C, COP={cop}")
        add_device("pump", pump_kw * 1000)
        add_device("supply_fan", fan_kw * 1000, f"f_sa={f_sa:.0%}")
        add_device("purifier", devices["purifier"]["power_w"] if purifier_on else 0.0)
        add_device("lighting", devices["lighting"]["power_w"] * scale if occ else 0)
        add_device("equipment", devices["equipment"]["power_w"] * scale if occ else 0)
        add_device("occupant", devices["occupant"]["power_w"] * occ)

        total_w = sum(d["power_w"] for d in breakdown.values())
        dt_h = 5.0 / 3600.0
        energy_kwh = total_w * dt_h / 1000.0

        reward = self.compute_reward(energy_kwh, temperature, humidity, co2, dust)

        comfort = {
            "temp_ok": PAPER["T_L"] <= temperature <= PAPER["T_U"],
            "rh_ok": humidity <= PAPER["PHI_U"] * 100,
            "co2_ok": co2 < PAPER["CO2_LIMIT"],
            "pm_ok": dust < PAPER["PM_LIMIT"],
        }

        snapshot = {
            "occupancy": occ,
            "zone_volume_m3": PAPER["V_ZONE"],
            "airflow": {"V_sa": round(v_sa, 3), "V_oa": round(v_oa, 3), "damper_pct": round(d_oa * 100, 1)},
            "devices": breakdown,
            "total_power_w": round(total_w, 1),
            "energy_step_kwh": round(energy_kwh, 6),
            "reward": round(reward, 4),
            "comfort": comfort,
            "baseline_mode": baseline,
            "paper_ref": "Guo et al., Applied Energy 2025, DOI:10.1016/j.apenergy.2024.124467",
        }
        self.last_sim_snapshot = snapshot
        return snapshot

    def get_drl_panel(self) -> dict[str, Any]:
        state = self.last_drl_state or [0] * 10
        action = self.last_drl_action or [0] * 4
        physical = self.last_drl_action_physical or {}
        state_min = [0, 18, 0.006, 0, 390, 0, 22, 0.008, 400, 0]
        state_max = [24, 42, 0.026, 900, 520, 80, 36, 0.024, 2000, 50]
        return {
            "state": [{"label": STATE_LABELS[i], "value": round(state[i], 4), "norm": round((state[i] - state_min[i]) / (state_max[i] - state_min[i] + 1e-8), 3)} for i in range(10)],
            "action": [{"label": ACTION_LABELS[i], "raw": round(action[i], 4), "normalized": round((action[i] + 1) / 2, 3)} for i in range(4)],
            "physical": physical,
            "reward": self.last_reward,
            "model": "DDPG Actor (256-256-4)",
        }

    def get_building_status(self, is_online: bool) -> dict[str, Any]:
        occ = max(1, int(self.config.get("occupancy_count", 1)))
        return {
            "building_name": "Tòa nhà văn phòng — Zone A",
            "floor": "Tầng 12",
            "zone_id": "Zone-A / Phòng làm việc",
            "occupancy": occ,
            "occupancy_label": f"{occ} người (cố định)",
            "volume_m3": PAPER["V_ZONE"],
            "sensor_online": is_online,
        }


building_sim = BuildingSimulator()
