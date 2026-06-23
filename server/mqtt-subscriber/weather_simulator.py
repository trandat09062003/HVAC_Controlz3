"""Synthetic Hanoi weather for digital-twin runtime (Guo et al. 2025 profile)."""
from __future__ import annotations

import numpy as np


class WeatherGenerator:
    """Hot-humid Hanoi climate, months 5–10, 96 steps/day (15 min)."""

    T_MEAN = {5: 28.0, 6: 30.5, 7: 31.0, 8: 30.5, 9: 29.0, 10: 26.5}
    T_STD = 2.5

    def __init__(self, seed: int | None = None):
        if seed is not None:
            np.random.seed(seed)

    def generate_day(self, month: int):
        if month not in self.T_MEAN:
            month = 7
        t_base = self.T_MEAN[month] + self.T_STD * np.random.randn()
        hours = np.linspace(0, 24, 96, endpoint=False)

        t_oa = t_base + 4.0 * np.sin(2 * np.pi * (hours - 9) / 24)
        t_oa += np.random.normal(0, 0.6, 96)
        t_oa = np.clip(t_oa, 22, 42)

        omega_oa = 0.016 + 0.0015 * (t_oa - 28) / 5
        omega_oa += np.random.normal(0, 0.0012, 96)
        omega_oa = np.clip(omega_oa, 0.008, 0.024)

        q_sol = np.maximum(
            0.0,
            750.0 * np.sin(np.pi * (hours - 6) / 12) * ((hours >= 6) & (hours <= 18)).astype(float),
        )
        q_sol += np.random.normal(0, 30, 96)
        q_sol = np.clip(q_sol, 0, 900)

        pm25_base = np.clip(np.random.lognormal(2.9, 0.7), 5, 80)
        c_pm_oa = np.ones(96) * pm25_base
        c_pm_oa += np.random.normal(0, 2.0, 96)
        c_pm_oa = np.clip(c_pm_oa, 0, 80)

        return t_oa, omega_oa, q_sol, c_pm_oa

    @staticmethod
    def omega_to_rh(omega: float, t_c: float) -> float:
        p_sat = 0.6112 * np.exp(17.67 * t_c / (t_c + 243.5))
        p_v = omega * 101.325 / (0.622 + omega)
        return float(np.clip(100.0 * p_v / p_sat, 20, 95))
