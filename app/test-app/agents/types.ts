import type { PlaygroundEventBus } from "../lib/eventBus";
import type { AgentRuntime } from "../types/toolContracts";

/**
 * Playground architecture types
 */
export type PlaygroundArchitecture = 
  | "realtime_tools"   // Current: single voice agent with tools
  | "split_planner"    // Voice agent + separate planner agent
  | "specialists";     // Voice agent + per-space specialized agents (future)

/**
 * Configuration for the planner agent
 */
export interface PlannerConfig {
  model: string;           // OpenRouter model ID
  systemPrompt: string;    // System prompt for the planner
  maxSteps: number;        // Max tool call iterations
  temperature: number;     // Model temperature
}

/**
 * Context gathered from all active spaces
 */
export interface SpaceContext {
  whiteboard?: {
    viewport: { x: number; y: number; w: number; h: number };
    shapes: Array<{
      shapeId: string;
      type: string;
      x: number;
      y: number;
      text?: string;
    }>;
    screenshot?: string;  // Base64 data URL
  };
  ide?: {
    files: Array<{ name: string; language: string; size: number }>;
    activeFile?: {
      name: string;
      language: string;
      content: string;
    };
  };
  notes?: {
    yaml: string;
  };
}

/**
 * Input to the planner agent
 */
export interface PlannerInput {
  intent: string;          // User's intent (from voice transcript or direct input)
  context: SpaceContext;   // Current state of all spaces
  config: PlannerConfig;   // Planner configuration
}

/**
 * Result from the planner agent
 */
export interface PlannerResult {
  success: boolean;
  text: string;            // Response text to speak back
  toolCalls: Array<{
    name: string;
    args: unknown;
    result: unknown;
  }>;
  durationMs: number;
  error?: string;
}

/**
 * Params for running the planner
 */
export interface RunPlannerParams {
  intent: string;
  context: SpaceContext;
  config: PlannerConfig;
  runtime: AgentRuntime;
  eventBus: PlaygroundEventBus;
}

/**
 * Voice agent configuration
 */
export interface VoiceConfig {
  model: string;           // OpenAI Realtime model
  voice: string;           // Voice ID
  vadEagerness: "low" | "medium" | "high";
  instructions: string;    // Base instructions for voice agent
}

/**
 * Overall playground configuration
 */
export interface PlaygroundConfig {
  architecture: PlaygroundArchitecture;
  voice: VoiceConfig;
  planner: PlannerConfig;
  activeSpaces: Array<"whiteboard" | "ide" | "notes">;
  debug: {
    showLogs: boolean;
    showContext: boolean;
    showToolCalls: boolean;
  };
}

/**
 * Default playground configuration
 */
export const DEFAULT_PLAYGROUND_CONFIG: PlaygroundConfig = {
  architecture: "split_planner",
  voice: {
    model: "gpt-realtime",
    voice: "marin",
    vadEagerness: "medium",
    instructions: "You are a helpful AI tutor. Listen to the user and help them learn.",
  },
  planner: {
    model: "google/gemini-2.0-flash-exp",
    systemPrompt: "",  // Will be set dynamically
    maxSteps: 10,
    temperature: 0.7,
  },
  activeSpaces: ["whiteboard", "ide", "notes"],
  debug: {
    showLogs: true,
    showContext: false,
    showToolCalls: true,
  },
};
