import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { allPlannerTools } from "../../../test-app/agents/planner/tools";

/**
 * OpenRouter client for server-side use
 */
function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  
  return createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });
}

/**
 * POST /api/playground/planner
 * 
 * Runs the planner agent with the given intent and context
 * Returns tool calls and response text
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { intent, context, model, systemPrompt, maxSteps, temperature } = body;

    if (!intent) {
      return NextResponse.json(
        { error: "Missing intent" },
        { status: 400 }
      );
    }

    if (!model) {
      return NextResponse.json(
        { error: "Missing model" },
        { status: 400 }
      );
    }

    const openrouter = getOpenRouterClient();

    // Build the user message with context
    const contextSummary = buildContextSummary(context);
    const userMessage = contextSummary 
      ? `${contextSummary}\n\nUser request: ${intent}`
      : intent;

    // Run the AI with tools
    const result = await generateText({
      model: openrouter(model),
      system: systemPrompt || "You are a helpful teaching assistant. Execute the user's request using the available tools.",
      prompt: userMessage,
      tools: allPlannerTools,
      maxSteps: maxSteps || 10,
      temperature: temperature ?? 0.7,
    });

    // Extract tool calls from steps
    const toolCalls: Array<{ name: string; args: unknown }> = [];
    
    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            toolCalls.push({
              name: tc.toolName,
              args: tc.args,
            });
          }
        }
      }
    }

    return NextResponse.json({
      text: result.text,
      toolCalls,
      usage: result.usage,
      finishReason: result.finishReason,
    });
  } catch (error) {
    console.error("[planner/route] Error:", error);
    
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * Build a summary of the current context for the model
 */
function buildContextSummary(context: Record<string, unknown> | null | undefined): string {
  if (!context) return "";
  
  const parts: string[] = [];

  const whiteboard = context.whiteboard as { viewport?: { x?: number; y?: number; w?: number; h?: number }; shapes?: Array<{ type?: string; x?: number; y?: number; text?: string }> } | undefined;
  if (whiteboard) {
    const { viewport, shapes } = whiteboard;
    parts.push(`[Whiteboard] Viewport: (${viewport?.x || 0}, ${viewport?.y || 0}) ${viewport?.w || 1000}x${viewport?.h || 800}`);
    if (shapes && shapes.length > 0) {
      parts.push(`  Shapes: ${shapes.length} items`);
      shapes.slice(0, 5).forEach((s) => {
        parts.push(`    - ${s.type} at (${Math.round(s.x ?? 0)}, ${Math.round(s.y ?? 0)})${s.text ? `: "${s.text.slice(0, 30)}"` : ""}`);
      });
      if (shapes.length > 5) {
        parts.push(`    ... and ${shapes.length - 5} more`);
      }
    }
  }

  const ide = context.ide as { activeFile?: { name?: string; language?: string; content?: string } } | undefined;
  if (ide?.activeFile) {
    const { name, language, content } = ide.activeFile;
    parts.push(`[IDE] Active: ${name} (${language})`);
    if (content) {
      const preview = content.slice(0, 200);
      parts.push(`  Content preview: ${preview}${content.length > 200 ? "..." : ""}`);
    }
  }

  const notes = context.notes as { yaml?: string } | undefined;
  if (notes?.yaml) {
    const preview = notes.yaml.slice(0, 150);
    parts.push(`[Notes] ${preview}${notes.yaml.length > 150 ? "..." : ""}`);
  }

  return parts.length > 0 ? `Current context:\n${parts.join("\n")}` : "";
}
