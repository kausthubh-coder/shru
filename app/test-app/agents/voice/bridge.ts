"use client";

/**
 * Bridge between voice agent and planner agent
 * Handles the handoff when voice agent detects user speech end
 */

import type { PlaygroundEventBus } from "../../lib/eventBus";
import type { AgentRuntime } from "../../types/toolContracts";
import type { PlannerConfig, PlaygroundArchitecture } from "../types";
import { runPlanner, gatherSpaceContext } from "../planner/agent";

export interface VoicePlannerBridgeConfig {
  architecture: PlaygroundArchitecture;
  plannerConfig: PlannerConfig;
  runtime: AgentRuntime;
  eventBus: PlaygroundEventBus;
  onPlannerResponse: (text: string) => void;
  appendLog?: (line: string) => void;
}

/**
 * Handle user speech end - decide whether to use planner or let voice agent handle it
 */
export async function handleSpeechEnd(
  transcript: string,
  config: VoicePlannerBridgeConfig
): Promise<{ handled: boolean; responseText?: string }> {
  const { architecture, plannerConfig, runtime, eventBus, onPlannerResponse, appendLog } = config;

  // In realtime_tools mode, let the voice agent handle everything
  if (architecture === "realtime_tools") {
    appendLog?.("[bridge] realtime_tools mode - voice agent handles tools directly");
    return { handled: false };
  }

  // In split_planner mode, route to planner agent
  if (architecture === "split_planner") {
    appendLog?.(`[bridge] split_planner mode - routing to planner: "${transcript.slice(0, 100)}..."`);

    try {
      // Gather current space context
      const context = gatherSpaceContext(runtime);
      
      eventBus.emit("context:gathered", {
        spaces: Object.keys(context) as any[],
        charCount: JSON.stringify(context).length,
        hasImage: !!context.whiteboard?.screenshot,
      });

      // Run the planner
      const result = await runPlanner({
        intent: transcript,
        context,
        config: plannerConfig,
        runtime,
        eventBus,
      });

      if (result.success) {
        appendLog?.(`[bridge] planner completed: ${result.toolCalls.length} tools, ${result.durationMs}ms`);
        onPlannerResponse(result.text);
        return { handled: true, responseText: result.text };
      } else {
        appendLog?.(`[bridge] planner error: ${result.error}`);
        return { handled: false };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      appendLog?.(`[bridge] planner exception: ${msg}`);
      eventBus.emit("planner:error", { error: msg });
      return { handled: false };
    }
  }

  // specialists mode - future implementation
  if (architecture === "specialists") {
    appendLog?.("[bridge] specialists mode - not yet implemented");
    return { handled: false };
  }

  return { handled: false };
}

/**
 * Determine if an intent requires planner intervention
 * Simple heuristics to decide if we should route to planner
 */
export function shouldUsePlanner(transcript: string): boolean {
  const lowerTranscript = transcript.toLowerCase();
  
  // Keywords that suggest tool usage
  const toolKeywords = [
    "draw", "create", "add", "make", "write", "code", "run", "execute",
    "show", "demonstrate", "visualize", "diagram", "flowchart", "chart",
    "move", "delete", "clear", "update", "change", "modify",
    "note", "notes", "lesson", "explain", "teach",
    "file", "save", "open", "python", "javascript",
  ];

  return toolKeywords.some(keyword => lowerTranscript.includes(keyword));
}

/**
 * Extract a clean intent from the transcript
 * Removes filler words and normalizes the request
 */
export function extractIntent(transcript: string): string {
  // Remove common filler phrases
  const fillers = [
    "um", "uh", "like", "you know", "basically", "actually",
    "can you", "could you", "would you", "please", "i want you to",
    "i need you to", "i'd like you to", "go ahead and",
  ];

  let cleaned = transcript.toLowerCase();
  fillers.forEach(filler => {
    cleaned = cleaned.replace(new RegExp(`\\b${filler}\\b`, "gi"), " ");
  });

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Capitalize first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
