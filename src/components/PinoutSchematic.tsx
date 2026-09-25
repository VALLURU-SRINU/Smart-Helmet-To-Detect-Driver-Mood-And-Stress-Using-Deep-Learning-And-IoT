import React, { useState } from 'react';
import { Cpu, Zap, Info, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface PinMapping {
  component: string;
  pinName: string;
  arduinoPin: string;
  esp32Pin: string;
  type: string;
  voltage: string;
  purpose: string;
  notes: string;
}

const PIN_DATA: PinMapping[] = [
  {
    component: 'MQ-3 Alcohol Sensor',
    pinName: 'AOUT (Analog Out)',
    arduinoPin: 'A0',
    esp32Pin: 'GPIO 36 (ADC1_0)',
    type: 'Analog Input',
    voltage: '5V VCC',
    purpose: 'Measures alcohol vapor concentration from rider breath',
    notes: 'Internal heater consumes ~150mA. Allow 2-3 mins pre-heat'
  },
  {
    component: 'Optical IR Proximity Sensor',
    pinName: 'DOUT (Digital Out)',
    arduinoPin: 'D2 (Interrupt 0)',
    esp32Pin: 'GPIO 4',
    type: 'Digital Input (Pullup)',
    voltage: '5V or 3.3V',
    purpose: 'Detects if helmet is securely worn on head',
    notes: 'Active LOW when optical infrared beam is reflected by head'
  },
  {
    component: 'Pulse / Heart Rate Sensor',
    pinName: 'Signal (S)',
    arduinoPin: 'A1',
    esp32Pin: 'GPIO 34 (ADC1_6)',
    type: 'Analog Input',
    voltage: '3.3V - 5V',
    purpose: 'Captures photoplethysmogram (PPG) pulse wave to calculate BPM',
    notes: 'Optical green LED reflection sensor mounted on helmet inner band'
  },
  {
    component: 'Galvanic Skin Response (GSR)',
    pinName: 'Analog Signal',
    arduinoPin: 'A2',
    esp32Pin: 'GPIO 35 (ADC1_7)',
    type: 'Analog Input',
    voltage: '5V or 3.3V',
    purpose: 'Measures skin conductivity indicating sweat & sympathetic arousal',
    notes: 'Dual finger/forehead electrode contacts on interior padding'
  },
  {
    component: 'Battery Voltage Divider',
    pinName: 'V_SENSE (Middle Tap)',
    arduinoPin: 'A3',
    esp32Pin: 'GPIO 32 (ADC1_4)',
    type: 'Analog Input',
    voltage: '0V - 2.5V (into Pin)',
    purpose: 'Measures helmet Li-ion battery pack voltage (3.3V - 4.2V)',
    notes: '10kΩ / 10kΩ divider scales battery cell voltage by half (2.0x multiplier)'
  },
  {
    component: 'NEO-6M GPS Module',
    pinName: 'TX Pin',
    arduinoPin: 'D4 (Software RX)',
    esp32Pin: 'GPIO 16 (UART2 RX)',
    type: 'Serial Input',
    voltage: '3.3V - 5V VCC',
    purpose: 'Receives NMEA sentences ($GPRMC, $GPGGA) for Lat/Lng/Speed',
    notes: 'Transmits at 9600 baud. Requires clear line of sight to sky'
  },
  {
    component: 'NEO-6M GPS Module',
    pinName: 'RX Pin',
    arduinoPin: 'D3 (Software TX)',
    esp32Pin: 'GPIO 17 (UART2 TX)',
    type: 'Serial Output',
    voltage: '3.3V Logic',
    purpose: 'Sends configuration commands to GPS module',
    notes: 'Use 1k/2k resistor voltage divider from Arduino 5V TX pin'
  },
  {
    component: 'Vehicle Relay Interlock',
    pinName: 'IN (Control Signal)',
    arduinoPin: 'D8',
    esp32Pin: 'GPIO 18',
    type: 'Digital Output',
    voltage: '5V VCC',
    purpose: 'Controls starter motor / ignition solenoid circuit',
    notes: 'Active HIGH closes relay contacts. De-energized opens starter loop'
  },
  {
    component: 'Active Piezo Buzzer',
    pinName: 'Positive (+)',
    arduinoPin: 'D7',
    esp32Pin: 'GPIO 19',
    type: 'PWM / Digital Out',
    voltage: '5V',
    purpose: 'Generates audible warning beeps during safety violations',
    notes: 'Driven with tone() at 2.4 kHz for maximum acoustic penetration'
  },
  {
    component: 'Green Status LED',
    pinName: 'Anode (+)',
    arduinoPin: 'D9',
    esp32Pin: 'GPIO 21',
    type: 'Digital Output',
    voltage: '5V via 220Ω',
    purpose: 'Visual confirmation: Helmet worn, driver sober, ignition ON',
    notes: 'Connect 220 Ohm current-limiting resistor to Ground'
  },
  {
    component: 'Red Hazard LED',
    pinName: 'Anode (+)',
    arduinoPin: 'D10',
    esp32Pin: 'GPIO 22',
    type: 'Digital Output',
    voltage: '5V via 220Ω',
    purpose: 'Hazard alert: Alcohol detected or helmet removed',
    notes: 'Flashes in sync with the buzzer alarm'
  },
  {
    component: 'Yellow Warning LED',
    pinName: 'Anode (+)',
    arduinoPin: 'D11',
    esp32Pin: 'GPIO 23',
    type: 'Digital Output',
    voltage: '5V via 220Ω',
    purpose: 'Driver Stress Warning: Heart rate > 100 BPM or high GSR',
    notes: 'Prompts rider to take a break or reduce riding speed'
  },
  {
    component: '16x2 LCD Display (I2C)',
    pinName: 'SDA (Data)',
    arduinoPin: 'A4',
    esp32Pin: 'GPIO 21 (I2C SDA)',
    type: 'I2C Bus',
    voltage: '5V VCC',
    purpose: 'Transmits character screen data over 2-wire serial bus',
    notes: 'PCF8574 I2C expander module address typically 0x27 or 0x3F'
  },
  {
    component: '16x2 LCD Display (I2C)',
    pinName: 'SCL (Clock)',
    arduinoPin: 'A5',
    esp32Pin: 'GPIO 22 (I2C SCL)',
    type: 'I2C Bus',
    voltage: '5V VCC',
    purpose: 'I2C synchronizing clock signal',
    notes: 'Standard 100 kHz bus clock'
  }
];

export const PinoutSchematic: React.FC = () => {
  const [boardType, setBoardType] = useState<'arduino' | 'esp32'>('arduino');
  const [filterComponent, setFilterComponent] = useState<string>('all');

  const filteredPins = PIN_DATA.filter(p => {
    if (filterComponent === 'all') return true;
    if (filterComponent === 'sensors') return p.type.includes('Input');
    if (filterComponent === 'actuators') return p.type.includes('Output');
    if (filterComponent === 'bus') return p.type.includes('I2C') || p.type.includes('Serial');
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            HARDWARE PINOUT & WIRING MATRIX
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Complete electrical pin mappings, voltage levels, signal characteristics, and power design.
          </p>
        </div>

        {/* Board Target Selector */}
        <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button 
            onClick={() => setBoardType('arduino')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              boardType === 'arduino' 
                ? 'bg-cyan-500 text-slate-950 shadow' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Arduino Uno / Nano
          </button>
          <button 
            onClick={() => setBoardType('esp32')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              boardType === 'esp32' 
                ? 'bg-cyan-500 text-slate-950 shadow' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ESP32 Wi-Fi / Bluetooth
          </button>
        </div>
      </div>

      {/* Schematic Overview Block Diagram */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          SYSTEM CIRCUIT SCHEMATIC DIAGRAM
        </h3>

        <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 overflow-x-auto font-mono text-xs text-slate-300">
          <pre className="text-cyan-300 leading-relaxed">
{`+------------------------------------------------------------------------------------+
|                               SMART HELMET ARCHITECTURE                            |
+------------------------------------------------------------------------------------+
|                                                                                    |
|  [MQ-3 Alcohol Sensor] ---> Pin A0 (ADC)                                           |
|  [Pulse Heart Rate]   ---> Pin A1 (ADC)                                            |
|  [GSR Stress Sensor]  ---> Pin A2 (ADC)                                            |
|  [Battery Divider A3] ---> Pin A3 (ADC 10k/10k)                                    |
|  [Optical IR Sensor]  ---> Pin D2 (EXT INT 0) ---> [ARDUINO UNO] ---> [USB Serial] |
|  [NEO-6M GPS TX]      ---> Pin D4 (Soft RX)             |             (115200 Baud)|
|  [NEO-6M GPS RX]      <--- Pin D3 (Soft TX)             |                   |      |
|  [16x2 LCD SDA]       <--> Pin A4 (I2C SDA)             |                   v      |
|  [16x2 LCD SCL]       <--> Pin A5 (I2C SCL)             |             [PYTHON FLASK|
|                                                         |              GATEWAY &   |
|  [Piezo Buzzer 2.4k]  <--- Pin D7 (Tone Out)            |              DASHBOARD]  |
|  [Ignition Relay]     <--- Pin D8 (Relay Interlock) <---+                          |
|  [Status LEDs (G,R,Y)]<--- Pins D9, D10, D11                                       |
|                                                                                    |
+------------------------------------------------------------------------------------+`}
          </pre>
        </div>

        {/* Electrical Notes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Power Supply Budget
            </span>
            <p className="text-slate-400 leading-relaxed">
              MQ-3 heater requires ~150mA @ 5V. Use external 9V/12V 1A DC adapter or 5V 2A battery bank with common Ground rail.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="font-bold text-cyan-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              3.3V Logic Level Protection
            </span>
            <p className="text-slate-400 leading-relaxed">
              NEO-6M GPS RX is 3.3V tolerant. When driving GPS RX from Arduino D3, insert a 1kΩ / 2kΩ resistor voltage divider.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Relay Isolation
            </span>
            <p className="text-slate-400 leading-relaxed">
              The 1-channel relay module includes optocoupler isolation to protect MCU from inductive vehicle starter coil flyback voltage.
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white">COMPLETE COMPONENT PINOUT ASSIGNMENTS</h3>
          
          <div className="flex gap-1.5">
            {['all', 'sensors', 'actuators', 'bus'].map(f => (
              <button
                key={f}
                onClick={() => setFilterComponent(f)}
                className={`text-xs px-2.5 py-1 rounded-lg capitalize transition ${
                  filterComponent === f
                    ? 'bg-slate-800 text-cyan-400 font-semibold border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Pinout Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono">
                <th className="p-3.5">Component</th>
                <th className="p-3.5">Pin Name</th>
                <th className="p-3.5 text-cyan-400">
                  {boardType === 'arduino' ? 'Arduino Pin' : 'ESP32 Pin'}
                </th>
                <th className="p-3.5">Signal Type</th>
                <th className="p-3.5">Operating Voltage</th>
                <th className="p-3.5">Function & Implementation Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-sans">
              {filteredPins.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="p-3.5 font-semibold text-white">{row.component}</td>
                  <td className="p-3.5 font-mono text-slate-300">{row.pinName}</td>
                  <td className="p-3.5 font-mono font-bold text-cyan-400">
                    {boardType === 'arduino' ? row.arduinoPin : row.esp32Pin}
                  </td>
                  <td className="p-3.5 text-slate-400">{row.type}</td>
                  <td className="p-3.5 font-mono text-slate-300">{row.voltage}</td>
                  <td className="p-3.5 text-slate-400">
                    <span className="text-slate-200 block font-medium">{row.purpose}</span>
                    <span className="text-[11px] text-slate-500">{row.notes}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
