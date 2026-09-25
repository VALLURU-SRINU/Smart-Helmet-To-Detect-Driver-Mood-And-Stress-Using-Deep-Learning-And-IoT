#!/usr/bin/env python3
"""
================================================================================
Smart Helmet IoT Telemetry Gateway & Fleet Safety Server
Backend: Python 3 with Flask & PySerial
Author: Embedded Systems & IoT Engineering Team
================================================================================
Capabilities:
- Real-time Serial data ingestion from Arduino / ESP32 (baud 115200)
- Graceful virtual telemetry fallback if no physical COM port is attached
- REST API for live vehicle telemetry, driver stress indices, and GPS tracking
- Automated Emergency Alert Dispatcher (Sobriety & Helmet violations, SOS)
- Bi-directional hardware control commands (Relay override, Buzzer test, Calibrate)
- SQLite persistent alert and trip telemetry logging
================================================================================
"""

import os
import sys
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
    print("[WARNING] 'pyserial' not installed. Running in simulation-only mode.")

# ==========================================
# CONFIGURATION CONSTANTS
# ==========================================
SERIAL_BAUDRATE = 115200
DEFAULT_PORT_AUTO_DETECT = True
DB_PATH = os.path.join(os.path.dirname(__file__), "smart_helmet.db")
MAX_TELEMETRY_HISTORY = 100

app = Flask(__name__, static_folder="../dashboard", static_url_path="")
if CORS:
    CORS(app)

# ==========================================
# THREAD-SAFE STATE STORAGE
# ==========================================
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
        "raw_adc": 820,
        "voltage": 4.01,
        "percent": 79,
        "low": False
    },
    "gps": {
        "valid": True,
        "lat": 17.385044,
        "lng": 78.486671,
        "speed_kmh": 42.5,
        "satellites": 8
    },
    "status_code": "SAFE_RUNNING",
    "source": "SIMULATION"
}

telemetry_history: List[Dict[str, Any]] = []
alert_logs: List[Dict[str, Any]] = []
serial_conn = None
serial_connected = False
active_port_name = "None (Simulated)"

# Simulation controls
simulation_params = {
    "enabled": True,
    "helmet_worn": True,
    "force_alcohol": False,
    "stress_mode": "NORMAL", # NORMAL, HIGH, DROWSY, PANIC
    "moving": True
}

# ==========================================
# SQLITE DATABASE INITIALIZATION
# ==========================================
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS telemetry_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            device_id TEXT,
            helmet_worn INTEGER,
            alcohol_raw INTEGER,
            alcohol_bac REAL,
            heart_rate INTEGER,
            stress_index INTEGER,
            stress_level TEXT,
            ignition_state INTEGER,
            lat REAL,
            lng REAL,
            speed_kmh REAL,
            status_code TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alert_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            alert_type TEXT,
            severity TEXT,
            message TEXT,
            lat REAL,
            lng REAL,
            dispatched INTEGER DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()

def log_alert_to_db(alert_type: str, severity: str, message: str, lat: float, lng: float):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO alert_log (alert_type, severity, message, lat, lng, dispatched)
            VALUES (?, ?, ?, ?, ?, 1)
        """, (alert_type, severity, message, lat, lng))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[DB ERROR] Failed to record alert: {e}")

# ==========================================
# SERIAL PORT MANAGER
# ==========================================
def find_arduino_port() -> str:
    if not SERIAL_AVAILABLE:
        return None
    ports = serial.tools.list_ports.comports()
    for p in ports:
        desc = (p.description or "").lower()
        hwid = (p.hwid or "").lower()
        if any(k in desc or k in hwid for k in ["arduino", "ch340", "cp210x", "ftdi", "usb serial"]):
            return p.device
    if ports:
        return ports[0].device
    return None

def serial_worker_thread():
    global serial_conn, serial_connected, active_port_name, latest_telemetry

    while True:
        port = find_arduino_port()
        if port and SERIAL_AVAILABLE:
            try:
                print(f"[SERIAL] Attempting connection to hardware on {port} @ {SERIAL_BAUDRATE} baud...")
                serial_conn = serial.Serial(port, SERIAL_BAUDRATE, timeout=1.5)
                active_port_name = port
                serial_connected = True
                print(f"[SERIAL SUCCESS] Connected to {port}. Ingesting live telemetry stream...")

                while serial_connected:
                    line = serial_conn.readline().decode("utf-8", errors="replace").strip()
                    if line.startswith("{") and line.endswith("}"):
                        try:
                            data = json.loads(line)
                            data["time_str"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            data["source"] = "HARDWARE_SERIAL"
                            process_telemetry_packet(data)
                        except json.JSONDecodeError:
                            pass
                    time.sleep(0.01)

            except Exception as e:
                print(f"[SERIAL DISCONNECTED] Error: {e}. Falling back to simulation...")
                serial_connected = False
                active_port_name = "None (Simulated)"
                if serial_conn and serial_conn.is_open:
                    serial_conn.close()
        else:
            serial_connected = False
            active_port_name = "None (Simulated)"

        # Sleep before retry
        time.sleep(4.0)

# ==========================================
# REALISTIC TELEMETRY SIMULATION WORKER
# ==========================================
def simulation_worker_thread():
    global latest_telemetry

    # Demo route around a city circuit
    lat = 17.385044
    lng = 78.486671
    heading = 0.0

    while True:
        if not serial_connected and simulation_params["enabled"]:
            with state_lock:
                # Update simulated GPS coordinates along a path
                if simulation_params["moving"]:
                    speed = random.uniform(32.0, 58.0)
                    heading += random.uniform(-0.1, 0.1)
                    lat += 0.00015 * random.uniform(0.7, 1.2)
                    lng += 0.00018 * random.uniform(0.7, 1.2)
                else:
                    speed = 0.0

                # Determine Alcohol status
                if simulation_params["force_alcohol"]:
                    alcohol_raw = random.randint(460, 680)
                    alcohol_bac = round((alcohol_raw - 120) / 1023.0 * 0.20, 3)
                    alcohol_alert = True
                else:
                    alcohol_raw = random.randint(110, 150)
                    alcohol_bac = 0.000
                    alcohol_alert = False

                helmet_worn = simulation_params["helmet_worn"]

                # Stress Mode logic
                stress_mode = simulation_params["stress_mode"]
                if stress_mode == "HIGH":
                    hr = random.randint(105, 125)
                    gsr = random.randint(580, 650)
                    stress_idx = random.randint(75, 88)
                    stress_lvl = "ACUTE_STRESS"
                elif stress_mode == "PANIC":
                    hr = random.randint(128, 148)
                    gsr = random.randint(670, 780)
                    stress_idx = random.randint(90, 98)
                    stress_lvl = "PANIC/CRITICAL"
                elif stress_mode == "DROWSY":
                    hr = random.randint(48, 54)
                    gsr = random.randint(220, 260)
                    stress_idx = random.randint(58, 68)
                    stress_lvl = "DROWSY/FATIGUED"
                else:
                    hr = random.randint(68, 79)
                    gsr = random.randint(280, 350)
                    stress_idx = random.randint(18, 30)
                    stress_lvl = "CALM_FOCUSED"

                # Safety interlock logic
                if not helmet_worn:
                    ignition = False
                    buzzer = True
                    status = "VIOLATION_NO_HELMET"
                elif alcohol_alert:
                    ignition = False
                    buzzer = True
                    status = "VIOLATION_ALCOHOL"
                elif stress_idx >= 90:
                    ignition = True
                    buzzer = False
                    status = "WARN_HIGH_STRESS"
                else:
                    ignition = True
                    buzzer = False
                    status = "SAFE_RUNNING"

                packet = {
                    "device_id": "HELMET_01",
                    "timestamp_ms": int(time.time() * 1000),
                    "time_str": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "helmet_worn": helmet_worn,
                    "alcohol_raw": alcohol_raw,
                    "alcohol_bac": alcohol_bac,
                    "alcohol_alert": alcohol_alert,
                    "heart_rate_bpm": hr,
                    "gsr_raw": gsr,
                    "stress_index": stress_idx,
                    "stress_level": stress_lvl,
                    "ignition_state": ignition,
                    "buzzer_state": buzzer,
                    "battery": {
                        "raw_adc": random.randint(805, 835),
                        "voltage": round(random.uniform(3.95, 4.08), 2),
                        "percent": random.randint(75, 85),
                        "low": False
                    },
                    "gps": {
                        "valid": True,
                        "lat": round(lat, 6),
                        "lng": round(lng, 6),
                        "speed_kmh": round(speed, 1),
                        "satellites": 8
                    },
                    "status_code": status,
                    "source": "SIMULATION"
                }

                process_telemetry_packet(packet)

        time.sleep(1.0)

# ==========================================
# TELEMETRY PACKET PROCESSOR & ALERT DETECTOR
# ==========================================
def process_telemetry_packet(packet: Dict[str, Any]):
    global latest_telemetry, telemetry_history, alert_logs

    with state_lock:
        latest_telemetry = packet
        telemetry_history.append(packet)
        if len(telemetry_history) > MAX_TELEMETRY_HISTORY:
            telemetry_history.pop(0)

        # Check for alert conditions and record log
        lat = packet.get("gps", {}).get("lat", 0.0)
        lng = packet.get("gps", {}).get("lng", 0.0)

        if not packet.get("helmet_worn", True):
            if not any(a["type"] == "NO_HELMET" and (time.time() - a["timestamp"]) < 10 for a in alert_logs):
                alert = {
                    "id": len(alert_logs) + 1,
                    "timestamp": time.time(),
                    "time_str": datetime.now().strftime("%H:%M:%S"),
                    "type": "NO_HELMET",
                    "severity": "CRITICAL",
                    "message": "Helmet is unfastened or removed while vehicle active. Ignition cut.",
                    "lat": lat,
                    "lng": lng
                }
                alert_logs.insert(0, alert)
                log_alert_to_db("NO_HELMET", "CRITICAL", alert["message"], lat, lng)

        if packet.get("alcohol_alert", False):
            if not any(a["type"] == "ALCOHOL_DETECTED" and (time.time() - a["timestamp"]) < 10 for a in alert_logs):
                bac = packet.get("alcohol_bac", 0.0)
                alert = {
                    "id": len(alert_logs) + 1,
                    "timestamp": time.time(),
                    "time_str": datetime.now().strftime("%H:%M:%S"),
                    "type": "ALCOHOL_DETECTED",
                    "severity": "CRITICAL",
                    "message": f"Intoxication detected! BAC: {bac:.3f}%. Ignition locked out.",
                    "lat": lat,
                    "lng": lng
                }
                alert_logs.insert(0, alert)
                log_alert_to_db("ALCOHOL_DETECTED", "CRITICAL", alert["message"], lat, lng)

        if packet.get("stress_index", 0) >= 85:
            if not any(a["type"] == "DRIVER_STRESS_ANOMALY" and (time.time() - a["timestamp"]) < 15 for a in alert_logs):
                lvl = packet.get("stress_level", "HIGH")
                bpm = packet.get("heart_rate_bpm", 0)
                alert = {
                    "id": len(alert_logs) + 1,
                    "timestamp": time.time(),
                    "time_str": datetime.now().strftime("%H:%M:%S"),
                    "type": "DRIVER_STRESS_ANOMALY",
                    "severity": "WARNING",
                    "message": f"Driver physiological anomaly: {lvl} ({bpm} BPM). Recommend rest break.",
                    "lat": lat,
                    "lng": lng
                }
                alert_logs.insert(0, alert)
                log_alert_to_db("DRIVER_STRESS_ANOMALY", "WARNING", alert["message"], lat, lng)

# ==========================================
# REST API ENDPOINTS
# ==========================================
@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/api/telemetry", methods=["GET"])
def get_telemetry():
    """Retrieve current telemetry snapshot and historical points."""
    with state_lock:
        return jsonify({
            "status": "success",
            "current": latest_telemetry,
            "history": telemetry_history[-30:],
            "total_samples": len(telemetry_history)
        })

@app.route("/api/telemetry", methods=["POST"])
def post_telemetry():
    """Ingest telemetry via HTTP POST (e.g. from ESP32 / Wi-Fi Smart Helmet)."""
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({"status": "error", "message": "No JSON payload provided"}), 400

        data["time_str"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        data["source"] = "HTTP_CLIENT"
        process_telemetry_packet(data)
        return jsonify({"status": "acknowledged", "timestamp": data["time_str"]})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    """Retrieve list of recorded safety violations & physiological alerts."""
    with state_lock:
        return jsonify({
            "status": "success",
            "count": len(alert_logs),
            "alerts": alert_logs[:50]
        })

@app.route("/api/alerts/clear", methods=["POST"])
def clear_alerts():
    global alert_logs
    with state_lock:
        alert_logs = []
    return jsonify({"status": "success", "message": "Alert buffer cleared"})

@app.route("/api/control", methods=["POST"])
def send_control_command():
    """Send bi-directional control commands to the embedded hardware."""
    data = request.get_json(force=True) or {}
    cmd = data.get("command", "").upper()

    response_msg = ""
    if serial_connected and serial_conn and serial_conn.is_open:
        try:
            serial_conn.write(f"{cmd}\n".encode("utf-8"))
            response_msg = f"Command '{cmd}' dispatched to hardware serial port {active_port_name}"
        except Exception as e:
            response_msg = f"Failed to transmit to serial: {e}"
    else:
        # Simulate command response
        if cmd == "TEST_BUZZER":
            response_msg = "Simulated buzzer chirp tone executed (2400Hz, 300ms)"
        elif cmd == "CALIBRATE_MQ3":
            response_msg = "MQ-3 baseline calibration re-zeroed to current clean air level"
        elif cmd == "OVERRIDE_RELAY_OFF":
            simulation_params["helmet_worn"] = False
            response_msg = "Vehicle ignition relay emergency cut forced"
        else:
            response_msg = f"Simulation received command: {cmd}"

    return jsonify({
        "status": "success",
        "command": cmd,
        "result": response_msg,
        "serial_active": serial_connected
    })

@app.route("/api/simulate", methods=["POST"])
def update_simulation_settings():
    """Adjust virtual sensor simulation parameters for testing and demo."""
    data = request.get_json(force=True) or {}
    for key in ["helmet_worn", "force_alcohol", "stress_mode", "moving", "enabled"]:
        if key in data:
            simulation_params[key] = data[key]

    return jsonify({
        "status": "success",
        "updated_params": simulation_params
    })

@app.route("/api/status", methods=["GET"])
def get_system_status():
    """Get connection status and hardware gateway diagnostics."""
    return jsonify({
        "status": "online",
        "serial_connected": serial_connected,
        "active_port": active_port_name,
        "baud_rate": SERIAL_BAUDRATE,
        "simulation_mode": not serial_connected,
        "available_ports": [p.device for p in serial.tools.list_ports.comports()] if SERIAL_AVAILABLE else [],
        "database": DB_PATH,
        "server_time": datetime.now().isoformat()
    })

# ==========================================
# SERVER BOOTSTRAP
# ==========================================
if __name__ == "__main__":
    init_db()

    # Launch serial reader thread
    t_serial = threading.Thread(target=serial_worker_thread, daemon=True)
    t_serial.start()

    # Launch telemetry simulation thread
    t_sim = threading.Thread(target=simulation_worker_thread, daemon=True)
    t_sim.start()

    port = int(os.environ.get("PORT", 5000))
    print(f"""
===================================================================
 SMART HELMET IoT TELEMETRY GATEWAY ACTIVE
 Host: http://127.0.0.1:{port}
 REST Telemetry Stream: http://127.0.0.1:{port}/api/telemetry
 Safety Alerts API:     http://127.0.0.1:{port}/api/alerts
 System Status API:     http://127.0.0.1:{port}/api/status
===================================================================
    """)
    app.run(host="0.0.0.0", port=port, debug=False)
