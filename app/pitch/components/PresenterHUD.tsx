"use client";

import React, { useEffect, useState } from "react";

export default function PresenterHUD({ current, total, mode }: { current: number; total: number; mode: "scroll" | "presentation" }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const pct = total > 1 ? Math.max(0, Math.min(1, current / (total - 1))) : 0;
  const deg = Math.round(pct * 360);

  return (
    <div className="fixed right-4 top-3 z-[60] flex items-center gap-3 text-black">
      <div className="hidden md:flex items-center gap-2 rounded-full border border-black/15 bg-white/80 px-3 py-1 shadow-sm">
        <span className="text-xs">{mode === 'presentation' ? 'Presentation' : 'Scroll'}</span>
        <span className="text-xs text-black/50">|</span>
        <span className="text-xs">{elapsed}s</span>
      </div>
      <div className="grid place-items-center">
        <div
          aria-label={`progress ${Math.round(pct * 100)}%`}
          className="h-7 w-7 rounded-full border border-black/10"
          style={{
            background: `conic-gradient(#000 ${deg}deg, rgba(0,0,0,0.08) 0deg)`,
          }}
        />
        <div className="-mt-7 text-[10px] text-white w-7 h-7 grid place-items-center pointer-events-none">
          <span className="px-1 py-0.5 rounded-full bg-black/70">{current + 1}/{total}</span>
        </div>
      </div>
    </div>
  );
}


