<<<<<<< Current (Your changes)
=======
"use client";

import type { RunPlannerParams, PlannerResult, SpaceContext } from "../types";
import { buildPlannerSystemPrompt } from "./prompts";

/**
 * Tool definition for AI SDK format
 */
interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Run the planner agent
 * This is called from the client but executes via API route for security
 */
export async function runPlanner(params: RunPlannerParams): Promise<PlannerResult> {
  const { intent, context, config, runtime, eventBus } = params;
  const startTs = Date.now();

  eventBus.emit("planner:start", { intent, model: config.model });

  try {
    // Call the API route which has access to API keys
    const response = await fetch("/api/playground/planner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent,
        context,
        model: config.model,
        systemPrompt: config.systemPrompt || buildPlannerSystemPrompt(context),
        maxSteps: config.maxSteps,
        temperature: config.temperature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Planner API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const durationMs = Date.now() - startTs;

    // Execute tool calls locally using the runtime
    const executedTools: PlannerResult["toolCalls"] = [];

    if (result.toolCalls && Array.isArray(result.toolCalls)) {
      for (const toolCall of result.toolCalls) {
        eventBus.emit("planner:tool_call", { name: toolCall.name, args: toolCall.args });

        const toolStartTs = Date.now();
        try {
          const toolResult = await executeToolLocally(toolCall.name, toolCall.args, runtime);
          const toolDuration = Date.now() - toolStartTs;

          eventBus.emit("planner:tool_result", {
            name: toolCall.name,
            result: toolResult,
            durationMs: toolDuration,
          });

          executedTools.push({
            name: toolCall.name,
            args: toolCall.args,
            result: toolResult,
          });
        } catch (toolError) {
          const toolDuration = Date.now() - toolStartTs;
          const errorMsg = toolError instanceof Error ? toolError.message : String(toolError);
          
          eventBus.emit("tool:error", {
            name: toolCall.name,
            error: errorMsg,
            durationMs: toolDuration,
          });

          executedTools.push({
            name: toolCall.name,
            args: toolCall.args,
            result: { error: errorMsg },
          });
        }
      }
    }

    eventBus.emit("planner:done", {
      result: result.text,
      durationMs,
      toolCalls: executedTools.length,
    });

    return {
      success: true,
      text: result.text || "Done!",
      toolCalls: executedTools,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTs;
    const errorMsg = error instanceof Error ? error.message : String(error);

    eventBus.emit("planner:error", { error: errorMsg });

    return {
      success: false,
      text: "Sorry, I encountered an error.",
      toolCalls: [],
      durationMs,
      error: errorMsg,
    };
  }
}

/**
 * Execute a tool call locally using the runtime
 */
async function executeToolLocally(
  toolName: string,
  args: unknown,
  runtime: import("../../types/toolContracts").AgentRuntime
): Promise<unknown> {
  const typedArgs = args as Record<string, unknown>;

  // Whiteboard tools
  if (toolName === "agent_create_shape" || toolName === "agent_create") {
    await runtime.whiteboard.dispatchAction({
      _type: "create",
      intent: `Create ${typedArgs.geo || "rectangle"}`,
      shape: {
        _type: typedArgs.geo || "rectangle",
        shapeId: Math.random().toString(36).slice(2),
        x: typedArgs.x,
        y: typedArgs.y,
        w: typedArgs.w || 100,
        h: typedArgs.h || 80,
        color: typedArgs.color || "black",
        fill: typedArgs.fill || "none",
      },
    });
    return { status: "ok", summary: `Created shape at (${typedArgs.x}, ${typedArgs.y})` };
  }

  if (toolName === "agent_create_text") {
    await runtime.whiteboard.dispatchAction({
      _type: "create",
      intent: "Create text",
      shape: {
        _type: "text",
        shapeId: Math.random().toString(36).slice(2),
        x: typedArgs.x,
        y: typedArgs.y,
        w: typedArgs.w || 220,
        h: typedArgs.h || 60,
        text: String(typedArgs.text || ""),
        color: typedArgs.color || "black",
      },
    });
    return { status: "ok", summary: `Created text at (${typedArgs.x}, ${typedArgs.y})` };
  }

  if (toolName === "agent_move") {
    await runtime.whiteboard.dispatchAction({
      _type: "move",
      intent: "Move shape",
      shapeId: typedArgs.shapeId,
      x: typedArgs.x,
      y: typedArgs.y,
    });
    return { status: "ok", summary: `Moved shape to (${typedArgs.x}, ${typedArgs.y})` };
  }

  if (toolName === "agent_delete") {
    await runtime.whiteboard.dispatchAction({
      _type: "delete",
      intent: "Delete shape",
      shapeId: typedArgs.shapeId,
    });
    return { status: "ok", summary: `Deleted shape ${typedArgs.shapeId}` };
  }

  if (toolName === "agent_clear") {
    await runtime.whiteboard.dispatchAction({ _type: "clear" });
    return { status: "ok", summary: "Cleared canvas" };
  }

  if (toolName === "agent_get_view_context") {
    const ctx = runtime.whiteboard.getViewContext();
    return ctx;
  }

  if (toolName === "agent_get_screenshot") {
    const url = await runtime.whiteboard.getScreenshot();
    return url || "null";
  }

  // IDE tools
  if (toolName === "ide_create_file") {
    runtime.ide.createFile(
      String(typedArgs.name || "untitled.py"),
      String(typedArgs.language || "python"),
      String(typedArgs.content || "")
    );
    return { status: "ok", summary: `Created file ${typedArgs.name}` };
  }

  if (toolName === "ide_update_file") {
    runtime.ide.updateActiveContent(String(typedArgs.content || ""));
    return { status: "ok", summary: "Updated file content" };
  }

  if (toolName === "ide_run") {
    const result = await runtime.ide.runActive();
    return result;
  }

  if (toolName === "ide_get_context") {
    return runtime.ide.getContext();
  }

  // Notes tools
  if (toolName === "notes_get") {
    return runtime.notes.getText();
  }

  if (toolName === "notes_set") {
    runtime.notes.setText(String(typedArgs.text || ""));
    return { status: "ok", summary: "Updated notes" };
  }

  if (toolName === "notes_append") {
    runtime.notes.append(String(typedArgs.text || ""));
    return { status: "ok", summary: "Appended to notes" };
  }

  // Unknown tool
  return { status: "error", summary: `Unknown tool: ${toolName}` };
}

/**
 * Gather context from all active spaces
 */
export function gatherSpaceContext(runtime: import("../../types/toolContracts").AgentRuntime): SpaceContext {
  const context: SpaceContext = {};

  // Gather whiteboard context
  try {
    const viewContext = runtime.whiteboard.getViewContext() as any;
    if (viewContext) {
      context.whiteboard = {
        viewport: viewContext.viewport || { x: 0, y: 0, w: 1000, h: 800 },
        shapes: (viewContext.shapes || []).map((s: any) => ({
          shapeId: s.shapeId || s.id || "",
          type: s.type || s._type || "unknown",
          x: s.x || 0,
          y: s.y || 0,
          text: s.text || s.label || "",
        })),
      };
    }
  } catch (e) {
    console.warn("[gatherSpaceContext] whiteboard error:", e);
  }

  // Gather IDE context
  try {
    const ideContext = runtime.ide.getContext();
    const activeContent = runtime.ide.getActiveContent();
    context.ide = {
      files: ideContext.files,
      activeFile: activeContent || undefined,
    };
  } catch (e) {
    console.warn("[gatherSpaceContext] ide error:", e);
  }

  // Gather notes context
  try {
    context.notes = {
      yaml: runtime.notes.getText(),
    };
  } catch (e) {
    console.warn("[gatherSpaceContext] notes error:", e);
  }

  return context;
}
>>>>>>> Incoming (Background Agent changes)
