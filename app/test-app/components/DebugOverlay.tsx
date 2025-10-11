"use client";

export type DebugOverlayProps = {
  visible: boolean;
  onClose: () => void;
  initialTab?: 'logs' | 'context' | 'calls';
  logs: Array<string>;
  debugContext: { text?: string; imageUrl?: string | null; ts: number } | null;
  toolEvents: Array<{ ts: number; rid: string; name: string; status: 'start'|'done'|'error'; args?: any; result?: any; ms?: number; err?: string }>;
};

import { useState, useEffect } from "react";

export function DebugOverlay({ visible, onClose, initialTab = 'logs', logs, debugContext, toolEvents }: DebugOverlayProps) {
  const [tab, setTab] = useState<'logs'|'context'|'calls'>(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="absolute right-4 top-4 w-[480px] max-h-[80vh] rounded-xl border border-white/20 dark:border-white/10 bg-white/30 dark:bg-slate-900/40 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="h-10 px-3 flex items-center justify-between border-b border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-900/30">
          <div className="flex items-center gap-2 text-sm">
            <button className={`px-2 py-1 rounded ${tab==='logs'?'bg-emerald-500/20 text-emerald-200 border-emerald-400/40':'border-white/20 dark:border-white/10 bg-white/10 dark:bg-slate-800/40'}`} onClick={() => setTab('logs')}>Logs</button>
            <button className={`px-2 py-1 rounded ${tab==='context'?'bg-violet-500/20 text-violet-200 border-violet-400/40':'border-white/20 dark:border-white/10 bg-white/10 dark:bg-slate-800/40'}`} onClick={() => setTab('context')}>Context</button>
            <button className={`px-2 py-1 rounded ${tab==='calls'?'bg-cyan-500/20 text-cyan-200 border-cyan-400/40':'border-white/20 dark:border-white/10 bg-white/10 dark:bg-slate-800/40'}`} onClick={() => setTab('calls')}>Calls</button>
          </div>
          <button className="text-xs px-2 py-1 rounded border border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/40 hover:bg-white/40 dark:hover:bg-slate-800/60" onClick={onClose}>Close</button>
        </div>
        <div className="p-2 h-[calc(80vh-2.5rem)] overflow-auto">
          {tab === 'logs' && (
            <ul className="text-xs space-y-1">
              {logs.map((l, i) => (<li key={i}>{l}</li>))}
            </ul>
          )}
          {tab === 'context' && (
            <div className="space-y-2 text-xs">
              <div className="text-[11px] text-slate-500">Last sent: {debugContext ? new Date(debugContext.ts).toLocaleTimeString() : '—'}</div>
              <div>
                <div className="font-medium mb-1">view_context (JSON)</div>
                <pre className="whitespace-pre-wrap break-words">{debugContext?.text ?? '—'}</pre>
              </div>
              <div>
                <div className="font-medium mb-1">viewport image</div>
                {debugContext?.imageUrl ? (
                  <img src={debugContext.imageUrl} alt="viewport" className="w-full border rounded" />
                ) : (
                  <div className="text-slate-500">—</div>
                )}
              </div>
            </div>
          )}
          {tab === 'calls' && (
            <ul className="text-xs space-y-1">
              {toolEvents.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[10px] text-slate-500">{new Date(e.ts).toLocaleTimeString()}</span>
                  <span className={`text-[10px] ${e.status==='error' ? 'text-red-600' : e.status==='done' ? 'text-emerald-600' : 'text-slate-700'}`}>{e.status}</span>
                  <span className="text-[10px] font-mono">{e.name}</span>
                  {typeof e.ms === 'number' && <span className="text-[10px] text-slate-500">{e.ms}ms</span>}
                  <span className="text-[10px] text-slate-500">rid={e.rid}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}


