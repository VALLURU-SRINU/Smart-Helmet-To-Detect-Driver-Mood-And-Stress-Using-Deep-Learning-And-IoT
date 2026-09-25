# Smart Helmet to Detect Driver Mood & Stress Using IoT 🛡️🏍️

An end-to-end Embedded Systems and Internet of Things (IoT) solution designed to enhance two-wheeler rider safety. The system actively monitors driver sobriety, helmet compliance, physiological stress/mood states, and real-time GPS location—enforcing an automatic ignition interlock to prevent drunk or unhelmeted driving.

---

## 📌 Key Capabilities

- **Optical Helmet Fastening Check (IR Sensor):** Detects whether the helmet is fastened on the rider's head. If removed, the vehicle ignition starter relay cuts out immediately.
- **Sobriety / Breathalyzer Analysis (MQ-3 Gas Sensor):** Measures driver breath alcohol concentration. If BAC exceeds the threshold (0.05% BAC / 380 ADC), the engine starter relay locks out and a hazard buzzer activates.
- **Driver Mood & Stress Detection (Pulse & GSR Biometrics):** Analyzes heart rate (BPM) and Galvanic Skin Response (GSR) to classify the driver's emotional and physical state (*Calm, Elevated, Acute Stress, Drowsy/Fatigued, Panic*).
- **GPS Live Geolocation (NEO-6M):** Transmits continuous latitude, longitude, vehicle speed, and satellite count over UART telemetry.
- **Ignition Interlock & Actuator Feedback:** Controls starter relay, active piezo buzzer, status indicator LEDs (Green/Red/Yellow), and an I2C 16x2 LCD display.
- **Python Telemetry Gateway & Web Dashboard:** Multi-threaded Flask backend with serial COM auto-detection, persistent SQLite logging, real-time Leaflet map tracking, and live telemetry graphs.

---

## 🗂️ Project Repository Structure

```text
smart-helmet-iot/
├── arduino/
│   └── smart_helmet_firmware.ino    # Complete microcontroller firmware (C++)
├── backend/
│   ├── app.py                       # Python Flask server & Serial telemetry gateway
│   └── smart_helmet.db              # SQLite database (auto-generated)
├── dashboard/
│   └── index.html                   # Standalone real-time safety monitoring web UI
├── requirements.txt                 # Python dependencies
└── README.md                        # Hardware wiring, pinout & setup documentation
```

---

## 🔌 Hardware Bill of Materials (BOM) & Pinout Table

### Components Required

| Component | Quantity | Purpose | Operating Voltage |
| :--- | :--- | :--- | :--- |
| **Arduino Uno / Nano / ESP32** | 1 | Microcontroller Core | 5V DC (USB or Vin) |
| **MQ-3 Alcohol Gas Sensor** | 1 | Intoxication / Sobriety Detection | 5V DC (~150mA heater) |
| **TCRT5000 / IR Obstacle Sensor** | 1 | Helmet Worn Verification | 3.3V - 5V DC |
| **Pulse Heart Rate Sensor** | 1 | Pulse Waveform / Driver BPM | 3.3V - 5V DC |
| **GSR Skin Conductance Sensor** | 1 | Driver Stress / Arousal Index | 3.3V - 5V DC |
| **NEO-6M GPS Module** | 1 | Real-time Location Coordinates | 3.3V - 5V DC (3.3V UART) |
| **1-Channel 5V Relay Module** | 1 | Vehicle Ignition Starter Cutoff | 5V DC (Active HIGH) |
| **Active Piezo Buzzer** | 1 | Audible Hazard / Alarm | 5V DC |
| **16x2 LCD with I2C Backpack** | 1 | Visual Heads-Up Status Display | 5V DC (SDA/SCL) |
| **LED Indicators** (Green, Red, Yellow) | 3 | Visual System State | 5V DC via 220Ω Resistors |

---

### Arduino Uno / Nano Pin Mapping

| Peripheral / Sensor Pin | Arduino Pin | Pin Mode | Logic / Description |
| :--- | :--- | :--- | :--- |
| **MQ-3 Analog Out (AO)** | `A0` | `INPUT` | Analog voltage proportional to alcohol vapor |
| **Heart Rate Sensor (Signal)** | `A1` | `INPUT` | Photoplethysmogram analog wave (BPM) |
| **GSR Stress Sensor (Signal)** | `A2` | `INPUT` | Galvanic skin resistance analog voltage |
| **Battery Voltage Divider (V_SENSE)** | `A3` | `INPUT` | 10kΩ / 10kΩ divider from 1S/2S Li-ion battery |
| **IR Helmet Sensor (DO)** | `D2` | `INPUT_PULLUP` | `LOW` = Helmet Worn; `HIGH` = Removed |
| **NEO-6M GPS Module (TX)** | `D4` | `INPUT` (RX) | SoftwareSerial RX (Arduino receives GPS NMEA) |
| **NEO-6M GPS Module (RX)** | `D3` | `OUTPUT` (TX) | SoftwareSerial TX (Use 1k/2k divider if 3.3V) |
| **Active Piezo Buzzer (+)** | `D7` | `OUTPUT` | Pulsed 2.4kHz warning tone when hazard trips |
| **Vehicle Ignition Relay (IN)** | `D8` | `OUTPUT` | `HIGH` = Starter Armed; `LOW` = Ignition Cut |
| **Green LED (Safe / Ignition ON)** | `D9` | `OUTPUT` | Active when helmet is worn and rider is sober |
| **Red LED (Danger / Locked)** | `D10` | `OUTPUT` | Active when alcohol or helmet violation occurs |
| **Yellow LED (Stress / Warning)** | `D11` | `OUTPUT` | Active when driver stress index $\ge$ 70% |
| **I2C LCD Display (SDA)** | `A4` | `I2C SDA` | Hardware I2C data line |
| **I2C LCD Display (SCL)** | `A5` | `I2C SCL` | Hardware I2C clock line |

---

## ⚡ Circuit Schematic & Wiring Notes

```text
               +-------------------------------------------------------+
               |                     ARDUINO UNO                       |
               |                                                       |
 [MQ-3 AO] --->| A0 (Analog Alcohol)                  D2 (IR Helmet)  |<--- [IR Sensor OUT]
 [Pulse S] --->| A1 (Pulse BPM)                 D3 (Software TX -> GPS)|---> [NEO-6M RX]
 [GSR S]   --->| A2 (Stress GSR)                 D4 (Software RX <- GPS)|<--- [NEO-6M TX]
 [Batt Div]--->| A3 (Battery Sense 10k/10k)      D7 (Piezo Buzzer)   |---> [Buzzer +]
 [LCD SCL] <-->| A5 (I2C SCL)                    D8 (Relay Interlock)  |---> [Relay IN]
               |                                   D9 (LED Green)      |---> [Green LED +]
               |                                   D10 (LED Red)       |---> [Red LED +]
               |                                   D11 (LED Yellow)    |---> [Yellow LED +]
               |   5V    GND                                           |
               +---|------|--------------------------------------------+
                   |      |
           +-------+      +-------+
           |                      |
      5V Rail (VCC)          Ground Rail (GND)
```

> **Important Power Supply Note:** The MQ-3 sensor internal heating coil consumes approximately 150mA. When testing with all peripherals (LCD backlight, GPS module, Relay coil, Buzzer, MQ-3), supply the Arduino with an external 9V/12V DC 1A power adapter via the barrel jack or powered USB hub to prevent 5V brownouts.

---

## 🧠 Core System Logic & Decision Matrix

1. **Helmet Verification:**
   The optical IR sensor is mounted inside the helmet liner or chin-strap retention loop. When properly positioned against the head, the receiver reads `LOW`. If the helmet is not worn (`HIGH`), the system:
   - Sets Relay `LOW` (disabling starter motor).
   - Activates Red LED & pulsating buzzer.
   - Prints `! WEAR HELMET !` on LCD.
2. **Sobriety Verification:**
   The MQ-3 sensor is positioned near the chin guard facing the rider's mouth. If breath alcohol elevates analog readings beyond the baseline threshold ($\approx 380$ ADC / $0.05\%$ BAC):
   - Sets Relay `LOW` (locking ignition).
   - LCD displays `ALCOHOL DETECTED / BAC: 0.08% LOCK`.
   - Sends critical violation packet with GPS coordinates.
3. **Driver Mood & Stress Classification:**
   Autonomic nervous system (ANS) arousal is computed from pulse rate and galvanic skin response:
   - **Calm / Focused:** Heart Rate 60–85 BPM, low skin conductance. Green status.
   - **Elevated Stress:** Heart Rate 85–100 BPM. Normal driving allowed.
   - **Acute Stress / Panic:** Heart Rate > 100 BPM or sudden conductance spike. Yellow LED activates; advisory prompt dispatched.
   - **Drowsy / Fatigued:** Heart Rate < 50 BPM with low activity. Advisory alert issued.

---

## 🚀 Firmware Setup & Flashing

### Step 1: Install Required Arduino Libraries
Open the **Arduino IDE**, navigate to **Sketch -> Include Library -> Manage Libraries...**, and install:
1. `LiquidCrystal_I2C` by Frank de Brabander
2. `TinyGPSPlus` by Mikal Hart

### Step 2: Upload Firmware
1. Connect your Arduino board via USB.
2. In Arduino IDE, select **Tools -> Board -> Arduino Uno** (or Nano).
3. Select your serial port under **Tools -> Port**.
4. Open `arduino/smart_helmet_firmware.ino` and click **Upload** (Ctrl + U).
5. Open Serial Monitor at **115200 baud** to verify initial calibration messages and JSON output.

---

## 🐍 Python Telemetry Backend Setup

The Python backend provides a serial data logger, REST API, and SQLite database. If no physical Arduino is connected, it automatically switches to simulation mode so you can test the entire pipeline immediately!

```bash
# 1. Clone repository
git clone https://github.com/your-username/smart-helmet-iot.git
cd smart-helmet-iot

# 2. Create virtual environment
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# 3. Install requirements
pip install -r requirements.txt

# 4. Start Flask Telemetry Server
python backend/app.py
```

Server endpoints will be active on `http://127.0.0.1:5000`:
- `GET /api/telemetry` — Live sensor packet and historical readings
- `POST /api/telemetry` — External Wi-Fi/ESP32 ingestion endpoint
- `GET /api/alerts` — Incident log with timestamps and coordinates
- `POST /api/control` — Send commands (`TEST_BUZZER`, `CALIBRATE_MQ3`, `OVERRIDE_RELAY_OFF`)
- `GET /api/status` — Hardware port connection diagnostics

---

## 💻 Web Dashboard Usage

Open `dashboard/index.html` in your web browser, or access `http://127.0.0.1:5000/` when running the backend. The dashboard features:
- Live gauges for Sobriety (BAC %), Helmet Proximity, and Starter Relay.
- Real-time physiological telemetry chart (Pulse BPM vs Stress Index).
- Interactive GPS Map powered by Leaflet and OpenStreetMap.
- Hardware bench testing controls to simulate helmet detachment, alcohol intoxication, and panic states.
- Web Audio API hazard beeper simulating the vehicle buzzer.

---

## 📄 License
This project is open-source under the [Apache 2.0 License](LICENSE).
