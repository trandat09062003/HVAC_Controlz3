# Paper Reference — DRL Training

Mã huấn luyện và mô phỏng DDPG theo Guo et al., *Applied Energy* 2025.

**Hướng dẫn đầy đủ:** [README.md](../README.md)

## Train khí hậu Hà Nội (khuyến nghị)

| Cách | File | Ghi chú |
|------|------|---------|
| **Colab GPU** | `train_hanoi.ipynb` | Runtime → T4 GPU, 5000 episode |
| Local | `train_hanoi.py` | Chậm trên CPU Windows |

Cấu hình: 1 người cố định trong phòng, fine-tune từ `checkpoints_v2/`.

```bash
# Sau train — export cho server
cd ..
set CHECKPOINT_DIR=paper_reference/checkpoints_hanoi
python server/mqtt-subscriber/load_model.py
```

## Train Seoul (bài báo gốc)

```bash
cd paper_reference
python train.py
python evaluate.py
```

Checkpoint: `checkpoints_v2/actor.weights.h5`

## Cấu trúc

```
paper_reference/
├── checkpoints_v2/      Pretrain Seoul
├── checkpoints_hanoi/   Fine-tune Hà Nội
├── data/                weather_gen.py, hanoi_weather_gen.py
├── drl/                 DDPG agent
├── simulator/           Hybrid sim (5 models)
├── train.py             Train Seoul
├── train_hanoi.py       Train Hà Nội
├── train_hanoi.ipynb    Colab notebook
└── evaluate.py
```
