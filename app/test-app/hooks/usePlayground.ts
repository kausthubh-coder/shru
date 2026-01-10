"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { 
  PlaygroundConfig, 
  PlannerConfig, 
  PlaygroundArchitecture,
  SpaceContext,
} from "../agents/types";
import { DEFAULT_PLAYGROUND_CONFIG } from "../agents/types";
import { 
  PlaygroundEventBus, 
  createEventBus, 
  type PlaygroundEvent 
} from "../lib/eventBus";
import { buildVoiceInstructions } from "../agents/voice/config";
import { handleSpeechEnd, shouldUsePlanner } from "../agents/voice/bridge";
import { gatherSpaceContext } from "../agents/planner/agent";
import type { AgentRuntime } from "../types/toolContracts";

export interface UsePlaygroundReturn {
  // Config
  config: PlaygroundConfig;
  updateConfig: (updates: Partial<PlaygroundConfig>) => void;
  updatePlannerConfig: (updates: Partial<PlannerConfig>) => void;

  // Event bus
  eventBus: PlaygroundEventBus;
  events: PlaygroundEvent[];
  clearEvents: () => void;
  exportEvents: () => string;

  // Voice agent state
  agentStatus: "disconnected" | "connecting" | "connected";
  setAgentStatus: (status: "disconnected" | "connecting" | "connected") => void;
  userSpeaking: boolean;
  setUserSpeaking: (speaking: boolean) => void;
  agentSpeaking: boolean;
  setAgentSpeaking: (speaking: boolean) => void;

  // Planner integration
  handleUserSpeechEnd: (transcript: string, runtime: AgentRuntime) => Promise<void>;
  lastPlannerResponse: string | null;

  // Context
  gatherContext: (runtime: AgentRuntime) => SpaceContext;
}

export function usePlayground(): UsePlaygroundReturn {
  // Configuration state
  const [config, setConfig] = useState<PlaygroundConfig>(DEFAULT_PLAYGROUND_CONFIG);

  // Event bus (singleton per hook instance)
  const eventBusRef = useRef<PlaygroundEventBus | null>(null);
  if (!eventBusRef.current) {
    eventBusRef.current = createEventBus();
  }
  const eventBus = eventBusRef.current;

  // Events state (for UI)
  const [events, setEvents] = useState<PlaygroundEvent[]>([]);

  // Voice agent state
  const [agentStatus, setAgentStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  // Planner state
  const [lastPlannerResponse, setLastPlannerResponse] = useState<string | null>(null);

  // Subscribe to all events for UI updates
  useEffect(() => {
    const unsub = eventBus.onAll((event) => {
      setEvents((prev) => [event, ...prev].slice(0, 500));
    });
    return unsub;
  }, [eventBus]);

  // Update config
  const updateConfig = useCallback((updates: Partial<PlaygroundConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      
      // Update voice instructions when architecture changes
      if (updates.architecture && updates.architecture !== prev.architecture) {
        next.voice = {
          ...next.voice,
          instructions: buildVoiceInstructions(updates.architecture),
        };
        eventBus.emit("playground:architecture_changed", { architecture: updates.architecture });
      }
      
      return next;
    });
  }, [eventBus]);

  // Update planner config
  const updatePlannerConfig = useCallback((updates: Partial<PlannerConfig>) => {
    setConfig((prev) => ({
      ...prev,
      planner: { ...prev.planner, ...updates },
    }));
  }, []);

  // Clear events
  const clearEvents = useCallback(() => {
    eventBus.clearLog();
    setEvents([]);
  }, [eventBus]);

  // Export events
  const exportEvents = useCallback(() => {
    return eventBus.exportLog();
  }, [eventBus]);

  // Handle user speech end - main bridge to planner
  const handleUserSpeechEnd = useCallback(async (transcript: string, runtime: AgentRuntime) => {
    eventBus.emit("voice:speech_end", { transcript });

    // In split_planner mode, check if we should use planner
    if (config.architecture === "split_planner" && shouldUsePlanner(transcript)) {
      const result = await handleSpeechEnd(transcript, {
        architecture: config.architecture,
        plannerConfig: config.planner,
        runtime,
        eventBus,
        onPlannerResponse: (text) => {
          setLastPlannerResponse(text);
        },
        appendLog: (line) => console.log("[playground]", line),
      });

      if (result.handled && result.responseText) {
        setLastPlannerResponse(result.responseText);
      }
    }
  }, [config.architecture, config.planner, eventBus]);

  // Gather context from runtime
  const gatherContext = useCallback((runtime: AgentRuntime): SpaceContext => {
    const context = gatherSpaceContext(runtime);
    
    eventBus.emit("context:gathered", {
      spaces: Object.keys(context).filter(k => context[k as keyof SpaceContext]) as any[],
      charCount: JSON.stringify(context).length,
      hasImage: !!context.whiteboard?.screenshot,
    });

    return context;
  }, [eventBus]);

  return {
    // Config
    config,
    updateConfig,
    updatePlannerConfig,

    // Event bus
    eventBus,
    events,
    clearEvents,
    exportEvents,

    // Voice agent state
    agentStatus,
    setAgentStatus,
    userSpeaking,
    setUserSpeaking,
    agentSpeaking,
    setAgentSpeaking,

    // Planner integration
    handleUserSpeechEnd,
    lastPlannerResponse,

    // Context
    gatherContext,
  };
}
