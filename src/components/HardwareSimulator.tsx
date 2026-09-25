import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  Activity, 
  Radio, 
  Navigation, 
  Cpu, 
  Zap, 
  ZapOff, 
  Play, 
  RotateCcw, 
  Terminal as TerminalIcon,
  Flame,
  Heart,
  Send,
  BellRing,
  Battery,
  BatteryCharging,
  BatteryWarning
} from 'lucide-react';

export interface TelemetryState {
  helmetWorn: boolean;
  alcoholRaw: number;
  alcoholBac: number;
  alcoholDetected: boolean;
  heartRateBpm: number;
  gsrRaw: number;
  stressIndex: number;
  stressLevel: 'CALM_FOCUSED' | 'ELEVATED' | 'ACUTE_STRESS' | 'DROWSY_FATIGUED' | 'PANIC_CRITICAL';
  ignitionAllowed: boolean;
  buzzerActive: boolean;
  latitude: number;
  longitude: number;
  speedKmh: number;
  satellites: number;
  statusCode: string;
}

export const HardwareSimulator: React.FC = () => {
  // Simulator state
  const [helmetWorn, setHelmetWorn] = useState<boolean>(true);
  const [alcoholRaw, setAlcoholRaw] = useState<number>(140);
  const [heartRateBpm, setHeartRateBpm] = useState<number>(72);
  const [gsrRaw, setGsrRaw] = useState<number>(290);
  const [batteryAdc, setBatteryAdc] = useState<number>(827); // Simulated ADC 0-1023 on Pin A3
  const [isMoving, setIsMoving] = useState<boolean>(true);
  const [audioMuted, setAudioMuted] = useState<boolean>(false);
  const [audioStarted, setAudioStarted] = useState<boolean>(false);
  
  // GPS position
  const [gpsPos, setGpsPos] = useState<{ lat: number; lng: number; speed: number }>({
    lat: 17.385044,
    lng: 78.486671,
    speed: 42.0
  });

  // Terminal & Logs
  const [serialLogs, setSerialLogs] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState<string>('');
  const [alertList, setAlertList] = useState<{ id: string; time: string; type: string; msg: string; severity: 'critical' | 'warning' | 'info' }[]>([
    {
      id: 'init-1',
      time: '12:00:01',
      type: 'BOOT',
      msg: 'Sensors calibrated. Starter relay active.',
      severity: 'info'
    }
  ]);
  const [sosModal, setSosModal] = useState<boolean>(false);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Computed values
  const alcoholBaseline = 120;
  const alcoholBac = Math.max(0, parseFloat((((alcoholRaw - alcoholBaseline) / 1023) * 0.20).toFixed(3)));
  const alcoholDetected = alcoholRaw > 380 || alcoholBac >= 0.05;

  // Battery calculations: 10k/10k voltage divider on Pin A3
  // Pin voltage = (batteryAdc / 1023) * 5.0V
  // Battery Cell voltage = Pin voltage * 2.0 (Divider ratio)
  const pinVoltage = (batteryAdc / 1023) * 5.0;
  const batteryVoltage = parseFloat((pinVoltage * 2.0).toFixed(2));
  // Li-ion SoC curve: 3.30V (0%) to 4.20V (100%)
  const rawBatteryPercent = Math.round(((batteryVoltage - 3.30) / (4.20 - 3.30)) * 100);
  const batteryPercent = Math.max(0, Math.min(100, rawBatteryPercent));
  const batteryLow = batteryPercent <= 20 || batteryVoltage < 3.45;

  // Stress & Mood computation
  let stressIndex = 20;
  let stressLevel: TelemetryState['stressLevel'] = 'CALM_FOCUSED';
  if (heartRateBpm > 120 || gsrRaw > 650) {
    stressIndex = 92;
    stressLevel = 'PANIC_CRITICAL';
  } else if (heartRateBpm > 100 || gsrRaw > 520) {
    stressIndex = 76;
    stressLevel = 'ACUTE_STRESS';
  } else if (heartRateBpm < 52) {
    stressIndex = 62;
    stressLevel = 'DROWSY_FATIGUED';
  } else if (heartRateBpm >= 85) {
    stressIndex = 48;
    stressLevel = 'ELEVATED';
  } else {
    stressIndex = 22;
    stressLevel = 'CALM_FOCUSED';
  }

  // Safety interlock decision
  let ignitionAllowed = true;
  let buzzerActive = false;
  let statusCode = 'SAFE_RUNNING';

  if (!helmetWorn) {
    ignitionAllowed = false;
    buzzerActive = true;
    statusCode = 'VIOLATION_NO_HELMET';
  } else if (alcoholDetected) {
    ignitionAllowed = false;
    buzzerActive = true;
    statusCode = 'VIOLATION_ALCOHOL';
  } else if (stressIndex >= 90) {
    ignitionAllowed = true;
    buzzerActive = false;
    statusCode = 'WARN_HIGH_STRESS';
  }

  // Initialize Web Audio
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    setAudioStarted(true);
  };

  // Buzzer tone control
  useEffect(() => {
    if (!audioStarted || audioMuted || !buzzerActive) {
      if (oscRef.current) {
        try {
          oscRef.current.stop();
          oscRef.current.disconnect();
        } catch {
          // ignore
        }
        oscRef.current = null;
      }
      return;
    }

    if (audioCtxRef.current && !oscRef.current) {
      try {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(2400, audioCtxRef.current.currentTime);
        gain.gain.setValueAtTime(0.06, audioCtxRef.current.currentTime);
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start();
        oscRef.current = osc;
        gainRef.current = gain;
      } catch (err) {
        console.error(err);
      }
    }

    return () => {
      if (oscRef.current) {
        try {
          oscRef.current.stop();
          oscRef.current.disconnect();
        } catch {
          // ignore
        }
        oscRef.current = null;
      }
    };
  }, [buzzerActive, audioMuted, audioStarted]);

  // Telemetry cycle (1Hz transmission)
  useEffect(() => {
    const timer = setInterval(() => {
      // Advance GPS if moving
      if (isMoving && ignitionAllowed) {
        setGpsPos(prev => ({
          lat: prev.lat + 0.00012,
          lng: prev.lng + 0.00015,
          speed: parseFloat((40 + Math.sin(Date.now() / 2000) * 12).toFixed(1))
        }));
      } else {
        setGpsPos(prev => ({ ...prev, speed: 0.0 }));
      }

      // Generate JSON packet
      const packet = {
        device_id: "HELMET_01",
        timestamp_ms: Date.now() % 10000000,
        helmet_worn: helmetWorn,
        alcohol_raw: alcoholRaw,
        alcohol_bac: alcoholBac,
        alcohol_alert: alcoholDetected,
        heart_rate_bpm: heartRateBpm,
        gsr_raw: gsrRaw,
        stress_index: stressIndex,
        stress_level: stressLevel,
        ignition_state: ignitionAllowed,
        buzzer_state: buzzerActive,
        battery: {
          raw_adc: batteryAdc,
          voltage: batteryVoltage,
          percent: batteryPercent,
          low: batteryLow
        },
        gps: {
          valid: true,
          lat: parseFloat(gpsPos.lat.toFixed(6)),
          lng: parseFloat(gpsPos.lng.toFixed(6)),
          speed_kmh: gpsPos.speed,
          satellites: 8
        },
        status_code: statusCode
      };

      setSerialLogs(prev => {
        const next = [...prev, JSON.stringify(packet)];
        return next.slice(-25);
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [helmetWorn, alcoholRaw, alcoholBac, alcoholDetected, heartRateBpm, gsrRaw, batteryAdc, batteryVoltage, batteryPercent, batteryLow, stressIndex, stressLevel, ignitionAllowed, buzzerActive, isMoving, gpsPos.lat, gpsPos.lng, gpsPos.speed, statusCode]);

  // Auto-scroll serial monitor
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [serialLogs]);

  // Record safety violation alert
  useEffect(() => {
    if (!helmetWorn) {
      setAlertList(prev => [
        {
          id: String(Date.now()),
          time: new Date().toLocaleTimeString(),
          type: 'HELMET_OFF',
          msg: 'Helmet removed or chin-strap unbuckled. Ignition locked.',
          severity: 'critical'
        },
        ...prev.slice(0, 15)
      ]);
    } else if (alcoholDetected) {
      setAlertList(prev => [
        {
          id: String(Date.now()),
          time: new Date().toLocaleTimeString(),
          type: 'ALCOHOL_ALERT',
          msg: `Intoxication detected: ${alcoholBac}% BAC (ADC ${alcoholRaw}). Ignition locked.`,
          severity: 'critical'
        },
        ...prev.slice(0, 15)
      ]);
    } else if (stressIndex >= 90) {
      setAlertList(prev => [
        {
          id: String(Date.now()),
          time: new Date().toLocaleTimeString(),
          type: 'PANIC_STRESS',
          msg: `Physiological anomaly: ${stressLevel} (${heartRateBpm} BPM).`,
          severity: 'warning'
        },
        ...prev.slice(0, 15)
      ]);
    } else if (batteryLow) {
      setAlertList(prev => [
        {
          id: String(Date.now()),
          time: new Date().toLocaleTimeString(),
          type: 'LOW_BATTERY',
          msg: `Helmet battery critical: ${batteryPercent}% (${batteryVoltage}V). Recharging required.`,
          severity: 'warning'
        },
        ...prev.slice(0, 15)
      ]);
    }
  }, [helmetWorn, alcoholDetected, stressIndex >= 90, batteryLow]);

  // Handle Serial Commands
  const handleSendCommand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cmd = commandInput.trim().toUpperCase();
    if (!cmd) return;

    let response = '';
    if (cmd === 'PING') {
      response = '{"response":"PONG","firmware":"v1.2.0","device":"HELMET_01"}';
    } else if (cmd === 'TEST_BUZZER') {
      initAudio();
      response = '{"response":"BUZZER_TESTED","frequency":2400,"duration_ms":300}';
    } else if (cmd === 'CALIBRATE_MQ3') {
      setAlcoholRaw(120);
      response = '{"response":"CALIBRATED","baseline":120}';
    } else if (cmd === 'OVERRIDE_RELAY_OFF') {
      setHelmetWorn(false);
      response = '{"response":"RELAY_FORCED_OFF"}';
    } else {
      response = `{"response":"UNKNOWN_CMD","cmd":"${cmd}"}`;
    }

    setSerialLogs(prev => [...prev, `>> ${cmd}`, `<< ${response}`]);
    setCommandInput('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Alert (If Hazard) */}
      {!ignitionAllowed && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-600/20 text-red-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-red-200 uppercase tracking-wider text-sm">
                VEHICLE IGNITION RESTRICTED · {statusCode}
              </h3>
              <p className="text-xs text-red-300/80">
                {!helmetWorn 
                  ? 'Optical IR sensor detects helmet is NOT worn. Strap helmet securely to arm ignition.'
                  : `MQ-3 gas sensor detected ${alcoholBac}% BAC (safe threshold < 0.05%). Starter cutoff armed.`}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setSosModal(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-lg shadow-red-950/50 transition cursor-pointer"
          >
            <BellRing className="w-4 h-4" />
            Dispatch SOS Telemetry
          </button>
        </div>
      )}

      {/* SOS Modal Simulation */}
      {sosModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-7 h-7" />
              <div>
                <h3 className="font-bold text-lg text-white">Emergency Dispatch Telemetry</h3>
                <p className="text-xs text-slate-400">Automated Fleet & Police SOS Protocol</p>
              </div>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300">
              <p><strong className="text-cyan-400">Device ID:</strong> HELMET_01</p>
              <p><strong className="text-cyan-400">Coordinates:</strong> {gpsPos.lat.toFixed(6)}, {gpsPos.lng.toFixed(6)}</p>
              <p><strong className="text-cyan-400">Violation:</strong> {statusCode}</p>
              <p><strong className="text-cyan-400">Driver BAC:</strong> {alcoholBac}% ({alcoholDetected ? 'FAIL' : 'PASS'})</p>
              <p><strong className="text-cyan-400">Heart Rate:</strong> {heartRateBpm} BPM ({stressLevel})</p>
              <p><strong className="text-cyan-400">Ignition Relay:</strong> LOCKED (Relay Pin 8 LOW)</p>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This simulated packet is transmitted via GSM/Cellular (SIM800L or Wi-Fi) to fleet management servers and emergency contacts.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={() => setSosModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
              >
                Close Window
              </button>
              <button 
                onClick={() => {
                  setAlertList(prev => [
                    {
                      id: String(Date.now()),
                      time: new Date().toLocaleTimeString(),
                      type: 'SOS_DISPATCHED',
                      msg: `SOS transmitted to fleet API. Coordinates: ${gpsPos.lat.toFixed(4)}, ${gpsPos.lng.toFixed(4)}`,
                      severity: 'critical'
                    },
                    ...prev
                  ]);
                  setSosModal(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg"
              >
                Simulate SMS Sent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Visual Bench & Hardware Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column 1 & 2: Interactive Hardware Console */}
        <div className="lg:col-span-2 space-y-6">

          {/* 4 Primary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Metric 1: Helmet Status (IR Sensor) */}
            <div className={`p-5 rounded-2xl border transition-all ${
              helmetWorn 
                ? 'bg-slate-900/90 border-slate-800' 
                : 'bg-red-950/30 border-red-500/40 shadow-lg shadow-red-950/30'
            }`}>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  OPTICAL IR PROXIMITY
                </span>
                <span className="font-mono text-slate-500">PIN D2</span>
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className={`text-2xl font-bold tracking-tight ${
                    helmetWorn ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {helmetWorn ? 'WORN & FASTENED' : 'HELMET REMOVED'}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    {helmetWorn ? 'Optical beam reflected off rider head' : 'Beam interrupted · Interlock active'}
                  </p>
                </div>
                <div className={`w-3 h-3 rounded-full ${helmetWorn ? 'bg-emerald-400 ring-4 ring-emerald-500/20' : 'bg-red-500 ring-4 ring-red-500/30 animate-ping'}`} />
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-500">Digital Input:</span>
                <button 
                  onClick={() => setHelmetWorn(!helmetWorn)}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                    helmetWorn 
                      ? 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-700/50' 
                      : 'bg-red-900 text-red-200 hover:bg-red-800 border border-red-600'
                  }`}
                >
                  Toggle: {helmetWorn ? 'Take Off' : 'Wear Helmet'}
                </button>
              </div>
            </div>

            {/* Metric 2: Sobriety / MQ-3 Alcohol */}
            <div className={`p-5 rounded-2xl border transition-all ${
              alcoholDetected 
                ? 'bg-red-950/30 border-red-500/40 shadow-lg shadow-red-950/30' 
                : 'bg-slate-900/90 border-slate-800'
            }`}>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  MQ-3 GAS SENSOR (ALCOHOL)
                </span>
                <span className="font-mono text-slate-500">PIN A0</span>
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold font-mono tracking-tight ${
                      alcoholDetected ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {alcoholBac.toFixed(3)}%
                    </span>
                    <span className="text-xs text-slate-400">BAC</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {alcoholDetected ? 'Intoxication threshold exceeded!' : 'Sober · Below 0.05% safety limit'}
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">ADC: {alcoholRaw}</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    alcoholDetected ? 'bg-red-500' : 'bg-emerald-500'
                  }`} 
                  style={{ width: `${Math.min(100, (alcoholRaw / 800) * 100)}%` }}
                />
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-500">Quick Test:</span>
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => setAlcoholRaw(130)} 
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  >
                    Sober
                  </button>
                  <button 
                    onClick={() => setAlcoholRaw(580)} 
                    className="text-[11px] px-2 py-0.5 rounded bg-red-950 hover:bg-red-900 text-red-200 border border-red-700/60"
                  >
                    Alcohol Spike
                  </button>
                </div>
              </div>
            </div>

            {/* Metric 3: Driver Mood & Stress */}
            <div className="p-5 rounded-2xl border bg-slate-900/90 border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  MOOD & STRESS BIOMETRICS
                </span>
                <span className="font-mono text-slate-500">PULSE + GSR</span>
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className={`text-2xl font-bold tracking-tight ${
                    stressLevel === 'PANIC_CRITICAL' 
                      ? 'text-red-400' 
                      : stressLevel === 'ACUTE_STRESS'
                      ? 'text-amber-400'
                      : stressLevel === 'DROWSY_FATIGUED'
                      ? 'text-purple-400'
                      : 'text-cyan-400'
                  }`}>
                    {stressLevel.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3 text-red-400 fill-red-400" />
                      <strong className="text-slate-200">{heartRateBpm} BPM</strong>
                    </span>
                    <span>·</span>
                    <span>Stress: <strong className="text-slate-200">{stressIndex}%</strong></span>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400 font-mono">
                  GSR: {gsrRaw}Ω
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-500">Preset State:</span>
                <select 
                  value={stressLevel}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'CALM_FOCUSED') { setHeartRateBpm(72); setGsrRaw(280); }
                    else if (v === 'ELEVATED') { setHeartRateBpm(88); setGsrRaw(380); }
                    else if (v === 'ACUTE_STRESS') { setHeartRateBpm(108); setGsrRaw(540); }
                    else if (v === 'DROWSY_FATIGUED') { setHeartRateBpm(49); setGsrRaw(230); }
                    else if (v === 'PANIC_CRITICAL') { setHeartRateBpm(134); setGsrRaw(710); }
                  }}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-0.5 cursor-pointer"
                >
                  <option value="CALM_FOCUSED">Calm & Focused</option>
                  <option value="ELEVATED">Elevated Attention</option>
                  <option value="ACUTE_STRESS">Acute Stress (Traffic)</option>
                  <option value="DROWSY_FATIGUED">Drowsy / Fatigue</option>
                  <option value="PANIC_CRITICAL">Panic / Emergency</option>
                </select>
              </div>
            </div>

            {/* Metric 4: Helmet Battery Level (Voltage Divider Pin A3) */}
            <div className={`p-5 rounded-2xl border transition-all ${
              batteryLow 
                ? 'bg-amber-950/30 border-amber-500/40 shadow-lg shadow-amber-950/30' 
                : 'bg-slate-900/90 border-slate-800'
            }`}>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-medium">
                  {batteryLow ? <BatteryWarning className="w-3.5 h-3.5 text-amber-400" /> : <Battery className="w-3.5 h-3.5 text-cyan-400" />}
                  HELMET BATTERY (ADC DIVIDER)
                </span>
                <span className="font-mono text-slate-500">PIN A3</span>
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold font-mono tracking-tight ${
                      batteryLow ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {batteryPercent}%
                    </span>
                    <span className="text-xs text-slate-400 font-mono">({batteryVoltage}V)</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {batteryLow 
                      ? 'Low battery! Recharge cell soon (<20%)' 
                      : batteryPercent >= 90 
                      ? 'Full charge · 1S Li-ion cell (4.2V)' 
                      : 'Nominal operating range (3.7V - 4.1V)'}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs font-mono text-slate-400">ADC: {batteryAdc}</span>
                  <span className={`text-[10px] font-semibold mt-1 px-1.5 py-0.5 rounded ${
                    batteryLow ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}>
                    {batteryLow ? 'LOW' : 'GOOD'}
                  </span>
                </div>
              </div>

              {/* Battery gauge bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    batteryLow ? 'bg-amber-500' : batteryPercent <= 50 ? 'bg-cyan-500' : 'bg-emerald-500'
                  }`} 
                  style={{ width: `${Math.max(4, batteryPercent)}%` }}
                />
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-500">Preset Cell:</span>
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => setBatteryAdc(850)} 
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    4.15V
                  </button>
                  <button 
                    onClick={() => setBatteryAdc(827)} 
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                  >
                    4.04V
                  </button>
                  <button 
                    onClick={() => setBatteryAdc(695)} 
                    className="text-[11px] px-2 py-0.5 rounded bg-amber-950 hover:bg-amber-900 text-amber-200 border border-amber-700/60 cursor-pointer"
                  >
                    3.40V
                  </button>
                </div>
              </div>
            </div>

            {/* Metric 5: Vehicle Starter Relay (Interlock) */}
            <div className={`p-5 rounded-2xl border transition-all ${
              ignitionAllowed 
                ? 'bg-slate-900/90 border-slate-800' 
                : 'bg-red-950/20 border-red-500/40'
            }`}>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-medium">
                  {ignitionAllowed ? <Zap className="w-3.5 h-3.5 text-emerald-400" /> : <ZapOff className="w-3.5 h-3.5 text-red-400" />}
                  STARTER RELAY INTERLOCK
                </span>
                <span className="font-mono text-slate-500">PIN D8</span>
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className={`text-2xl font-bold tracking-tight ${
                    ignitionAllowed ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {ignitionAllowed ? 'CIRCUIT ARMED (ON)' : 'STARTER LOCKED (CUT)'}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    {ignitionAllowed 
                      ? 'Relay energized HIGH · Starter motor enabled' 
                      : 'Relay open LOW · Engine crank prevented'}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-3.5 h-3.5 rounded-full ${
                    ignitionAllowed ? 'bg-emerald-400 ring-4 ring-emerald-500/20' : 'bg-red-500 ring-4 ring-red-500/30'
                  }`} />
                  <span className="text-[10px] font-mono text-slate-500">RELAY</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-500">Piezo Buzzer (Pin 7):</span>
                <span className={`font-mono font-medium ${buzzerActive ? 'text-red-400 animate-pulse' : 'text-slate-400'}`}>
                  {buzzerActive ? 'ALARM BEEPING (2.4kHz)' : 'STANDBY (SILENT)'}
                </span>
              </div>
            </div>

          </div>

          {/* Interactive Hardware Fine-Tuning Sliders */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                VIRTUAL SENSOR ANALOG CALIBRATION BENCH
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    initAudio();
                    setAudioMuted(!audioMuted);
                  }}
                  className={`text-xs px-2.5 py-1 rounded flex items-center gap-1.5 transition ${
                    audioMuted 
                      ? 'bg-slate-800 text-slate-400 hover:text-slate-200' 
                      : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  }`}
                  title="Toggle hardware buzzer sound"
                >
                  {audioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{audioMuted ? 'Buzzer Muted' : 'Sound Enabled'}</span>
                </button>
                <button 
                  onClick={() => {
                    setHelmetWorn(true);
                    setAlcoholRaw(130);
                    setHeartRateBpm(72);
                    setGsrRaw(280);
                  }}
                  className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
              {/* Slider 1: MQ-3 Alcohol Sensor */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">MQ-3 Vapor (ADC):</span>
                  <span className={`font-mono font-bold ${alcoholDetected ? 'text-red-400' : 'text-slate-300'}`}>
                    {alcoholRaw} ({alcoholBac}% BAC)
                  </span>
                </div>
                <input 
                  type="range" 
                  min="100" 
                  max="800" 
                  value={alcoholRaw} 
                  onChange={(e) => setAlcoholRaw(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>100 (Clean Air)</span>
                  <span className="text-amber-500">380 (Cutoff)</span>
                  <span>800 (Heavy)</span>
                </div>
              </div>

              {/* Slider 2: Pulse Heart Rate Sensor */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Pulse Sensor (A1):</span>
                  <span className="font-mono font-bold text-slate-300">{heartRateBpm} BPM</span>
                </div>
                <input 
                  type="range" 
                  min="45" 
                  max="145" 
                  value={heartRateBpm} 
                  onChange={(e) => setHeartRateBpm(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span className="text-purple-400">50 (Drowsy)</span>
                  <span>75 (Normal)</span>
                  <span className="text-red-400">100+ (Stress)</span>
                </div>
              </div>

              {/* Slider 3: GSR Skin Conductance */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">GSR Conductance (A2):</span>
                  <span className="font-mono font-bold text-slate-300">{gsrRaw} Ω</span>
                </div>
                <input 
                  type="range" 
                  min="180" 
                  max="780" 
                  value={gsrRaw} 
                  onChange={(e) => setGsrRaw(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>200 (Dry/Calm)</span>
                  <span>450 (Moderate)</span>
                  <span className="text-amber-400">520+ (Sweat)</span>
                </div>
              </div>

              {/* Slider 4: Battery Voltage Divider ADC (Pin A3) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Battery Divider (A3):</span>
                  <span className={`font-mono font-bold ${batteryLow ? 'text-amber-400' : 'text-cyan-400'}`}>
                    {batteryPercent}% ({batteryVoltage}V)
                  </span>
                </div>
                <input 
                  type="range" 
                  min="670" 
                  max="860" 
                  value={batteryAdc} 
                  onChange={(e) => setBatteryAdc(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span className="text-red-400">675 (3.3V Low)</span>
                  <span>750 (3.7V)</span>
                  <span className="text-emerald-400">860 (4.2V Full)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Virtual 16x2 LCD Display Emulator */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-bold text-white flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                VIRTUAL HARDWARE 16x2 I2C LCD (0x27)
              </span>
              <span className="text-slate-400 font-mono">HD44780 + PCF8574</span>
            </div>
            
            {/* LCD Backlight Shell */}
            <div className="bg-[#0b1d3a] border-4 border-[#142850] rounded-xl p-4 shadow-inner relative overflow-hidden">
              <div className="absolute top-1 right-2 text-[10px] font-mono text-cyan-400/30">I2C: 100kHz</div>
              <div className="font-mono text-cyan-300 text-lg md:text-xl tracking-widest uppercase select-none space-y-1">
                {/* LCD Line 1 */}
                <div className="bg-cyan-950/20 px-2 py-0.5 rounded border border-cyan-500/10">
                  {!helmetWorn 
                    ? '! WEAR HELMET ! '
                    : alcoholDetected 
                    ? 'ALCOHOL DETECTED'
                    : `IGN:ON ${stressLevel.substring(0, 9).padEnd(9, ' ')}`}
                </div>
                {/* LCD Line 2 */}
                <div className="bg-cyan-950/20 px-2 py-0.5 rounded border border-cyan-500/10">
                  {!helmetWorn 
                    ? 'ENGINE LOCKED   '
                    : alcoholDetected 
                    ? `BAC:${alcoholBac.toFixed(2)}% LOCK  `
                    : `HR:${heartRateBpm} B:${batteryPercent}% S:${stressIndex}%`}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                I2C Bus Clock: 100 kHz (SDA: A4, SCL: A5)
              </span>
              <button 
                onClick={() => {
                  initAudio();
                  setSerialLogs(prev => [...prev, '>> TEST_BUZZER', '<< {"response":"BUZZER_TESTED"}']);
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs"
              >
                Test Buzzer Chirp
              </button>
            </div>
          </div>

        </div>

        {/* Column 3: GPS Geolocation & Live Alert Terminal */}
        <div className="space-y-6">

          {/* GPS Live Geolocation Card */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                NEO-6M GPS MODULE
              </span>
              <span className="font-mono text-emerald-400">3D FIX (8 Sats)</span>
            </div>

            {/* Stylized Mini Map Box */}
            <div className="h-44 rounded-xl bg-slate-950 border border-slate-800 relative overflow-hidden flex flex-col justify-between p-3">
              {/* Grid backdrop */}
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />
              
              <div className="relative z-10 flex justify-between items-start text-xs font-mono">
                <div className="bg-slate-900/90 px-2 py-1 rounded border border-slate-800 text-slate-300">
                  <span>LAT: {gpsPos.lat.toFixed(6)}</span>
                  <br />
                  <span>LNG: {gpsPos.lng.toFixed(6)}</span>
                </div>
                <div className="bg-cyan-950/80 px-2 py-1 rounded border border-cyan-800 text-cyan-300 font-bold">
                  {gpsPos.speed} km/h
                </div>
              </div>

              {/* Center Vehicle Tracker Pin */}
              <div className="relative z-10 flex items-center justify-center my-auto">
                <div className="relative flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/50 animate-ping absolute" />
                  <div className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 font-bold flex items-center justify-center text-xs shadow-lg shadow-cyan-500/50">
                    🏍️
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>NMEA 9600 Baud</span>
                <button 
                  onClick={() => setIsMoving(!isMoving)} 
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                >
                  {isMoving ? 'Pause Movement' : 'Resume Drive'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block text-[10px]">RX PIN (D4)</span>
                <span className="text-slate-300">SoftSerial RX</span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block text-[10px]">TX PIN (D3)</span>
                <span className="text-slate-300">Resistor Divider</span>
              </div>
            </div>
          </div>

          {/* Real-time Fleet Incident Log */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col h-72">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                SAFETY INCIDENT LOGS
              </span>
              <button 
                onClick={() => setAlertList([])}
                className="text-slate-400 hover:text-slate-200 underline text-[11px]"
              >
                Clear
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {alertList.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  No safety incidents recorded
                </div>
              ) : (
                alertList.map(a => (
                  <div 
                    key={a.id} 
                    className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                      a.severity === 'critical'
                        ? 'bg-red-950/30 border-red-900/50 text-red-200'
                        : a.severity === 'warning'
                        ? 'bg-amber-950/30 border-amber-900/50 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="mt-0.5">
                      {a.severity === 'critical' ? '🚨' : a.severity === 'warning' ? '⚠️' : '✓'}
                    </span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <strong className="text-white text-[11px] font-mono">{a.type}</strong>
                        <span className="text-[10px] text-slate-500 font-mono">{a.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{a.msg}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Full-width UART Serial Console Terminal */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-white tracking-wide">
              UART SERIAL TELEMETRY MONITOR (BAUD 115200)
            </h3>
            <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono text-[10px]">
              CONNECTED: USB /dev/ttyACM0
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-400 text-xs">
            <span>Encoding: UTF-8</span>
            <span>·</span>
            <span>Packet Rate: 1000ms</span>
            <button 
              onClick={() => setSerialLogs([])} 
              className="text-cyan-400 hover:underline text-[11px]"
            >
              Clear Buffer
            </button>
          </div>
        </div>

        {/* Terminal Screen */}
        <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-emerald-400 h-48 overflow-y-auto border border-slate-800/80 shadow-inner space-y-1">
          {serialLogs.length === 0 ? (
            <div className="text-slate-600">// Waiting for serial telemetry stream...</div>
          ) : (
            serialLogs.map((log, idx) => (
              <div 
                key={idx} 
                className={`${
                  log.startsWith('>>') 
                    ? 'text-cyan-300 font-bold' 
                    : log.startsWith('<<') 
                    ? 'text-amber-300' 
                    : 'text-emerald-400/90'
                }`}
              >
                {log}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Command Dispatch Bar */}
        <form onSubmit={handleSendCommand} className="flex gap-2">
          <div className="relative flex-1">
            <input 
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="Enter command: PING, TEST_BUZZER, CALIBRATE_MQ3, OVERRIDE_RELAY_OFF..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button 
            type="submit"
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition"
          >
            <Send className="w-3.5 h-3.5" />
            Send Command
          </button>
        </form>
      </div>
    </div>
  );
};
