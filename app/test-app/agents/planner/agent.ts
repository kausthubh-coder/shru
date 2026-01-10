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
        // Ensure toolCall has required properties
        const toolName = toolCall?.name || toolCall?.toolName;
        const toolArgs = toolCall?.args ?? {};
        
        if (!toolName) {
          console.warn("[runPlanner] Skipping tool call with missing name:", toolCall);
          continue;
        }

        // Log the full tool call for debugging
        console.log("[runPlanner] Executing tool:", toolName, "with args:", JSON.stringify(toolArgs, null, 2));
        eventBus.emit("planner:tool_call", { name: toolName });

        const toolStartTs = Date.now();
        try {
          const toolResult = await executeToolLocally(toolName, toolArgs, runtime);
          const toolDuration = Date.now() - toolStartTs;

          eventBus.emit("planner:tool_result", {
            name: toolName,
            result: toolResult,
            durationMs: toolDuration,
          });

          executedTools.push({
            name: toolName,
            args: toolArgs,
            result: toolResult,
          });
        } catch (toolError) {
          const toolDuration = Date.now() - toolStartTs;
          const errorMsg = toolError instanceof Error ? toolError.message : String(toolError);
          
          eventBus.emit("tool:error", {
            name: toolName,
            error: errorMsg,
            durationMs: toolDuration,
          });

          executedTools.push({
            name: toolName,
            args: toolArgs,
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
 * Flatten nested args - some models return { input: { x: 1 } } instead of { x: 1 }
 */
function flattenArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return {};
  }
  
  const obj = args as Record<string, unknown>;
  
  // Check for common wrapper patterns from different models
  // Some models wrap args in 'input', 'arguments', 'parameters', or 'properties'
  for (const wrapperKey of ["input", "arguments", "parameters", "properties", "args"]) {
    if (obj[wrapperKey] && typeof obj[wrapperKey] === "object" && !Array.isArray(obj[wrapperKey])) {
      console.log(`[flattenArgs] Found nested args in '${wrapperKey}':`, obj[wrapperKey]);
      return obj[wrapperKey] as Record<string, unknown>;
    }
  }
  
  return obj;
}

/**
 * Execute a tool call locally using the runtime
 */
async function executeToolLocally(
  toolName: string,
  args: unknown,
  runtime: import("../../types/toolContracts").AgentRuntime
): Promise<unknown> {
  // Ensure args is an object, handle nested wrappers
  const typedArgs = flattenArgs(args);
  console.log("[executeToolLocally]", toolName, "flattened args:", JSON.stringify(typedArgs));

  // Helper to get default coordinates (center of viewport or fallback)
  const getDefaultCoords = () => {
    try {
      const ctx = runtime.whiteboard.getViewContext() as { viewport?: { x?: number; y?: number; w?: number; h?: number } } | null;
      if (ctx?.viewport) {
        return {
          x: (ctx.viewport.x ?? 0) + (ctx.viewport.w ?? 800) / 2 - 50,
          y: (ctx.viewport.y ?? 0) + (ctx.viewport.h ?? 600) / 2 - 40,
        };
      }
    } catch {}
    return { x: 100, y: 100 };
  };

  // Whiteboard tools
  if (toolName === "agent_create_shape" || toolName === "agent_create") {
    const defaults = getDefaultCoords();
    const x = typeof typedArgs.x === "number" ? typedArgs.x : defaults.x;
    const y = typeof typedArgs.y === "number" ? typedArgs.y : defaults.y;
    
    await runtime.whiteboard.dispatchAction({
      _type: "create",
      intent: `Create ${typedArgs.geo || "rectangle"}`,
      shape: {
        _type: typedArgs.geo || "rectangle",
        shapeId: Math.random().toString(36).slice(2),
        x,
        y,
        w: typedArgs.w || 100,
        h: typedArgs.h || 80,
        color: typedArgs.color || "black",
        fill: typedArgs.fill || "none",
      },
    });
    return { status: "ok", summary: `Created shape at (${x}, ${y})` };
  }

  if (toolName === "agent_create_text") {
    const defaults = getDefaultCoords();
    const x = typeof typedArgs.x === "number" ? typedArgs.x : defaults.x;
    const y = typeof typedArgs.y === "number" ? typedArgs.y : defaults.y;
    
    await runtime.whiteboard.dispatchAction({
      _type: "create",
      intent: "Create text",
      shape: {
        _type: "text",
        shapeId: Math.random().toString(36).slice(2),
        x,
        y,
        w: typedArgs.w || 220,
        h: typedArgs.h || 60,
        text: String(typedArgs.text || "Hello"),
        color: typedArgs.color || "black",
      },
    });
    return { status: "ok", summary: `Created text "${typedArgs.text || 'Hello'}" at (${x}, ${y})` };
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
