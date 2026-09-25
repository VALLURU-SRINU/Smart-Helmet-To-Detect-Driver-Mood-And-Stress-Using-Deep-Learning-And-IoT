import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  FileCode, 
  Brain, 
  GitBranch, 
  Download, 
  Radio, 
  Layers
} from 'lucide-react';
import { HardwareSimulator } from './components/HardwareSimulator';
import { PinoutSchematic } from './components/PinoutSchematic';
import { CodeViewer } from './components/CodeViewer';
import { MoodStressLogic } from './components/MoodStressLogic';

export default function App() {
  const [activeTab, setActiveTab] = useState<'bench' | 'pinout' | 'code' | 'stress'>('bench');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950">
      
      {/* Top Application Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & Project Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xl shadow-lg shadow-cyan-950/40">
              🛡️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                  SMART HELMET IoT SYSTEM
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/30 text-emerald-400">
                  FIRMWARE v1.2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Driver Mood & Stress Biometrics · MQ-3 Sobriety · IR Proximity · GPS Telemetry
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Functional interactive button tabs with zero-pill discipline) */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('bench')}
              className={`px-3 py-2 rounded-lg font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'bench'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Virtual Bench</span>
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-3 py-2 rounded-lg font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'code'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Source Files</span>
            </button>
            <button
              onClick={() => setActiveTab('pinout')}
              className={`px-3 py-2 rounded-lg font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'pinout'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Wiring & Pinout</span>
            </button>
            <button
              onClick={() => setActiveTab('stress')}
              className={`px-3 py-2 rounded-lg font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'stress'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Stress Algorithms</span>
            </button>
          </div>

          {/* Quick Hardware Spec Badges */}
          <div className="hidden lg:flex items-center gap-3 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>UART 115200</span>
            </span>
            <span className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
              <span>GitHub Ready</span>
            </span>
          </div>

        </div>
      </header>

      {/* Main Content View */}
      <main className="max-w-7xl w-full mx-auto px-6 py-6 flex-1">
        {activeTab === 'bench' && <HardwareSimulator />}
        {activeTab === 'code' && <CodeViewer />}
        {activeTab === 'pinout' && <PinoutSchematic />}
        {activeTab === 'stress' && <MoodStressLogic />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400 font-medium">Smart Helmet to Detect Driver Mood & Stress Using IoT</span>
            <span>·</span>
            <span>Arduino C++ Firmware + Python Flask Gateway</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-500 font-mono">Sensors: MQ-3 · TCRT5000 IR · NEO-6M GPS · Pulse PPG · GSR</span>
            <span>·</span>
            <span>Open Source (Apache 2.0)</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
