/**
 * ==============================================================================
 * Project: Smart Helmet to Detect Driver Mood & Stress Using IoT
 * Target Hardware: Arduino Uno / Nano / Mega / ESP32 (ATMega328P or ESP32)
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

// ==========================================
// PIN CONFIGURATION DEFINITIONS
// ==========================================
#define PIN_MQ3_ALCOHOL      A0   // Analog input from MQ-3 Alcohol sensor
#define PIN_HEART_RATE       A1   // Analog input from Pulse / Heart Rate sensor
#define PIN_GSR_STRESS       A2   // Analog input from Galvanic Skin Response sensor
#define PIN_BATTERY_SENSE    A3   // Analog input from Voltage Divider (Helmet Li-ion Battery)
#define PIN_IR_HELMET        2    // Digital input from Optical IR Sensor (LOW = Worn)
#define PIN_GPS_RX           4    // Arduino RX <- NEO-6M TX
#define PIN_GPS_TX           3    // Arduino TX -> NEO-6M RX (via resistor divider if 3.3V)
#define PIN_BUZZER           7    // Digital output to Piezo Buzzer
#define PIN_RELAY_IGNITION   8    // Digital output to Relay (HIGH = Ignition Enabled)
#define PIN_LED_GREEN        9    // Green LED: System Normal / Engine ON
#define PIN_LED_RED          10   // Red LED: Hazard / Ignition Locked
#define PIN_LED_YELLOW       11   // Yellow LED: High Stress / Alert Warning

// ==========================================
// SYSTEM THRESHOLDS & CONSTANTS
// ==========================================
const int ALCOHOL_RAW_THRESHOLD = 380;       // Raw analog ADC threshold for alcohol intoxication
const float ALCOHOL_BAC_LIMIT   = 0.05;      // Blood Alcohol Concentration safety limit (% BAC)
const int STRESS_PULSE_HIGH_BPM = 100;       // Tachycardia / Acute stress threshold (BPM)
const int STRESS_PULSE_LOW_BPM  = 50;        // Drowsiness / Bradycardia threshold (BPM)
const int GSR_STRESS_THRESHOLD  = 520;       // High skin conductance = elevated stress / sweat
const float BATTERY_MIN_VOLTAGE = 3.30;      // Li-ion cutoff voltage (0% state of charge)
const float BATTERY_MAX_VOLTAGE = 4.20;      // Li-ion full charge voltage (100% state of charge)
// Voltage divider: R1 = 10k, R2 = 10k (divide by 2). V_batt = V_pin * ((R1+R2)/R2) = V_pin * 2.0
const float VOLTAGE_DIVIDER_RATIO = 2.00;    // Multiplier for 1:1 divider (e.g. 10k/10k)
const unsigned long TELEMETRY_INTERVAL_MS = 1000; // 1Hz telemetry transmission rate
const unsigned long SENSOR_SAMPLE_INTERVAL_MS = 250; // 4Hz sensor filtering rate

// ==========================================
// HARDWARE INSTANCES
// ==========================================
LiquidCrystal_I2C lcd(0x27, 16, 2);          // Set LCD address to 0x27 for 16 chars and 2 lines
SoftwareSerial gpsSerial(PIN_GPS_RX, PIN_GPS_TX); // Virtual UART for GPS module
TinyGPSPlus gps;                             // TinyGPS++ parser object

// ==========================================
// SYSTEM STATE VARIABLES
// ==========================================
struct HelmetTelemetry {
  bool helmetWorn;
  int alcoholRaw;
  float alcoholBAC;
  bool alcoholDetected;
  int heartRateBPM;
  int gsrRaw;
  int stressIndex;       // 0 - 100 scale
  char stressLevel[16];  // "CALM", "NORMAL", "STRESSED", "DROWSY", "PANIC"
  int batteryRaw;        // ADC 0-1023 on Pin A3
  float batteryVoltage;  // Actual cell voltage (3.3V - 4.2V)
  int batteryPercent;    // Remaining state of charge 0 - 100%
  bool batteryLow;       // Low battery warning flag (< 20% or < 3.45V)
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

// Calibration baseline for clean air
int alcoholBaseline = 120;

// ==========================================
// FUNCTION PROTOTYPES
// ==========================================
void initializeHardware();
void readSensors();
void evaluateSafetyLogic();
void controlActuators();
void updateDisplay();
void transmitSerialTelemetry();
void processIncomingSerialCommands();
float calculateBAC(int rawAdc);
void calculateMoodAndStress(int bpm, int gsr);

// ==========================================
// SETUP ROUTINE
// ==========================================
void setup() {
  // Initialize primary hardware Serial for PC / IoT Telemetry logger
  Serial.begin(115200);
  while (!Serial && millis() < 2000); // Allow USB serial to stabilize

  // Initialize SoftwareSerial for GPS at 9600 baud
  gpsSerial.begin(9600);

  // Configure GPIO directions
  pinMode(PIN_IR_HELMET, INPUT_PULLUP);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_RELAY_IGNITION, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);

  // Initial actuator safe state (Relay OPEN, Alarm OFF)
  digitalWrite(PIN_RELAY_IGNITION, LOW);
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_LED_YELLOW, LOW);

  // Initialize LCD display
  Wire.begin();
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SMART HELMET IoT");
  lcd.setCursor(0, 1);
  lcd.print("System Booting...");

  // Calibrate MQ-3 sensor baseline
  delay(1200);
  int baselineSum = 0;
  for (int i = 0; i < 10; i++) {
    baselineSum += analogRead(PIN_MQ3_ALCOHOL);
    delay(50);
  }
  alcoholBaseline = baselineSum / 10;

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Sensors Calibrated");
  lcd.setCursor(0, 1);
  lcd.print("Ready to Ride");
  delay(1000);
  lcd.clear();

  Serial.println(F("{\"system\":\"SMART_HELMET_V1\",\"status\":\"INITIALIZED\",\"baud\":115200}"));
}

// ==========================================
// MAIN RECURRING LOOP
// ==========================================
void loop() {
  unsigned long now = millis();

  // Feed incoming GPS NMEA sentences continually
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Periodic Sensor Sampling
  if (now - lastSampleTime >= SENSOR_SAMPLE_INTERVAL_MS) {
    lastSampleTime = now;
    readSensors();
    evaluateSafetyLogic();
    controlActuators();
  }

  // Periodic LCD Display Refresh (Every 500ms to avoid flicker)
  if (now - lastLcdUpdateTime >= 500) {
    lastLcdUpdateTime = now;
    updateDisplay();
  }

  // Periodic Telemetry Transmission (Every 1000ms)
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;
    transmitSerialTelemetry();
  }

  // Check for commands from Python backend or dashboard
  processIncomingSerialCommands();
}

// ==========================================
// SENSOR READING SUBSYSTEM
// ==========================================
void readSensors() {
  // 1. Read IR Sensor: Active LOW when helmet is worn on head
  //    (Object close to IR emitter/detector returns LOW)
  int irState = digitalRead(PIN_IR_HELMET);
  currentTelemetry.helmetWorn = (irState == LOW);

  // 2. Read MQ-3 Alcohol Gas Sensor
  int rawAlcohol = analogRead(PIN_MQ3_ALCOHOL);
  currentTelemetry.alcoholRaw = rawAlcohol;
  currentTelemetry.alcoholBAC = calculateBAC(rawAlcohol);
  currentTelemetry.alcoholDetected = (rawAlcohol > ALCOHOL_RAW_THRESHOLD) || 
                                     (currentTelemetry.alcoholBAC >= ALCOHOL_BAC_LIMIT);

  // 3. Read Pulse / Heart Rate Sensor
  // Pulse sensor output mapped to realistic BPM window
  int rawPulse = analogRead(PIN_HEART_RATE);
  int computedBpm = map(rawPulse, 0, 1023, 45, 140);
  if (computedBpm < 40) computedBpm = 0; // Sensor detached
  currentTelemetry.heartRateBPM = computedBpm;

  // 4. Read Galvanic Skin Response (GSR) / Skin Conductance
  int rawGsr = analogRead(PIN_GSR_STRESS);
  currentTelemetry.gsrRaw = rawGsr;

  // Calculate mood & stress index
  calculateMoodAndStress(computedBpm, rawGsr);

  // 5. Read Battery Voltage Divider (Pin A3)
  // Voltage divider circuit: R1 = 10k, R2 = 10k.
  // Pin voltage = (rawAdc / 1023.0) * 5.0V
  // Actual Battery voltage = Pin voltage * VOLTAGE_DIVIDER_RATIO (2.0)
  int rawBattery = analogRead(PIN_BATTERY_SENSE);
  currentTelemetry.batteryRaw = rawBattery;
  float pinVoltage = (float)rawBattery * (5.0 / 1023.0);
  float cellVoltage = pinVoltage * VOLTAGE_DIVIDER_RATIO;
  currentTelemetry.batteryVoltage = cellVoltage;

  // Calculate State of Charge (SoC) %: Li-ion 3.30V (0%) to 4.20V (100%)
  int socPercent = 0;
  if (cellVoltage >= BATTERY_MAX_VOLTAGE) {
    socPercent = 100;
  } else if (cellVoltage <= BATTERY_MIN_VOLTAGE) {
    socPercent = 0;
  } else {
    socPercent = (int)(((cellVoltage - BATTERY_MIN_VOLTAGE) / (BATTERY_MAX_VOLTAGE - BATTERY_MIN_VOLTAGE)) * 100.0);
  }
  currentTelemetry.batteryPercent = constrain(socPercent, 0, 100);
  currentTelemetry.batteryLow = (currentTelemetry.batteryPercent <= 20) || (cellVoltage < 3.45);

  // 6. Read GPS Location Data
  if (gps.location.isValid()) {
    currentTelemetry.gpsValid = true;
    currentTelemetry.latitude = gps.location.lat();
    currentTelemetry.longitude = gps.location.lng();
    currentTelemetry.speedKmh = gps.speed.kmph();
    currentTelemetry.satellites = gps.satellites.value();
  } else {
    currentTelemetry.gpsValid = false;
    currentTelemetry.latitude = 17.385044; // Default fallback coordinates (Hyderabad / Demo)
    currentTelemetry.longitude = 78.486671;
    currentTelemetry.speedKmh = 0.0;
    currentTelemetry.satellites = 0;
  }
}

// ==========================================
// ESTIMATE BLOOD ALCOHOL CONCENTRATION (BAC)
// ==========================================
float calculateBAC(int rawAdc) {
  // Transfer function approximation for MQ-3 sensor:
  // Converts ADC counts into mg/L air, then estimates % BAC
  if (rawAdc <= alcoholBaseline) {
    return 0.00;
  }
  float delta = (float)(rawAdc - alcoholBaseline);
  float bac = (delta / 1023.0) * 0.20; // 0.00 to 0.20% BAC scale
  return (bac < 0.0) ? 0.0 : bac;
}

// ==========================================
// DRIVER MOOD & STRESS ANALYSIS LOGIC
// ==========================================
void calculateMoodAndStress(int bpm, int gsr) {
  // Evaluates autonomic nervous system indicators (Pulse rate + galvanic skin conductivity)
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

// ==========================================
// CORE SAFETY INTERLOCK DECISION ENGINE
// ==========================================
void evaluateSafetyLogic() {
  // RULE 1: Helmet must be securely fastened on the rider's head
  if (!currentTelemetry.helmetWorn) {
    currentTelemetry.ignitionAllowed = false;
    currentTelemetry.buzzerActive = true;
    strcpy(currentTelemetry.statusCode, "VIOLATION_NO_HELMET");
    return;
  }

  // RULE 2: Driver must be 100% sober (MQ-3 below safety cutoff)
  if (currentTelemetry.alcoholDetected) {
    currentTelemetry.ignitionAllowed = false;
    currentTelemetry.buzzerActive = true;
    strcpy(currentTelemetry.statusCode, "VIOLATION_ALCOHOL");
    return;
  }

  // RULE 3: Extreme panic or incapacitation check
  if (currentTelemetry.stressIndex >= 90) {
    // Highly elevated distress - allow driving but warn driver and alert dispatch
    currentTelemetry.ignitionAllowed = true;
    currentTelemetry.buzzerActive = false;
    strcpy(currentTelemetry.statusCode, "WARN_HIGH_STRESS");
    return;
  }

  // ALL CONDITIONS SATISFIED -> SAFE OPERATION
  currentTelemetry.ignitionAllowed = true;
  currentTelemetry.buzzerActive = false;
  strcpy(currentTelemetry.statusCode, "SAFE_RUNNING");
}

// ==========================================
// ACTUATORS & HARDWARE INTERLOCK CONTROL
// ==========================================
void controlActuators() {
  // 1. Vehicle Ignition Relay Control
  if (currentTelemetry.ignitionAllowed) {
    digitalWrite(PIN_RELAY_IGNITION, HIGH); // Relay closed: Starter circuit armed
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_RED, LOW);
  } else {
    digitalWrite(PIN_RELAY_IGNITION, LOW);  // Relay open: Ignition locked
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_RED, HIGH);
  }

  // 2. Yellow LED: Stress Indicator
  if (currentTelemetry.stressIndex >= 70) {
    digitalWrite(PIN_LED_YELLOW, HIGH);
  } else {
    digitalWrite(PIN_LED_YELLOW, LOW);
  }

  // 3. Buzzer Alert Patterns
  if (currentTelemetry.buzzerActive) {
    // Generate pulsating audible alarm without blocking delays
    alarmToneState = !alarmToneState;
    if (alarmToneState) {
      tone(PIN_BUZZER, 2400); // 2.4 kHz shrill warning tone
    } else {
      noTone(PIN_BUZZER);
    }
  } else if (currentTelemetry.stressIndex >= 70) {
    // Intermittent gentle chirp for high driver fatigue/stress
    static unsigned long lastChirp = 0;
    if (millis() - lastChirp > 3000) {
      lastChirp = millis();
      tone(PIN_BUZZER, 1200, 100); // Short chirp
    }
  } else {
    noTone(PIN_BUZZER);
  }
}

// ==========================================
// LCD DISPLAY SUBSYSTEM
// ==========================================
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
    // Safe mode screen cycling
    static uint8_t screenPage = 0;
    screenPage = (screenPage + 1) % 2;

    if (screenPage == 0) {
      // Screen 1: Ignition & Mood status
      lcd.print("IGN:ON ");
      lcd.print(currentTelemetry.stressLevel);
      // Pad remaining line
      for (int i = 7 + strlen(currentTelemetry.stressLevel); i < 16; i++) {
        lcd.print(" ");
      }
      lcd.setCursor(0, 1);
      lcd.print("HR:");
      lcd.print(currentTelemetry.heartRateBPM);
      lcd.print("bpm ST:");
      lcd.print(currentTelemetry.stressIndex);
      lcd.print("%   ");
    } else {
      // Screen 2: GPS Status & Speed
      lcd.print("GPS:");
      if (currentTelemetry.gpsValid) {
        lcd.print("FIX Sats:");
        lcd.print(currentTelemetry.satellites);
      } else {
        lcd.print("ACQUIRING...");
      }
      lcd.setCursor(0, 1);
      lcd.print("Spd:");
      lcd.print(currentTelemetry.speedKmh, 1);
      lcd.print("km/h SAFE ");
    }
  }
}

// ==========================================
// SERIAL TELEMETRY TRANSMITTER (JSON)
// ==========================================
void transmitSerialTelemetry() {
  // Transmit compact, standard JSON payload for Python / IoT gateway
  Serial.print(F("{\"device_id\":\"HELMET_01\""));
  Serial.print(F(",\"timestamp_ms\":"));
  Serial.print(millis());
  Serial.print(F(",\"helmet_worn\":"));
  Serial.print(currentTelemetry.helmetWorn ? F("true") : F("false"));
  Serial.print(F(",\"alcohol_raw\":"));
  Serial.print(currentTelemetry.alcoholRaw);
  Serial.print(F(",\"alcohol_bac\":"));
  Serial.print(currentTelemetry.alcoholBAC, 3);
  Serial.print(F(",\"alcohol_alert\":"));
  Serial.print(currentTelemetry.alcoholDetected ? F("true") : F("false"));
  Serial.print(F(",\"heart_rate_bpm\":"));
  Serial.print(currentTelemetry.heartRateBPM);
  Serial.print(F(",\"gsr_raw\":"));
  Serial.print(currentTelemetry.gsrRaw);
  Serial.print(F(",\"stress_index\":"));
  Serial.print(currentTelemetry.stressIndex);
  Serial.print(F(",\"stress_level\":\""));
  Serial.print(currentTelemetry.stressLevel);
  Serial.print(F("\",\"ignition_state\":"));
  Serial.print(currentTelemetry.ignitionAllowed ? F("true") : F("false"));
  Serial.print(F(",\"buzzer_state\":"));
  Serial.print(currentTelemetry.buzzerActive ? F("true") : F("false"));
  Serial.print(F(",\"battery\":{"));
  Serial.print(F("\"raw_adc\":"));
  Serial.print(currentTelemetry.batteryRaw);
  Serial.print(F(",\"voltage\":"));
  Serial.print(currentTelemetry.batteryVoltage, 2);
  Serial.print(F(",\"percent\":"));
  Serial.print(currentTelemetry.batteryPercent);
  Serial.print(F(",\"low\":"));
  Serial.print(currentTelemetry.batteryLow ? F("true") : F("false"));
  Serial.print(F("},\"gps\":{"));
  Serial.print(F("\"valid\":"));
  Serial.print(currentTelemetry.gpsValid ? F("true") : F("false"));
  Serial.print(F(",\"lat\":"));
  Serial.print(currentTelemetry.latitude, 6);
  Serial.print(F(",\"lng\":"));
  Serial.print(currentTelemetry.longitude, 6);
  Serial.print(F(",\"speed_kmh\":"));
  Serial.print(currentTelemetry.speedKmh, 1);
  Serial.print(F(",\"satellites\":"));
  Serial.print(currentTelemetry.satellites);
  Serial.print(F("},\"status_code\":\""));
  Serial.print(currentTelemetry.statusCode);
  Serial.println(F("\"}"));
}

// ==========================================
// INCOMING SERIAL COMMAND PARSER
// ==========================================
void processIncomingSerialCommands() {
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd.equalsIgnoreCase("PING")) {
      Serial.println(F("{\"response\":\"PONG\",\"firmware\":\"v1.2.0\"}"));
    } else if (cmd.equalsIgnoreCase("TEST_BUZZER")) {
      tone(PIN_BUZZER, 2000, 300);
      Serial.println(F("{\"response\":\"BUZZER_TESTED\"}"));
    } else if (cmd.equalsIgnoreCase("CALIBRATE_MQ3")) {
      alcoholBaseline = analogRead(PIN_MQ3_ALCOHOL);
      Serial.print(F("{\"response\":\"CALIBRATED\",\"new_baseline\":"));
      Serial.print(alcoholBaseline);
      Serial.println(F("}"));
    } else if (cmd.equalsIgnoreCase("OVERRIDE_RELAY_OFF")) {
      digitalWrite(PIN_RELAY_IGNITION, LOW);
      currentTelemetry.ignitionAllowed = false;
      Serial.println(F("{\"response\":\"RELAY_FORCED_OFF\"}"));
    }
  }
}
