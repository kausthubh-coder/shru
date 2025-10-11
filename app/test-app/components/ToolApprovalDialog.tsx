"use client";

export function ToolApprovalDialog({ open, onApprove, onReject, message }: { open: boolean; onApprove: () => void; onReject: () => void; message: string; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onReject} />
      <div className="relative w-[380px] rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl shadow-2xl p-4">
        <div className="text-sm font-medium mb-2">Confirm action</div>
        <div className="text-xs text-slate-600 dark:text-slate-300 mb-3">{message}</div>
        <div className="flex items-center gap-2 justify-end">
          <button className="text-xs px-3 py-1.5 rounded-md border border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/40 hover:bg-white/40 dark:hover:bg-slate-800/60" onClick={onReject}>Cancel</button>
          <button className="text-xs px-3 py-1.5 rounded-md text-white bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600" onClick={onApprove}>Proceed</button>
        </div>
      </div>
    </div>
  );
}


