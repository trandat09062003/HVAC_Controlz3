# Smart HVAC AIoT

Dự án giám sát và điều khiển HVAC cho phòng làm việc: node ESP32-S3 đọc cảm biến thật, server xử lý MQTT + DDPG, dashboard React xem telemetry và chạy digital twin mô phỏng thời tiết Hà Nội.

Tham chiếu thuật toán: Guo et al., *Applied Energy*, 2025 — [DOI:10.1016/j.apenergy.2024.124467](https://doi.org/10.1016/j.apenergy.2024.124467)

Repo: [github.com/trandat09062003/Smart_HVAC_AIOT](https://github.com/trandat09062003/Smart_HVAC_AIOT)

---

## Hệ thống gồm những gì

```
ESP32 (SCD30, PMS7003, LCD)
        │  MQTT sensor/indoor
        ▼
Mosquitto + mqtt-subscriber (Python)
        │  TimescaleDB, DDPG inference, REST API
        ▼
Dashboard React (Vite)
```

- **Tab Tổng quan** — dữ liệu cảm biến thật từ ESP32, biểu đồ lịch sử.
- **Tab Tòa nhà / AI / Điện năng** — digital twin (dữ liệu mô phỏng), so sánh DDPG với rule-based baseline.
- Panel điều khiển bên phải gửi lệnh xuống ESP32 và đồng bộ sang twin khi chỉnh thủ công.

Nếu không có file `actor_weights.npz`, server chạy rule-based (giờ làm việc, đêm ECO, standby).

---

## Phần cứng

| Thiết bị | Bus | GPIO |
|----------|-----|------|
| ESP32-S3-N16R8 | — | — |
| SCD30 | I²C (Wire1) | SDA=8, SCL=9 |
| LCD 1602 I²C | I²C (Wire) | SDA=10, SCL=11 |
| PMS5003 | UART | RX=16, TX=17 |
| WS2812 (LED onboard) | — | 48 |

Sơ đồ PCB: [`docs/hardware_design_guide.md`](docs/hardware_design_guide.md)

---

## Cấu trúc thư mục

```
esp32/HVAC_Sensor_Node/     Firmware Arduino + thư viện local (src/)
server/mqtt-subscriber/     MQTT, DB, API, DDPG, twin_engine
paper_reference/            Train DDPG, simulator, checkpoint
src/                        Frontend React
scripts/                    replicate_and_compare.py
docs/                       Tài liệu bổ sung
docker-compose.yml          Local :3000, MQTT :1883
docker-compose.alt.yml      VPS / chạy song song :3005, :1885
```

Chi tiết từng file: [`docs/PROJECT_SUMMARY.md`](docs/PROJECT_SUMMARY.md)

---

## Model DDPG (tóm tắt)

**State (10):** giờ, T ngoài trời, độ ẩm tuyệt đối ngoài/phòng, nhiệt mặt trời, CO₂, PM, ...

**Action (4):** nhiệt độ nước lạnh, van gió tươi, tốc độ quạt, máy lọc ON/OFF.

Actor: `256 → 256 → 4 (tanh)`. Reward phạt điện năng + vi phạm tiện nghi (nhiệt, ẩm, CO₂, PM khi có người).

Train local:

```bash
cd paper_reference
python train.py
```

Colab: mở `paper_reference/train.ipynb`.

Export weights cho server:

```bash
set CHECKPOINT_DIR=paper_reference/checkpoints
python server/mqtt-subscriber/load_model.py
```

Benchmark 7 ngày (tháng 7): DRL ~17.9 kWh/ngày, RBC ~31.8, Random ~38.7 — chạy lại bằng `python scripts/replicate_and_compare.py`.

---

## Chạy nhanh

### Server (Docker)

```bash
git clone https://github.com/trandat09062003/Smart_HVAC_AIOT.git
cd Smart_HVAC_AIOT
docker compose up -d --build
```

Dashboard: http://localhost:3000 — MQTT: port 1883.

Chạy song song project khác (tránh trùng cổng):

```bash
docker compose -p smart_hvac -f docker-compose.alt.yml up -d --build
# :3005 và :1885
```

### Firmware ESP32

Sửa đầu file `esp32/HVAC_Sensor_Node/HVAC_Sensor_Node.ino`:

```cpp
#define WIFI_SSID        "TenMangWiFi"
#define WIFI_PASSWORD    "MatKhauWiFi"
#define MQTT_SERVER      "192.168.1.100"
#define MQTT_PORT        1883    // hoặc 1885 nếu dùng docker-compose.alt.yml
#define MQTT_DEVICE_ID   "indoor-01"
```

Nạp bằng Arduino IDE, board ESP32-S3. Thư viện đã có trong `esp32/HVAC_Sensor_Node/src/`.

### Frontend dev

```bash
npm install
npm run dev
# http://localhost:5173
```

---

## MQTT

| Topic | Hướng | Nội dung chính |
|-------|-------|----------------|
| `sensor/indoor` | ESP → server | temp, humidity, co2, dust, device_id |
| `remote-control/indoor-01` | server → ESP | power, temp, operation_mode, fan_power, co2_max, humidity_max |

---

## Gặp lỗi thường gặp

- **Không load được DRL** — chạy `load_model.py`, rebuild container `mqtt-subscriber`.
- **Dashboard không có data** — kiểm tra IP/port MQTT, ESP32 có vào WiFi không.
- **Chỉ thấy rule, không DRL** — xem log subscriber, kiểm tra file `actor_weights.npz`.
- **Train chậm** — dùng Colab notebook trong `paper_reference/`.

DB mặc định trong docker: `iotdb` / `admin` / `admin123` — đổi mật khẩu trước khi đưa lên môi trường thật.

---

## Tài liệu thêm

- [`paper_reference/README.md`](paper_reference/README.md) — huấn luyện và simulator
- [`docs/hardware_design_guide.md`](docs/hardware_design_guide.md) — PCB
- [`docs/PROJECT_SUMMARY.md`](docs/PROJECT_SUMMARY.md) — map file trong repo

## License

MIT
