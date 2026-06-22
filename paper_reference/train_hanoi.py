"""
Huấn luyện DDPG cho khí hậu Hà Nội, phòng luôn có 1 người.
Theo Guo et al., Applied Energy 2025 (DOI: 10.1016/j.apenergy.2024.124467).

Chạy từ thư mục paper_reference:
  python train_hanoi.py

Biến môi trường:
  HANOI_EPISODES=5000   số episode (mặc định 800 cho train nhanh)
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from simulator.hybrid_sim import HybridSimulator
from drl.ddpg_agent import DDPGAgentV2
from data.hanoi_weather_gen import HanoiWeatherGenerator

# State bounds — mở rộng T_outdoor cho Hà Nội hè
STATE_MIN = np.array([0, 18, 0.006, 0, 390, 0, 22, 0.008, 400, 0], dtype=np.float32)
STATE_MAX = np.array([24, 42, 0.026, 900, 520, 80, 36, 0.024, 2000, 50], dtype=np.float32)

MONTHS = [5, 6, 7, 8, 9]  # mùa nóng Hà Nội
DAYS_PER_MONTH = int(os.getenv("HANOI_DAYS_PER_MONTH", "5"))
N_EPISODES = int(os.getenv("HANOI_EPISODES", "150"))
PRETRAIN_DIR = "checkpoints_v2"  # fine-tune từ model Seoul có sẵn
CHECKPOINT_DIR = "checkpoints_hanoi"


def norm(s):
    return (np.array(s, dtype=np.float32) - STATE_MIN) / (STATE_MAX - STATE_MIN + 1e-8)


def ddpg2sim(a):
    return (np.clip(a, -1, 1) + 1) / 2


def run_episode(sim, agent, weather, train=True):
    total_r, steps = 0.0, 0
    for month in MONTHS:
        for _ in range(DAYS_PER_MONTH):
            T_d, om_d, qs_d, pm_d = weather.generate_day(month)
            # Khởi tạo phòng: 28°C, RH cao, CO2 vừa (1 người)
            state = np.array(
                [0, T_d[0], om_d[0], qs_d[0], 450, pm_d[0], 28.0, 0.014, 650, pm_d[0] * 0.6],
                dtype=np.float32,
            )
            for step in range(96):
                state[0] = step * 0.25
                state[1] = T_d[step]
                state[2] = om_d[step]
                state[3] = qs_d[step]
                state[5] = pm_d[step]

                sn = norm(state)
                a_ddpg = agent.select_action(sn, add_noise=train)
                a_sim = ddpg2sim(a_ddpg)

                next_s, reward, _ = sim.step(state.tolist(), a_sim)
                next_s = np.array(next_s, dtype=np.float32)

                if train:
                    agent.store(sn, a_ddpg, reward, norm(next_s))
                    agent.train_step()

                state = next_s
                total_r += reward
                steps += 1

    return total_r / steps


def main():
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    os.makedirs("logs", exist_ok=True)

    sim = HybridSimulator(fixed_occupancy=1)
    agent = DDPGAgentV2()
    hanoi_ckpt = os.path.join(CHECKPOINT_DIR, "actor.weights.h5")
    seoul_ckpt = os.path.join(PRETRAIN_DIR, "actor.weights.h5")
    if os.path.exists(hanoi_ckpt):
        agent.load(CHECKPOINT_DIR)
        print(f"Resume training from {CHECKPOINT_DIR}")
    elif os.path.exists(seoul_ckpt):
        agent.load(PRETRAIN_DIR)
        print(f"Fine-tuning from {PRETRAIN_DIR} (Seoul -> Hanoi)")
    else:
        print("Training from scratch (no checkpoint found)")
    weather = HanoiWeatherGenerator(seed=42)

    rewards = []
    print(f"Hanoi DDPG | {N_EPISODES} episodes | 1 occupant | {DAYS_PER_MONTH} days/month", flush=True)
    print(f"{'Episode':>8} | {'Avg R/step':>11} | {'Buffer':>10} | {'Status':>12}", flush=True)
    print("-" * 55, flush=True)

    for ep in range(1, N_EPISODES + 1):
        agent.noise.reset()
        avg_r = run_episode(sim, agent, weather, train=True)
        rewards.append(avg_r)

        buf = len(agent.replay_buffer)
        status = "warming up" if buf < 10_000 else "training"

        if ep == 1 or ep % 5 == 0:
            agent.save(CHECKPOINT_DIR)
            print(f"{ep:>8} | {avg_r:>11.4f} | {buf:>10,} | {status:>12}", flush=True)

    agent.save(CHECKPOINT_DIR)

    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(rewards, color="#10b981", label="Hanoi 1-person")
    ax.set_xlabel("Episode")
    ax.set_ylabel("Avg Reward / step")
    ax.set_title("DDPG Training — Hanoi Climate, 1 Occupant")
    ax.legend()
    ax.grid(alpha=0.4)
    plt.tight_layout()
    plt.savefig("logs/training_curve_hanoi.png", dpi=150)
    print(f"\nDone -> {CHECKPOINT_DIR}/ | logs/training_curve_hanoi.png")

    # Auto-export cho server
    try:
        import sys
        export_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "server", "mqtt-subscriber"))
        sys.path.insert(0, export_dir)
        os.environ["CHECKPOINT_DIR"] = os.path.abspath(CHECKPOINT_DIR)
        from load_model import export_actor_npz
        out = os.path.join(export_dir, "actor_weights.npz")
        export_actor_npz(os.environ["CHECKPOINT_DIR"], out)
        print(f"Exported -> {out}")
    except Exception as ex:
        print(f"Export skipped: {ex}")


if __name__ == "__main__":
    main()
