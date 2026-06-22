# data/hanoi_weather_gen.py
"""Sinh dữ liệu thời tiết Hà Nội (mùa nóng ẩm) cho huấn luyện DDPG — cùng form bài báo Guo et al. 2025."""
import numpy as np


class HanoiWeatherGenerator:
    """
    Khí hậu Hà Nội: nóng ẩm mùa hè (tháng 4–10).
    Nhiệt độ ngoài trời cao hơn Seoul, độ ẩm tuyệt đối lớn hơn, PM2.5 đôi khi cao.
    """

    # Nhiệt độ trung bình tháng Hà Nội (°C) — nguồn tham khảo khí tượng VN
    T_MEAN = {4: 24.0, 5: 28.0, 6: 30.5, 7: 31.0, 8: 30.5, 9: 29.0, 10: 26.5}
    T_STD = 2.5

    def __init__(self, seed: int | None = None):
        if seed is not None:
            np.random.seed(seed)

    def generate_day(self, month: int):
        """Trả về (96,) arrays: T_oa, omega_oa, q_sol, C_PM_oa."""
        if month not in self.T_MEAN:
            month = 7
        T_base = self.T_MEAN[month] + self.T_STD * np.random.randn()
        hours = np.linspace(0, 24, 96, endpoint=False)

        # Biên độ ngày lớn hơn Seoul (nắng nóng)
        T_oa = T_base + 4.0 * np.sin(2 * np.pi * (hours - 9) / 24)
        T_oa += np.random.normal(0, 0.6, 96)
        T_oa = np.clip(T_oa, 22, 42)

        # Độ ẩm tuyệt đối cao (Hà Nội mùa hè)
        omega_oa = 0.016 + 0.0015 * (T_oa - 28) / 5
        omega_oa += np.random.normal(0, 0.0012, 96)
        omega_oa = np.clip(omega_oa, 0.008, 0.024)

        # Bức xạ mặt trời — đỉnh cao hơn
        q_sol = np.maximum(
            0.0,
            750.0 * np.sin(np.pi * (hours - 6) / 12) * ((hours >= 6) & (hours <= 18)).astype(float),
        )
        q_sol += np.random.normal(0, 30, 96)
        q_sol = np.clip(q_sol, 0, 900)

        # PM2.5 — đô thị Hà Nội, cao hơn Seoul một chút
        pm25_base = np.clip(np.random.lognormal(2.9, 0.7), 5, 80)
        C_PM_oa = np.ones(96) * pm25_base
        C_PM_oa += np.random.normal(0, 2.0, 96)
        C_PM_oa = np.clip(C_PM_oa, 0, 80)

        return T_oa, omega_oa, q_sol, C_PM_oa
