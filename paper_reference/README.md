# Paper Reference — DRL Training

Mã huấn luyện và mô phỏng DDPG theo Guo et al., *Applied Energy* 2025.

**Hướng dẫn đầy đủ:** [README.md](../README.md)

## Huấn luyện

Một script: **`train.py`** — khí hậu Hà Nội, 1 người, fine-tune từ `checkpoints_v2/`.

| Cách | File |
|------|------|
| **Colab GPU** | `train.ipynb` |
| Local CPU | `train.py` |

```bash
cd paper_reference
python train.py
```

| Biến môi trường | Mặc định | Ghi chú |
|----------------|----------|---------|
| `HANOI_EPISODES` | 150 | Paper gốc: 5000 |
| `HANOI_DAYS_PER_MONTH` | 5 | Paper gốc: 30 |

**Colab GPU** — mở `paper_reference/train.ipynb`, bật T4 GPU, chạy tất cả cell.

Hoặc chạy thủ công:

```python
!pip install -q tensorflow==2.16 numpy matplotlib
%cd Smart_HVAC_AIOT/paper_reference
import os
os.environ["HANOI_EPISODES"] = "5000"
os.environ["HANOI_DAYS_PER_MONTH"] = "30"
!python train.py
```

Output: `checkpoints_hanoi/` + tự export `actor_weights.npz` cho server.

```bash
# Export thủ công (nếu cần)
cd ..
set CHECKPOINT_DIR=paper_reference/checkpoints_hanoi
python server/mqtt-subscriber/load_model.py
```

## Cấu trúc

```
paper_reference/
├── checkpoints_v2/      Pretrain Seoul (bài báo gốc)
├── checkpoints_hanoi/   Model Hà Nội (deploy)
├── data/                weather_gen.py, hanoi_weather_gen.py
├── drl/                 DDPG agent
├── simulator/           Hybrid sim (5 models)
├── train.py             Huấn luyện DDPG (local)
├── train.ipynb          Huấn luyện trên Colab GPU
└── logs/                Output train (local)
```
