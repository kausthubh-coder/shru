"use client";

import { useState } from "react";

export function AIVoiceAgentPanel({
  agentStatus,
  startAgent,
  stopAgent,
  muted,
  toggleMute,
  toolBusy,
  inputLevel,
  outputLevel,
  agentSpeaking,
  userSpeaking,
  showLogs,
  setShowLogs,
  showContext,
  setShowContext,
  showCalls,
  setShowCalls,
  inputDevices,
  outputDevices,
  selectedInputId,
  setSelectedInputId,
  selectedOutputId,
  setSelectedOutputId,
  playTestTone,
  pushToTalk,
  setPushToTalk,
  vadEagerness,
  setVadEagerness,
  className = "",
}: {
  agentStatus: "disconnected" | "connecting" | "connected";
  startAgent: () => Promise<void> | void;
  stopAgent: () => Promise<void> | void;
  muted: boolean;
  toggleMute: () => void;
  toolBusy: boolean;
  inputLevel: number;
  outputLevel: number;
  agentSpeaking: boolean;
  userSpeaking: boolean;
  showLogs: boolean;
  setShowLogs: (v: (prev: boolean) => boolean) => void;
  showContext: boolean;
  setShowContext: (v: (prev: boolean) => boolean) => void;
  showCalls: boolean;
  setShowCalls: (v: (prev: boolean) => boolean) => void;
  inputDevices: Array<MediaDeviceInfo>;
  outputDevices: Array<MediaDeviceInfo>;
  selectedInputId: string;
  setSelectedInputId: (id: string) => void;
  selectedOutputId: string;
  setSelectedOutputId: (id: string) => void;
  playTestTone: () => void;
  pushToTalk: boolean;
  setPushToTalk: (v: boolean) => void;
  vadEagerness: 'low'|'medium'|'high';
  setVadEagerness: (v: 'low'|'medium'|'high') => void;
  className?: string;
}) {
  const [devOpen, setDevOpen] = useState(false);
  const speaking = agentSpeaking || userSpeaking;
  const level = agentSpeaking ? Math.min(1, outputLevel * 6) : Math.min(1, inputLevel * 6);
  const bubbleClass = speaking
    ? "bg-gradient-to-r from-blue-500 to-cyan-500"
    : (userSpeaking ? "bg-gradient-to-r from-rose-500 to-orange-500" : "bg-slate-300");
  const bubbleSize = 14 + Math.round(level * 18);

  return (
    <div className={`relative flex items-center gap-4 ${className}`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${agentStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : agentStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'}`} />
        
        {agentStatus !== "connected" ? (
          <button 
            className="px-4 py-2 rounded-full bg-[#1A1A1A] text-[#F2F1EA] text-xs font-medium hover:bg-black transition-all shadow-sm hover:shadow-md whitespace-nowrap" 
            onClick={startAgent}
          >
            Connect Agent
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-white/60 border border-black/5 rounded-full p-1 pr-2 shadow-sm">
            <button 
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${muted ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`} 
              onClick={toggleMute}
            >
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <button 
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-black/5 text-rose-600 hover:bg-rose-50 transition-colors" 
              onClick={stopAgent}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          className="p-2 rounded-full hover:bg-black/5 transition-colors text-slate-500 hover:text-slate-900"
          onClick={() => setDevOpen((v) => !v)}
          title="Developer Controls"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="currentColor"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M19.4 15C19.7806 14.0685 20 13.0558 20 12C20 10.9442 19.7806 9.93154 19.4 9H21.9442C21.9812 9.98559 22 10.9856 22 12C22 13.0144 21.9812 14.0144 21.9442 15H19.4ZM4.6 15C4.21943 14.0685 4 13.0558 4 12C4 10.9442 4.21943 9.93154 4.6 9H2.05576C2.01884 9.98559 2 10.9856 2 12C2 13.0144 2.01884 14.0144 2.05576 15H4.6ZM15 19.4C14.0685 19.7806 13.0558 20 12 20C10.9442 20 9.93154 19.7806 9 19.4V21.9442C9.98559 21.9812 10.9856 22 12 22C13.0144 22 14.0144 21.9812 15 21.9442V19.4ZM15 4.6C14.0685 4.21943 13.0558 4 12 4C10.9442 4 9.93154 4.21943 9 4.6V2.05576C9.98559 2.01884 10.9856 2 12 2C13.0144 2 14.0144 2.01884 15 2.05576V4.6Z" fill="currentColor"/>
          </svg>
        </button>
        {devOpen && (
          <div className="absolute right-0 bottom-full mb-2 w-64 max-h-[60vh] overflow-auto rounded-xl border border-black/10 bg-white/95 backdrop-blur-xl shadow-2xl p-3 z-50 text-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Controls</div>
              <div className="grid gap-1.5 mb-3">
                <button
                  className={`text-xs px-3 py-2 rounded-lg border flex items-center justify-between ${showLogs ? 'bg-slate-100 border-slate-300 text-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  onClick={() => setShowLogs((v) => !v)}
                >
                  <span>Show Logs</span>
                  <span className={`w-2 h-2 rounded-full ${showLogs ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                </button>
                <button
                  className={`text-xs px-3 py-2 rounded-lg border flex items-center justify-between ${showContext ? 'bg-slate-100 border-slate-300 text-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  onClick={() => setShowContext((v) => !v)}
                >
                  <span>Show Context</span>
                  <span className={`w-2 h-2 rounded-full ${showContext ? 'bg-violet-500' : 'bg-slate-300'}`} />
                </button>
                <button
                  className={`text-xs px-3 py-2 rounded-lg border flex items-center justify-between ${showCalls ? 'bg-slate-100 border-slate-300 text-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  onClick={() => setShowCalls((v) => !v)}
                >
                  <span>Show Tool Calls</span>
                  <span className={`w-2 h-2 rounded-full ${showCalls ? 'bg-cyan-500' : 'bg-slate-300'}`} />
                </button>
              </div>
              
              <div className="border-t border-slate-200 pt-3 mb-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Audio</div>
                <label className="block text-[10px] text-slate-500 mb-1 px-1">Microphone</label>
                <select className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-black/5 outline-none" value={selectedInputId} onChange={(e) => setSelectedInputId(e.target.value)}>
                  <option value="">System default</option>
                  {inputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
                  ))}
                </select>
                <label className="block text-[10px] text-slate-500 mt-2 mb-1 px-1">Speaker</label>
                <select className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-black/5 outline-none" value={selectedOutputId} onChange={(e) => setSelectedOutputId(e.target.value)}>
                  <option value="">System default</option>
                  {outputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
                  ))}
                </select>
                <button className="mt-2 w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors" onClick={playTestTone}>Play test tone</button>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Settings</div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs text-slate-700">Push‑to‑talk</span>
                  <input type="checkbox" className="accent-black" checked={pushToTalk} onChange={(e) => setPushToTalk(e.target.checked)} />
                </div>
                <label className="block text-[10px] text-slate-500 mb-1 px-1">VAD Sensitivity</label>
                <select className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-black/5 outline-none" value={vadEagerness} onChange={(e) => setVadEagerness(e.target.value as any)}>
                  <option value="low">Low (Quiet env)</option>
                  <option value="medium">Medium</option>
                  <option value="high">High (Noisy env)</option>
                </select>
              </div>
            </div>
          )}
        </div>
        <div className="grid place-items-center w-8 h-8">
          <div className={`rounded-full transition-all duration-300 ${bubbleClass}`} style={{ width: `${bubbleSize}px`, height: `${bubbleSize}px` }} />
        </div>
      
      {toolBusy && (
        <div className="absolute -top-8 right-0 bg-white/90 backdrop-blur px-2 py-1 rounded-md shadow-sm border border-black/5 text-[10px] text-slate-600 flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          Thinking...
        </div>
      )}
    </div>
  );
}
