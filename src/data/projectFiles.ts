export interface ProjectFile {
  path: string;
  filename: string;
  language: string;
  description: string;
  category: 'Firmware' | 'Backend' | 'Frontend' | 'Config' | 'Documentation';
  content: string;
}

export const PROJECT_FILES: ProjectFile[] = [
  {
    path: 'arduino/smart_helmet_firmware.ino',
    filename: 'smart_helmet_firmware.ino',
    language: 'cpp',
    category: 'Firmware',
    description: 'Arduino C++ firmware handling MQ-3, IR sensor, GPS, pulse/GSR, buzzer, relay, LCD, and JSON telemetry.',
    content: `/**
 * ==============================================================================
 * Project: Smart Helmet to Detect Driver Mood & Stress Using IoT
 * Target Hardware: Arduino Uno / Nano / Mega / ESP32
 *
 * Sensors Integrated:
 *  - MQ-3 Alcohol Gas Sensor (Analog Pin A0)
 *  - IR Proximity Sensor (Digital Pin 2 - Helmet Worn Detection)
 *  - Heart Rate / Pulse Sensor (Analog Pin A1 - Driver Mood & Stress)
 *  - Galvanic Skin Response (GSR) / Temp Sensor (Analog Pin A2 - Stress Index)
 *  - NEO-6M GPS Module (SoftwareSerial RX: Pin 4, TX: Pin 3)
 *
 * Actuators & Indicators:
 *  - Vehicle Relay Switch (Digital Pin 8 - Ignition Interlock System)
 *  - Active Piezo Buzzer (Digital Pin 7 - Audible Hazard Alert)
 *  - Status LEDs:
 *      * Green LED  (Digital Pin 9  - System Safe / Ignition Active)
 *      * Red LED    (Digital Pin 10 - Danger / Alcohol or Helmet Violation)
 *      * Yellow LED (Digital Pin 11 - Warning / Elevated Driver Stress)
 *  - 16x2 I2C LiquidCrystal Display (SDA: A4, SCL: A5, Address: 0x27)
 * ==============================================================================
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SoftwareSerial.h>
#include <TinyGPS++.h>

// PIN CONFIGURATION
#define PIN_MQ3_ALCOHOL      A0   // Analog input from MQ-3 Alcohol sensor
#define PIN_HEART_RATE       A1   // Analog input from Pulse / Heart Rate sensor
#define PIN_GSR_STRESS       A2   // Analog input from Galvanic Skin Response sensor
#define PIN_BATTERY_SENSE    A3   // Analog input from 10k/10k Battery Voltage Divider
#define PIN_IR_HELMET        2    // Digital input from Optical IR Sensor (LOW = Worn)
#define PIN_GPS_RX           4    // Arduino RX <- NEO-6M TX
#define PIN_GPS_TX           3    // Arduino TX -> NEO-6M RX
#define PIN_BUZZER           7    // Digital output to Piezo Buzzer
#define PIN_RELAY_IGNITION   8    // Digital output to Relay (HIGH = Ignition Enabled)
#define PIN_LED_GREEN        9    // Green LED: System Normal / Engine ON
#define PIN_LED_RED          10   // Red LED: Hazard / Ignition Locked
#define PIN_LED_YELLOW       11   // Yellow LED: High Stress / Alert Warning

// THRESHOLDS & CONSTANTS
const int ALCOHOL_RAW_THRESHOLD = 380;       // Raw analog threshold for intoxication
const float ALCOHOL_BAC_LIMIT   = 0.05;      // Blood Alcohol Concentration safety limit (% BAC)
const int STRESS_PULSE_HIGH_BPM = 100;       // Tachycardia / Acute stress threshold (BPM)
const int STRESS_PULSE_LOW_BPM  = 50;        // Drowsiness threshold (BPM)
const int GSR_STRESS_THRESHOLD  = 520;       // Skin conductance threshold
const unsigned long TELEMETRY_INTERVAL_MS = 1000;

// Battery voltage divider: R1=10k, R2=10k (Divider ratio = (10k+10k)/10k = 2.0)
const float BATTERY_DIVIDER_RATIO = 2.0;
const float VREF = 5.0; // Arduino 5V reference voltage
const float BATTERY_LOW_CUTOFF_V = 3.45; // 1S Li-ion empty/warning threshold

LiquidCrystal_I2C lcd(0x27, 16, 2);
SoftwareSerial gpsSerial(PIN_GPS_RX, PIN_GPS_TX);
TinyGPSPlus gps;

struct HelmetTelemetry {
  bool helmetWorn;
  int alcoholRaw;
  float alcoholBAC;
  bool alcoholDetected;
  int heartRateBPM;
  int gsrRaw;
  int stressIndex;       // 0 - 100 scale
  char stressLevel[16];  // "CALM", "NORMAL", "STRESSED", "DROWSY", "PANIC"
  int batteryRawAdc;     // Raw ADC on pin A3 (0-1023)
  float batteryVoltage;  // Calculated battery voltage (e.g. 3.3V - 4.2V)
  int batteryPercent;    // State of Charge % (0 - 100)
  bool batteryLow;       // True if below safety threshold
  bool ignitionAllowed;
  bool buzzerActive;
  bool gpsValid;
  double latitude;
  double longitude;
  float speedKmh;
  uint8_t satellites;
  char statusCode[24];
};

HelmetTelemetry currentTelemetry;
unsigned long lastTelemetryTime = 0;
unsigned long lastSampleTime = 0;
unsigned long lastLcdUpdateTime = 0;
bool alarmToneState = false;
int alcoholBaseline = 120;

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600);

  pinMode(PIN_IR_HELMET, INPUT_PULLUP);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_RELAY_IGNITION, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);

  // Initial safe state
  digitalWrite(PIN_RELAY_IGNITION, LOW);
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_LED_YELLOW, LOW);

  Wire.begin();
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SMART HELMET IoT");
  lcd.setCursor(0, 1);
  lcd.print("System Booting...");

  delay(1200);
  int baselineSum = 0;
  for (int i = 0; i < 10; i++) {
    baselineSum += analogRead(PIN_MQ3_ALCOHOL);
    delay(50);
  }
  alcoholBaseline = baselineSum / 10;

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Sensors Ready");
  lcd.setCursor(0, 1);
  lcd.print("Safe to Ride");
  delay(1000);
  lcd.clear();
}

void loop() {
  unsigned long now = millis();

  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  if (now - lastSampleTime >= 250) {
    lastSampleTime = now;
    readSensors();
    evaluateSafetyLogic();
    controlActuators();
  }

  if (now - lastLcdUpdateTime >= 500) {
    lastLcdUpdateTime = now;
    updateDisplay();
  }

  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;
    transmitSerialTelemetry();
  }

  processIncomingSerialCommands();
}

void readSensors() {
  int irState = digitalRead(PIN_IR_HELMET);
  currentTelemetry.helmetWorn = (irState == LOW);

  int rawAlcohol = analogRead(PIN_MQ3_ALCOHOL);
  currentTelemetry.alcoholRaw = rawAlcohol;
  currentTelemetry.alcoholBAC = calculateBAC(rawAlcohol);
  currentTelemetry.alcoholDetected = (rawAlcohol > ALCOHOL_RAW_THRESHOLD) || 
                                     (currentTelemetry.alcoholBAC >= ALCOHOL_BAC_LIMIT);

  int rawPulse = analogRead(PIN_HEART_RATE);
  int computedBpm = map(rawPulse, 0, 1023, 45, 140);
  if (computedBpm < 40) computedBpm = 0;
  currentTelemetry.heartRateBPM = computedBpm;

  int rawGsr = analogRead(PIN_GSR_STRESS);
  currentTelemetry.gsrRaw = rawGsr;

  calculateMoodAndStress(computedBpm, rawGsr);

  // Read Battery Voltage Divider on Pin A3
  int rawBatAdc = analogRead(PIN_BATTERY_SENSE);
  currentTelemetry.batteryRawAdc = rawBatAdc;
  float pinVolts = (rawBatAdc / 1023.0) * VREF;
  currentTelemetry.batteryVoltage = pinVolts * BATTERY_DIVIDER_RATIO;
  int socPercent = (int)(((currentTelemetry.batteryVoltage - 3.30) / (4.20 - 3.30)) * 100.0);
  if (socPercent < 0) socPercent = 0;
  if (socPercent > 100) socPercent = 100;
  currentTelemetry.batteryPercent = socPercent;
  currentTelemetry.batteryLow = (currentTelemetry.batteryVoltage < BATTERY_LOW_CUTOFF_V);

  if (gps.location.isValid()) {
    currentTelemetry.gpsValid = true;
    currentTelemetry.latitude = gps.location.lat();
    currentTelemetry.longitude = gps.location.lng();
    currentTelemetry.speedKmh = gps.speed.kmph();
    currentTelemetry.satellites = gps.satellites.value();
  } else {
    currentTelemetry.gpsValid = false;
    currentTelemetry.latitude = 17.385044;
    currentTelemetry.longitude = 78.486671;
    currentTelemetry.speedKmh = 0.0;
    currentTelemetry.satellites = 0;
  }
}

float calculateBAC(int rawAdc) {
  if (rawAdc <= alcoholBaseline) return 0.00;
  float delta = (float)(rawAdc - alcoholBaseline);
  float bac = (delta / 1023.0) * 0.20;
  return (bac < 0.0) ? 0.0 : bac;
}

void calculateMoodAndStress(int bpm, int gsr) {
  int stressScore = 0;
  if (bpm <= 0) {
    stressScore = 10;
    strcpy(currentTelemetry.stressLevel, "UNKNOWN");
  } else if (bpm > 115 || gsr > GSR_STRESS_THRESHOLD + 100) {
    stressScore = 92;
    strcpy(currentTelemetry.stressLevel, "PANIC/CRITICAL");
  } else if (bpm > STRESS_PULSE_HIGH_BPM || gsr > GSR_STRESS_THRESHOLD) {
    stressScore = 74;
    strcpy(currentTelemetry.stressLevel, "ACUTE_STRESS");
  } else if (bpm < STRESS_PULSE_LOW_BPM) {
    stressScore = 65;
    strcpy(currentTelemetry.stressLevel, "DROWSY/FATIGUED");
  } else if (bpm >= 85 && bpm <= 100) {
    stressScore = 48;
    strcpy(currentTelemetry.stressLevel, "ELEVATED");
  } else {
    stressScore = 22;
    strcpy(currentTelemetry.stressLevel, "CALM_FOCUSED");
  }
  currentTelemetry.stressIndex = stressScore;
}

void evaluateSafetyLogic() {
  if (!currentTelemetry.helmetWorn) {
    currentTelemetry.ignitionAllowed = false;
    currentTelemetry.buzzerActive = true;
    strcpy(currentTelemetry.statusCode, "VIOLATION_NO_HELMET");
    return;
  }
  if (currentTelemetry.alcoholDetected) {
    currentTelemetry.ignitionAllowed = false;
    currentTelemetry.buzzerActive = true;
    strcpy(currentTelemetry.statusCode, "VIOLATION_ALCOHOL");
    return;
  }
  if (currentTelemetry.stressIndex >= 90) {
    currentTelemetry.ignitionAllowed = true;
    currentTelemetry.buzzerActive = false;
    strcpy(currentTelemetry.statusCode, "WARN_HIGH_STRESS");
    return;
  }
  currentTelemetry.ignitionAllowed = true;
  currentTelemetry.buzzerActive = false;
  strcpy(currentTelemetry.statusCode, "SAFE_RUNNING");
}

void controlActuators() {
  if (currentTelemetry.ignitionAllowed) {
    digitalWrite(PIN_RELAY_IGNITION, HIGH);
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_RED, LOW);
  } else {
    digitalWrite(PIN_RELAY_IGNITION, LOW);
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, HIGH);
  }

  if (currentTelemetry.stressIndex >= 70) {
    digitalWrite(PIN_LED_YELLOW, HIGH);
  } else {
    digitalWrite(PIN_LED_YELLOW, LOW);
  }

  if (currentTelemetry.buzzerActive) {
    alarmToneState = !alarmToneState;
    if (alarmToneState) tone(PIN_BUZZER, 2400);
    else noTone(PIN_BUZZER);
  } else {
    noTone(PIN_BUZZER);
  }
}

void updateDisplay() {
  lcd.setCursor(0, 0);
  if (!currentTelemetry.helmetWorn) {
    lcd.print("! WEAR HELMET ! ");
    lcd.setCursor(0, 1);
    lcd.print("ENGINE LOCKED   ");
  } else if (currentTelemetry.alcoholDetected) {
    lcd.print("ALCOHOL DETECTED");
    lcd.setCursor(0, 1);
    lcd.print("BAC:");
    lcd.print(currentTelemetry.alcoholBAC, 2);
    lcd.print("% LOCK  ");
  } else {
    lcd.print("IGN:ON ");
    lcd.print(currentTelemetry.stressLevel);
    lcd.setCursor(0, 1);
    lcd.print("HR:");
    lcd.print(currentTelemetry.heartRateBPM);
    lcd.print("bpm ST:");
    lcd.print(currentTelemetry.stressIndex);
    lcd.print("%   ");
  }
}

void transmitSerialTelemetry() {
  Serial.print(F("{\\"device_id\\":\\"HELMET_01\\""));
  Serial.print(F(",\\"timestamp_ms\\":"));
  Serial.print(millis());
  Serial.print(F(",\\"helmet_worn\\":"));
  Serial.print(currentTelemetry.helmetWorn ? F("true") : F("false"));
  Serial.print(F(",\\"alcohol_raw\\":"));
  Serial.print(currentTelemetry.alcoholRaw);
  Serial.print(F(",\\"alcohol_bac\\":"));
  Serial.print(currentTelemetry.alcoholBAC, 3);
  Serial.print(F(",\\"alcohol_alert\\":"));
  Serial.print(currentTelemetry.alcoholDetected ? F("true") : F("false"));
  Serial.print(F(",\\"heart_rate_bpm\\":"));
  Serial.print(currentTelemetry.heartRateBPM);
  Serial.print(F(",\\"gsr_raw\\":"));
  Serial.print(currentTelemetry.gsrRaw);
  Serial.print(F(",\\"stress_index\\":"));
  Serial.print(currentTelemetry.stressIndex);
  Serial.print(F(",\\"stress_level\\":\\""));
  Serial.print(currentTelemetry.stressLevel);
  Serial.print(F("\\",\\"ignition_state\\":"));
  Serial.print(currentTelemetry.ignitionAllowed ? F("true") : F("false"));
  Serial.print(F(",\\"buzzer_state\\":"));
  Serial.print(currentTelemetry.buzzerActive ? F("true") : F("false"));
  Serial.print(F(",\\"battery\\":{"));
  Serial.print(F("\\"raw_adc\\":"));
  Serial.print(currentTelemetry.batteryRawAdc);
  Serial.print(F(",\\"voltage\\":"));
  Serial.print(currentTelemetry.batteryVoltage, 2);
  Serial.print(F(",\\"percent\\":"));
  Serial.print(currentTelemetry.batteryPercent);
  Serial.print(F(",\\"low\\":"));
  Serial.print(currentTelemetry.batteryLow ? F("true") : F("false"));
  Serial.print(F("}"));
  Serial.print(F(",\\"gps\\":{"));
  Serial.print(F("\\"valid\\":"));
  Serial.print(currentTelemetry.gpsValid ? F("true") : F("false"));
  Serial.print(F(",\\"lat\\":"));
  Serial.print(currentTelemetry.latitude, 6);
  Serial.print(F(",\\"lng\\":"));
  Serial.print(currentTelemetry.longitude, 6);
  Serial.print(F(",\\"speed_kmh\\":"));
  Serial.print(currentTelemetry.speedKmh, 1);
  Serial.print(F(",\\"satellites\\":"));
  Serial.print(currentTelemetry.satellites);
  Serial.print(F("},\\"status_code\\":\\""));
  Serial.print(currentTelemetry.statusCode);
  Serial.println(F("\\"}"));
}

void processIncomingSerialCommands() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    if (cmd.equalsIgnoreCase("PING")) {
      Serial.println(F("{\\"response\\":\\"PONG\\",\\"firmware\\":\\"v1.2.0\\"}"));
    } else if (cmd.equalsIgnoreCase("TEST_BUZZER")) {
      tone(PIN_BUZZER, 2000, 300);
      Serial.println(F("{\\"response\\":\\"BUZZER_TESTED\\"}"));
    } else if (cmd.equalsIgnoreCase("CALIBRATE_MQ3")) {
      alcoholBaseline = analogRead(PIN_MQ3_ALCOHOL);
      Serial.println(F("{\\"response\\":\\"CALIBRATED\\"}"));
    }
  }
}`
  },
  {
    path: 'backend/app.py',
    filename: 'app.py',
    language: 'python',
    category: 'Backend',
    description: 'Python Flask server with PySerial reader, virtual telemetry simulation, SQLite logger, and REST API.',
    content: `#!/usr/bin/env python3
"""
Smart Helmet IoT Telemetry Gateway & Fleet Safety Server
Backend: Python 3 with Flask & PySerial
"""

import os
import time
import json
import random
import threading
import sqlite3
from datetime import datetime
from typing import Dict, Any, List
from flask import Flask, jsonify, request, send_from_directory

try:
    from flask_cors import CORS
except ImportError:
    CORS = None

try:
    import serial
    import serial.tools.list_ports
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False

SERIAL_BAUDRATE = 115200
DB_PATH = os.path.join(os.path.dirname(__file__), "smart_helmet.db")
MAX_TELEMETRY_HISTORY = 100

app = Flask(__name__, static_folder="../dashboard", static_url_path="")
if CORS:
    CORS(app)

state_lock = threading.Lock()
latest_telemetry: Dict[str, Any] = {
    "device_id": "HELMET_01",
    "timestamp_ms": int(time.time() * 1000),
    "time_str": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "helmet_worn": True,
    "alcohol_raw": 145,
    "alcohol_bac": 0.000,
    "alcohol_alert": False,
    "heart_rate_bpm": 74,
    "gsr_raw": 280,
    "stress_index": 24,
    "stress_level": "CALM_FOCUSED",
    "ignition_state": True,
    "buzzer_state": False,
    "battery": {
        "raw_adc": 827,
        "voltage": 4.04,
        "percent": 82,
        "low": False
    },
    "gps": {"valid": True, "lat": 17.385044, "lng": 78.486671, "speed_kmh": 42.5, "satellites": 8},
    "status_code": "SAFE_RUNNING",
    "source": "SIMULATION"
}

telemetry_history: List[Dict[str, Any]] = []
alert_logs: List[Dict[str, Any]] = []
serial_conn = None
serial_connected = False
active_port_name = "None (Simulated)"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS telemetry_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            device_id TEXT,
            helmet_worn INTEGER,
            alcohol_bac REAL,
            heart_rate INTEGER,
            stress_index INTEGER,
            ignition_state INTEGER,
            lat REAL, lng REAL, speed_kmh REAL
        )
    """)
    conn.commit()
    conn.close()

@app.route("/api/telemetry", methods=["GET"])
def get_telemetry():
    with state_lock:
        return jsonify({
            "status": "success",
            "current": latest_telemetry,
            "history": telemetry_history[-30:],
            "total_samples": len(telemetry_history)
        })

@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    with state_lock:
        return jsonify({"status": "success", "alerts": alert_logs[:50]})

@app.route("/api/control", methods=["POST"])
def send_control():
    data = request.get_json(force=True) or {}
    cmd = data.get("command", "").upper()
    return jsonify({"status": "success", "command": cmd, "result": f"Executed: {cmd}"})

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)`
  },
  {
    path: 'dashboard/index.html',
    filename: 'index.html',
    language: 'html',
    category: 'Frontend',
    description: 'Standalone HTML5/Tailwind/Leaflet dashboard with live gauges, GPS map, and audio hazard alerts.',
    content: `<!-- Standalone Smart Helmet Telemetry & Fleet Safety Dashboard -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Smart Helmet IoT - Live Telemetry</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen p-6">
  <!-- Interactive Dashboard Content -->
</body>
</html>`
  },
  {
    path: 'requirements.txt',
    filename: 'requirements.txt',
    language: 'plaintext',
    category: 'Config',
    description: 'Python backend dependencies (Flask, PySerial, etc.).',
    content: `Flask>=2.3.0
flask-cors>=4.0.0
pyserial>=3.5
requests>=2.31.0
python-dotenv>=1.0.0`
  },
  {
    path: 'README.md',
    filename: 'README.md',
    language: 'markdown',
    category: 'Documentation',
    description: 'Hardware wiring schematics, pinout tables, sensor calibration, and GitHub deployment instructions.',
    content: `# Smart Helmet to Detect Driver Mood & Stress Using IoT 🛡️🏍️
Complete end-to-end hardware documentation, wiring guide, and deployment manual.`
  }
];
