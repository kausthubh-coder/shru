import { createOpenAI } from "@ai-sdk/openai";

/**
 * OpenRouter client for AI SDK
 * Allows switching between different models (Gemini, Claude, GPT, etc.)
 */
export const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ?? "",
});

/**
 * Popular models available on OpenRouter for playground testing
 * These are fast models suitable for real-time tutoring
 */
export const PLAYGROUND_MODELS = [
  { id: "google/gemini-2.0-flash-exp", name: "Gemini 2.0 Flash", provider: "Google", speed: "fast" },
  { id: "google/gemini-flash-1.5", name: "Gemini 1.5 Flash", provider: "Google", speed: "fast" },
  { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash Preview", provider: "Google", speed: "fast" },
  { id: "x-ai/grok-code-fast-1", name: "Grok Code Fast", provider: "xAI", speed: "fast" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", speed: "fast" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI", speed: "medium" },
  { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku", provider: "Anthropic", speed: "fast" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", speed: "medium" },
  { id: "meta-llama/llama-3.1-70b-instruct", name: "Llama 3.1 70B", provider: "Meta", speed: "medium" },
] as const;

export type PlaygroundModelId = (typeof PLAYGROUND_MODELS)[number]["id"];

/**
 * Get model by ID
 */
export function getModelInfo(modelId: string) {
  return PLAYGROUND_MODELS.find((m) => m.id === modelId);
}
