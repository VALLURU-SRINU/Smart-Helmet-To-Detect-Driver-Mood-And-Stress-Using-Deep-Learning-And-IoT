import React, { useState } from 'react';
import { 
  FileCode, 
  Copy, 
  Check, 
  Download, 
  FileText, 
  Folder, 
  Terminal, 
  FileCheck,
  Package
} from 'lucide-react';
import { PROJECT_FILES, ProjectFile } from '../data/projectFiles';

export const CodeViewer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<ProjectFile>(PROJECT_FILES[0]);
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFile.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    // Generate combined bundle
    let fullBundle = `================================================================================
SMART HELMET TO DETECT DRIVER MOOD & STRESS USING IOT - COMPLETE REPOSITORY
Exported: ${new Date().toISOString()}
================================================================================\n\n`;

    PROJECT_FILES.forEach(file => {
      fullBundle += `\n################################################################################\n`;
      fullBundle += `# FILE: ${file.path}\n`;
      fullBundle += `# CATEGORY: ${file.category} | ${file.description}\n`;
      fullBundle += `################################################################################\n\n`;
      fullBundle += file.content;
      fullBundle += `\n\n`;
    });

    const blob = new Blob([fullBundle], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'smart_helmet_iot_project_bundle.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileCode className="w-5 h-5 text-cyan-400" />
            PROJECT SOURCE CODE & REPOSITORY EXPLORER
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Browse, inspect, and export all production-grade firmware, backend scripts, web dashboard, and hardware specs.
          </p>
        </div>

        <button 
          onClick={handleDownloadAll}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-950/40 transition cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Export All Files (Text Bundle)
        </button>
      </div>

      {/* Main Split View: Left File Explorer / Right Code View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left Sidebar: Repository Tree */}
        <div className="lg:col-span-1 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Folder className="w-4 h-4 text-cyan-400" />
              <span>REPOSITORY STRUCTURE</span>
            </div>

            <div className="space-y-1">
              {PROJECT_FILES.map(file => {
                const isSelected = selectedFile.path === file.path;
                return (
                  <button
                    key={file.path}
                    onClick={() => {
                      setSelectedFile(file);
                      setCopied(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition flex items-center gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-semibold'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    {file.language === 'cpp' && <FileCode className="w-4 h-4 text-amber-400 shrink-0" />}
                    {file.language === 'python' && <Terminal className="w-4 h-4 text-blue-400 shrink-0" />}
                    {file.language === 'html' && <FileCode className="w-4 h-4 text-orange-400 shrink-0" />}
                    {file.language === 'plaintext' && <Package className="w-4 h-4 text-purple-400 shrink-0" />}
                    {file.language === 'markdown' && <FileText className="w-4 h-4 text-emerald-400 shrink-0" />}
                    
                    <div className="truncate">
                      <div className="font-mono truncate">{file.filename}</div>
                      <div className="text-[10px] text-slate-500 truncate">{file.path}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Setup Checklist */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
            <span className="font-bold text-white flex items-center gap-1.5 text-xs">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              Arduino Libraries Needed:
            </span>
            <ul className="space-y-1 text-slate-400 text-[11px] list-disc list-inside">
              <li><code className="text-cyan-300">LiquidCrystal_I2C</code> (0x27)</li>
              <li><code className="text-cyan-300">TinyGPSPlus</code> (NEO-6M)</li>
              <li><code className="text-cyan-300">SoftwareSerial</code> (Built-in)</li>
              <li><code className="text-cyan-300">Wire</code> (I2C Built-in)</li>
            </ul>
          </div>
        </div>

        {/* Right Code Display Area */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden flex flex-col">
            
            {/* Top Code File Header */}
            <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-cyan-400 font-bold">
                  {selectedFile.path}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono uppercase">
                  {selectedFile.language}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Code'}</span>
                </button>
                <button
                  onClick={handleDownloadFile}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* Description Sub-banner */}
            <div className="px-5 py-2 bg-slate-950/40 border-b border-slate-800/80 text-xs text-slate-400">
              {selectedFile.description}
            </div>

            {/* Code Content Area with Line Numbers */}
            <div className="p-4 bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-[640px] leading-relaxed select-text">
              <table className="w-full border-collapse">
                <tbody>
                  {selectedFile.content.split('\n').map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/60">
                      <td className="w-12 text-right pr-4 text-slate-600 select-none text-[11px] align-top">
                        {idx + 1}
                      </td>
                      <td className="whitespace-pre pl-2 text-slate-300">
                        {line || ' '}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
