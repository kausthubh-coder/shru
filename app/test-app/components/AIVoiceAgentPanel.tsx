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
}) {
  const [devOpen, setDevOpen] = useState(false);
  const speaking = agentSpeaking || userSpeaking;
  const level = agentSpeaking ? Math.min(1, outputLevel * 6) : Math.min(1, inputLevel * 6);
  const bubbleClass = speaking
    ? "bg-gradient-to-r from-blue-500 to-cyan-500"
    : (userSpeaking ? "bg-gradient-to-r from-rose-500 to-orange-500" : "bg-slate-300");
  const bubbleSize = 14 + Math.round(level * 18);

  return (
    <div className="rounded-xl border border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-900/30 backdrop-blur-xl shadow-2xl p-3 w-[340px] relative">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-cyan-400">AI Voice Agent</div>
        <span className={`inline-flex items-center gap-1 text-[10px] ${agentStatus === 'connected' ? 'text-emerald-500' : agentStatus === 'connecting' ? 'text-amber-500' : 'text-slate-400'}`}>
          <span className={`inline-block w-2 h-2 rounded-full ${agentStatus === 'connected' ? 'bg-emerald-500' : agentStatus === 'connecting' ? 'bg-amber-500' : 'bg-slate-400'}`} />
          {agentStatus}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {agentStatus !== "connected" ? (
            <button className="px-3 py-1.5 rounded-md text-white text-xs bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600" onClick={startAgent}>Start</button>
          ) : (
            <>
              <button className="px-3 py-1.5 rounded-md border border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/40 text-xs hover:bg-white/40 dark:hover:bg-slate-800/60" onClick={stopAgent}>Stop</button>
              <button className="px-3 py-1.5 rounded-md border border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/40 text-xs hover:bg-white/40 dark:hover:bg-slate-800/60" onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
            </>
          )}
        </div>
        <div className="relative">
          <button
            className="px-3 py-1.5 rounded-md border border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/40 text-xs hover:bg-white/40 dark:hover:bg-slate-800/60"
            onClick={() => setDevOpen((v) => !v)}
          >
            Dev Controls
          </button>
          {devOpen && (
            <div className="absolute right-0 bottom-9 w-56 max-h-[50vh] overflow-auto rounded-lg border border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl p-2 z-10">
              <div className="text-[11px] text-slate-600 dark:text-slate-300 px-1 pb-1">Toggles</div>
              <div className="grid gap-1">
                <button
                  className={`text-[11px] px-2 py-1 rounded border ${showLogs ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' : 'border-white/20 dark:border-white/10 bg-white/10 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100'}`}
                  onClick={() => setShowLogs((v) => !v)}
                >
                  {showLogs ? 'Hide Logs' : 'Show Logs'}
                </button>
                <button
                  className={`text-[11px] px-2 py-1 rounded border ${showContext ? 'bg-violet-500/20 border-violet-400/40 text-violet-200' : 'border-white/20 dark:border-white/10 bg-white/10 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100'}`}
                  onClick={() => setShowContext((v) => !v)}
                >
                  {showContext ? 'Hide Context' : 'Show Context'}
                </button>
                <button
                  className={`text-[11px] px-2 py-1 rounded border ${showCalls ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200' : 'border-white/20 dark:border-white/10 bg-white/10 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100'}`}
                  onClick={() => setShowCalls((v) => !v)}
                >
                  {showCalls ? 'Hide Calls' : 'Show Calls'}
                </button>
              </div>
              <div className="mt-2 border-t border-white/20 dark:border-white/10 pt-2">
                <div className="text-[11px] text-slate-600 dark:text-slate-300 px-1 pb-1">Audio Devices</div>
                <label className="block text-[10px] px-1">Microphone</label>
                <select className="w-full text-[11px] px-2 py-1 rounded border border-white/20 dark:border-white/10 bg-white/10 dark:bg-slate-800/40" value={selectedInputId} onChange={(e) => setSelectedInputId(e.target.value)}>
                  <option value="">System default</option>
                  {inputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
                  ))}
                </select>
                <label className="block text-[10px] px-1 mt-2">Speaker</label>
                <select className="w-full text-[11px] px-2 py-1 rounded border border-white/20 dark:border-white/10 bg-white/10 dark:bg-slate-800/40" value={selectedOutputId} onChange={(e) => setSelectedOutputId(e.target.value)}>
                  <option value="">System default</option>
                  {outputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
                  ))}
                </select>
                <div className="mt-2 flex items-center justify-between">
                  <button className="text-[11px] px-2 py-1 rounded border border-white/20 dark:border-white/10 bg-white/10 dark:bg-slate-800/40 hover:bg-white/20 dark:hover:bg-slate-800/60" onClick={playTestTone}>Play test tone</button>
                </div>
              </div>
              <div className="mt-2 border-t border-white/20 dark:border-white/10 pt-2">
                <div className="text-[11px] text-slate-600 dark:text-slate-300 px-1 pb-1">Turn Detection</div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px]">Push‑to‑talk</span>
                  <input type="checkbox" className="accent-emerald-500" checked={pushToTalk} onChange={(e) => setPushToTalk(e.target.checked)} />
                </div>
                <label className="block text-[10px] px-1">VAD eagerness</label>
                <select className="w-full text-[11px] px-2 py-1 rounded border border-white/20 dark:border-white/10 bg-white/10 dark:bg-slate-800/40" value={vadEagerness} onChange={(e) => setVadEagerness(e.target.value as any)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          )}
        </div>
        <div className="grid place-items-center">
          <div className={`rounded-full transition-all ${bubbleClass}`} style={{ width: `${bubbleSize}px`, height: `${bubbleSize}px` }} />
        </div>
      </div>
      {toolBusy && (
        <div className="mt-2 flex items-center justify-start text-[11px] text-slate-600 dark:text-slate-300">
          <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 mr-2" />
          Running tool…
        </div>
      )}
    </div>
  );
}


