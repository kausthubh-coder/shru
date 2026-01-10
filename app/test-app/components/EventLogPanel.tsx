"use client";

import { useState, useEffect, useRef } from "react";
import type { PlaygroundEvent, PlaygroundEventType } from "../lib/eventBus";

interface EventLogPanelProps {
  events: PlaygroundEvent[];
  onClear: () => void;
  onExport: () => void;
  onClose: () => void;
}

const EVENT_COLORS: Record<string, string> = {
  voice: "text-blue-400",
  planner: "text-violet-400",
  tool: "text-cyan-400",
  context: "text-amber-400",
  playground: "text-slate-400",
};

const EVENT_ICONS: Record<string, string> = {
  "voice:connecting": "🔌",
  "voice:connected": "✓",
  "voice:disconnected": "✗",
  "voice:speech_start": "🎤",
  "voice:speech_end": "💬",
  "voice:agent_speaking": "🔊",
  "voice:error": "❌",
  "planner:start": "🧠",
  "planner:thinking": "💭",
  "planner:tool_call": "🔧",
  "planner:tool_result": "✅",
  "planner:done": "✓",
  "planner:error": "❌",
  "tool:start": "▶",
  "tool:done": "✓",
  "tool:error": "❌",
  "context:gathered": "📊",
  "context:sent": "📤",
};

function getEventCategory(type: PlaygroundEventType): string {
  return type.split(":")[0];
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString("en-US", { 
    hour12: false, 
    hour: "2-digit", 
    minute: "2-digit", 
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function formatEventData(data: Record<string, unknown>): string {
  const { ts, ...rest } = data;
  if (Object.keys(rest).length === 0) return "";
  
  const parts: string[] = [];
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null) continue;
    
    if (typeof value === "string") {
      const display = value.length > 60 ? value.slice(0, 60) + "..." : value;
      parts.push(`${key}="${display}"`);
    } else if (typeof value === "number") {
      parts.push(`${key}=${value}`);
    } else if (typeof value === "boolean") {
      parts.push(`${key}=${value}`);
    } else if (typeof value === "object") {
      const json = JSON.stringify(value);
      const display = json.length > 80 ? json.slice(0, 80) + "..." : json;
      parts.push(`${key}=${display}`);
    }
  }
  
  return parts.join(" ");
}

export function EventLogPanel({ events, onClear, onExport, onClose }: EventLogPanelProps) {
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length, autoScroll]);

  const filteredEvents = filter === "all" 
    ? events 
    : events.filter(e => getEventCategory(e.type) === filter);

  const toggleExpanded = (index: number) => {
    const next = new Set(expanded);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setExpanded(next);
  };

  return (
    <div className="h-full bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 flex flex-col">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 shrink-0">
        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Event Log
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              autoScroll ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
            }`}
          >
            {autoScroll ? "Auto Scroll" : "Paused"}
          </button>
          <button
            onClick={onExport}
            className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            title="Export Logs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
          <button
            onClick={onClear}
            className="text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400"
            title="Clear Logs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 flex gap-2 shrink-0 overflow-x-auto">
        {["all", "voice", "planner", "tool", "context"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 rounded text-[10px] font-medium capitalize transition-colors ${
              filter === f
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Event list */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-2 bg-neutral-50 dark:bg-neutral-950">
        {filteredEvents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500">
            <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            <p className="text-xs">No events logged</p>
          </div>
        ) : (
          filteredEvents.map((event, idx) => {
            const category = getEventCategory(event.type);
            const icon = EVENT_ICONS[event.type] || "•";
            const isExpanded = expanded.has(idx);
            const dataStr = formatEventData(event.data as Record<string, unknown>);

            return (
              <div
                key={idx}
                className="bg-white dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden"
              >
                <div 
                  className="px-3 py-2 flex items-start gap-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  onClick={() => toggleExpanded(idx)}
                >
                  <span className="text-[10px] text-neutral-400 font-mono mt-0.5 shrink-0">
                    {formatTimestamp((event.data as any).ts)}
                  </span>
                  <span className="text-xs shrink-0">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-medium ${EVENT_COLORS[category] || "text-neutral-600"}`}>
                      {event.type}
                    </div>
                    {!isExpanded && dataStr && (
                      <div className="text-[10px] text-neutral-500 truncate mt-0.5 font-mono">
                        {dataStr}
                      </div>
                    )}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-neutral-100 dark:border-neutral-800 mt-1">
                    <pre className="text-[10px] text-neutral-600 dark:text-neutral-300 font-mono whitespace-pre-wrap pt-2">
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
