"use client";

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
  sessionCost,
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
  sessionCost?: { totalCostUsd: number; responseCount: number } | null;
}) {
  const speaking = agentSpeaking || userSpeaking;
  const level = agentSpeaking ? Math.min(1, outputLevel * 6) : Math.min(1, inputLevel * 6);
  // Cleaner, flatter colors for better readability
  const bubbleClass = speaking
    ? "bg-blue-500 shadow-lg shadow-blue-500/30"
    : (userSpeaking ? "bg-amber-500 shadow-lg shadow-amber-500/30" : "bg-neutral-400 dark:bg-neutral-600");
  const bubbleSize = 12 + Math.round(level * 16);

  // Format cost display
  const formatCost = (amount: number) => {
    if (amount < 0.01) return `$${amount.toFixed(4)}`;
    return `$${amount.toFixed(2)}`;
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl">
      {/* Status Dot */}
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${agentStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
            agentStatus === 'connecting' ? 'bg-amber-500 animate-pulse' :
              'bg-neutral-300 dark:bg-neutral-700'
          }`} />
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300 w-20">
          {agentStatus === 'connected' ? 'Connected' :
            agentStatus === 'connecting' ? 'Connecting...' :
              'Disconnected'}
        </span>
      </div>

      {/* Cost Display (when connected and has cost) */}
      {agentStatus === 'connected' && sessionCost && sessionCost.responseCount > 0 && (
        <>
          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {formatCost(sessionCost.totalCostUsd)}
            </span>
            <span className="text-neutral-400 dark:text-neutral-500">
              ({sessionCost.responseCount} {sessionCost.responseCount === 1 ? 'resp' : 'resps'})
            </span>
          </div>
        </>
      )}

      <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800" />

      {/* Controls */}
      <div className="flex items-center gap-2">
        {agentStatus !== "connected" ? (
          <button
            className="px-4 py-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity"
            onClick={startAgent}
          >
            Start Session
          </button>
        ) : (
          <>
            <button
              className={`p-2 rounded-full transition-colors ${muted
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              onClick={toggleMute}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
            <button
              className="px-4 py-1.5 rounded-full border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              onClick={stopAgent}
            >
              End
            </button>
          </>
        )}
      </div>

      {/* Visualizer */}
      <div className="w-8 h-8 grid place-items-center">
        <div
          className={`rounded-full transition-all duration-75 ease-out ${bubbleClass}`}
          style={{ width: `${bubbleSize}px`, height: `${bubbleSize}px` }}
        />
      </div>

      {toolBusy && (
        <div className="ml-2 flex items-center gap-1.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
          Thinking...
        </div>
      )}
    </div>
  );
}


