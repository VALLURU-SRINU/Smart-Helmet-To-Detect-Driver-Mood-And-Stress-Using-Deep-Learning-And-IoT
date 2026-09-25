import React from 'react';
import { Activity, Brain, Heart, Zap, ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';

export const MoodStressLogic: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          DRIVER MOOD & STRESS DETECTION ALGORITHM
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Detailed embedded mathematical models combining Photoplethysmogram (PPG) heart rate and Galvanic Skin Response (GSR) to classify driver cognitive load and safety risk.
        </p>
      </div>

      {/* 2-Column Core Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Card 1: Sensor Fusion & Biological Indicators */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            1. PHYSIOLOGICAL SENSOR FUSION
          </h3>

          <div className="space-y-3 text-xs leading-relaxed text-slate-300">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="font-bold text-red-400 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5" />
                Pulse / Heart Rate Sensor (Pin A1)
              </span>
              <p className="text-slate-400">
                Measures capillary blood volume changes in the temporal artery or forehead via green LED photoplethysmography (PPG). Peak-to-peak interval (IBI) calculates instantaneous Heart Rate (BPM).
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Galvanic Skin Response (GSR - Pin A2)
              </span>
              <p className="text-slate-400">
                Measures autonomic nervous system (sympathetic arousal) via micro-sweat gland conductance. As stress or fear surges, sweat pore resistance drops (R_skin decreases), raising analog voltage on A2.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="font-bold text-purple-400 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" />
                Stress Index Formula
              </span>
              <div className="bg-slate-900 p-2.5 rounded font-mono text-[11px] text-cyan-300">
                StressIndex = 0.65 · (BPM - Baseline) + 0.35 · (GSR_Conductance)
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Driver Mood Classification State Machine */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Brain className="w-4 h-4 text-emerald-400" />
            2. MOOD & STRESS STATE MACHINE
          </h3>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 shrink-0" />
              <div>
                <strong className="text-emerald-400">CALM_FOCUSED (Score 0 - 35)</strong>
                <p className="text-slate-400 mt-0.5">HR: 60–80 BPM, GSR: Dry. Optimal cognitive alertness. Ignition fully enabled.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 mt-1 shrink-0" />
              <div>
                <strong className="text-blue-400">ELEVATED (Score 36 - 60)</strong>
                <p className="text-slate-400 mt-0.5">HR: 80–100 BPM. Heightened traffic alertness or overtaking maneuvers.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 mt-1 shrink-0" />
              <div>
                <strong className="text-purple-400">DROWSY_FATIGUED (Score 61 - 70)</strong>
                <p className="text-slate-400 mt-0.5">HR &lt; 50 BPM with low variability. Fatigue warning chime triggered on buzzer.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1 shrink-0" />
              <div>
                <strong className="text-amber-400">ACUTE_STRESS (Score 71 - 85)</strong>
                <p className="text-slate-400 mt-0.5">HR: 100–120 BPM, high skin conductance. Yellow LED activated on dashboard.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 mt-1 shrink-0" />
              <div>
                <strong className="text-red-400">PANIC_CRITICAL (Score &gt; 85)</strong>
                <p className="text-slate-400 mt-0.5">HR &gt; 120 BPM with erratic GSR. Telemetry alert dispatched to fleet dispatcher.</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Decision Matrix Table */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          SAFETY INTERLOCK & ACTUATOR DECISION MATRIX
        </h3>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono">
                <th className="p-3.5">Condition</th>
                <th className="p-3.5">IR Sensor</th>
                <th className="p-3.5">MQ-3 Alcohol</th>
                <th className="p-3.5">Driver Stress</th>
                <th className="p-3.5">Relay (D8)</th>
                <th className="p-3.5">Buzzer (D7)</th>
                <th className="p-3.5">LED Status</th>
                <th className="p-3.5">LCD Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-sans">
              <tr className="hover:bg-slate-800/40">
                <td className="p-3.5 font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Normal Safe
                </td>
                <td className="p-3.5 text-slate-300">WORN (LOW)</td>
                <td className="p-3.5 text-slate-300">&lt; 0.05% BAC</td>
                <td className="p-3.5 text-slate-300">Calm (&lt; 70%)</td>
                <td className="p-3.5 font-bold text-emerald-400">HIGH (ARMED)</td>
                <td className="p-3.5 text-slate-500">OFF</td>
                <td className="p-3.5 text-emerald-400 font-mono">GREEN ON</td>
                <td className="p-3.5 font-mono text-cyan-300">IGN:ON CALM</td>
              </tr>
              <tr className="hover:bg-slate-800/40 bg-red-950/20">
                <td className="p-3.5 font-bold text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Helmet Removed
                </td>
                <td className="p-3.5 font-bold text-red-400">REMOVED (HIGH)</td>
                <td className="p-3.5 text-slate-400">Any</td>
                <td className="p-3.5 text-slate-400">Any</td>
                <td className="p-3.5 font-bold text-red-400">LOW (LOCKED)</td>
                <td className="p-3.5 font-bold text-red-400">PULSING 2.4k</td>
                <td className="p-3.5 text-red-400 font-mono">RED ON</td>
                <td className="p-3.5 font-mono text-red-300">! WEAR HELMET !</td>
              </tr>
              <tr className="hover:bg-slate-800/40 bg-red-950/20">
                <td className="p-3.5 font-bold text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Intoxication
                </td>
                <td className="p-3.5 text-slate-400">WORN (LOW)</td>
                <td className="p-3.5 font-bold text-red-400">&gt; 0.05% BAC</td>
                <td className="p-3.5 text-slate-400">Any</td>
                <td className="p-3.5 font-bold text-red-400">LOW (LOCKED)</td>
                <td className="p-3.5 font-bold text-red-400">CONTINUOUS</td>
                <td className="p-3.5 text-red-400 font-mono">RED FLASH</td>
                <td className="p-3.5 font-mono text-red-300">ALCOHOL DETECTED</td>
              </tr>
              <tr className="hover:bg-slate-800/40 bg-amber-950/20">
                <td className="p-3.5 font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Severe Distress
                </td>
                <td className="p-3.5 text-slate-300">WORN (LOW)</td>
                <td className="p-3.5 text-slate-300">&lt; 0.05% BAC</td>
                <td className="p-3.5 font-bold text-amber-400">&gt; 85% Score</td>
                <td className="p-3.5 font-bold text-emerald-400">HIGH (ARMED)</td>
                <td className="p-3.5 text-amber-400">Intermittent</td>
                <td className="p-3.5 text-amber-400 font-mono">YELLOW ON</td>
                <td className="p-3.5 font-mono text-amber-300">WARN: HIGH STRESS</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
