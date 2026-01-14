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
export async function runPlanner(
  params: RunPlannerParams,
): Promise<PlannerResult> {
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
          console.warn(
            "[runPlanner] Skipping tool call with missing name:",
            toolCall,
          );
          continue;
        }

        // Log the full tool call for debugging
        console.log(
          "[runPlanner] Executing tool:",
          toolName,
          "with args:",
          JSON.stringify(toolArgs, null, 2),
        );
        eventBus.emit("planner:tool_call", { name: toolName, args: toolArgs });

        const toolStartTs = Date.now();
        try {
          const toolResult = await executeToolLocally(
            toolName,
            toolArgs,
            runtime,
          );
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
          const errorMsg =
            toolError instanceof Error ? toolError.message : String(toolError);

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
  for (const wrapperKey of [
    "input",
    "arguments",
    "parameters",
    "properties",
    "args",
  ]) {
    if (
      obj[wrapperKey] &&
      typeof obj[wrapperKey] === "object" &&
      !Array.isArray(obj[wrapperKey])
    ) {
      console.log(
        `[flattenArgs] Found nested args in '${wrapperKey}':`,
        obj[wrapperKey],
      );
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
  runtime: import("../../types/toolContracts").AgentRuntime,
): Promise<unknown> {
  // Ensure args is an object, handle nested wrappers
  const typedArgs = flattenArgs(args);
  console.log(
    "[executeToolLocally]",
    toolName,
    "flattened args:",
    JSON.stringify(typedArgs),
  );

  const toNumber = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

  const normalizeGeo = (value: unknown) => {
    const raw = typeof value === "string" ? value.toLowerCase() : "rectangle";
    const map: Record<string, string> = {
      circle: "ellipse",
      square: "rectangle",
      arrow: "arrow-right",
      parallelogram: "rhombus",
    };
    const normalized = map[raw] ?? raw;
    const allowed = new Set([
      "rectangle",
      "ellipse",
      "triangle",
      "diamond",
      "pentagon",
      "hexagon",
      "octagon",
      "star",
      "rhombus",
      "oval",
      "trapezoid",
      "arrow-right",
      "arrow-left",
      "arrow-up",
      "arrow-down",
      "cloud",
      "heart",
      "x-box",
      "check-box",
    ]);
    return allowed.has(normalized) ? normalized : "rectangle";
  };

  const getViewportBounds = () => {
    try {
      const ctx = runtime.whiteboard.getViewContext() as {
        viewport?: { x?: number; y?: number; w?: number; h?: number };
        bounds?: { x?: number; y?: number; w?: number; h?: number };
      } | null;
      const viewport = ctx?.viewport ?? ctx?.bounds;
      if (viewport) {
        return {
          x: viewport.x ?? 0,
          y: viewport.y ?? 0,
          w: viewport.w ?? 800,
          h: viewport.h ?? 600,
        };
      }
    } catch {}
    return null;
  };

  const getDefaultCoords = () => {
    const viewport = getViewportBounds();
    if (viewport) {
      return {
        x: viewport.x + viewport.w / 2 - 50,
        y: viewport.y + viewport.h / 2 - 40,
      };
    }
    return { x: 100, y: 100 };
  };

  const resolveShape = (shapeId: unknown) => {
    if (typeof shapeId !== "string" || !shapeId) return null;
    return runtime.whiteboard.getSimpleShape(shapeId);
  };

  // Whiteboard tools
  if (toolName === "agent_create_shape" || toolName === "agent_create") {
    const defaults = getDefaultCoords();
    const x = toNumber(typedArgs.x, defaults.x);
    const y = toNumber(typedArgs.y, defaults.y);
    const w = toNumber(typedArgs.w, 100);
    const h = toNumber(typedArgs.h, 80);
    const geo = normalizeGeo(typedArgs.geo);
    const shapeId =
      typeof typedArgs.shapeId === "string" && typedArgs.shapeId
        ? typedArgs.shapeId
        : Math.random().toString(36).slice(2);

    await runtime.whiteboard.dispatchAction({
      _type: "create",
      intent: `Create ${geo}`,
      shape: {
        _type: geo,
        shapeId,
        x,
        y,
        w,
        h,
        color: typedArgs.color || "black",
        fill: typedArgs.fill || "none",
      },
    });
    return { status: "ok", summary: `Created shape at (${x}, ${y})` };
  }

  if (toolName === "agent_create_text") {
    const defaults = getDefaultCoords();
    const x = toNumber(typedArgs.x, defaults.x);
    const y = toNumber(typedArgs.y, defaults.y);
    const w = toNumber(typedArgs.w, 220);
    const h = toNumber(typedArgs.h, 60);
    const shapeId =
      typeof typedArgs.shapeId === "string" && typedArgs.shapeId
        ? typedArgs.shapeId
        : Math.random().toString(36).slice(2);

    await runtime.whiteboard.dispatchAction({
      _type: "create",
      intent: "Create text",
      shape: {
        _type: "text",
        shapeId,
        x,
        y,
        w,
        h,
        text: String(typedArgs.text || "Hello"),
        color: typedArgs.color || "black",
      },
    });
    return {
      status: "ok",
      summary: `Created text "${typedArgs.text || "Hello"}" at (${x}, ${y})`,
    };
  }

  if (toolName === "agent_label") {
    const shape = resolveShape(typedArgs.shapeId);
    const labelText = String(typedArgs.text || "").trim();
    if (!shape) {
      return { status: "error", summary: "Shape not found for label" };
    }
    if (!labelText) {
      return { status: "error", summary: "Missing label text" };
    }
    const shapeId = Math.random().toString(36).slice(2);
    const baseX = (shape.x ?? 0) + 8;
    const baseY = (shape.y ?? 0) + 8;
    await runtime.whiteboard.dispatchAction({
      _type: "create",
      intent: "Create text label",
      shape: {
        _type: "text",
        shapeId,
        x: baseX,
        y: baseY,
        w: 220,
        h: 60,
        text: labelText,
        color: "black",
      },
    });
    const targetId = shape.shapeId || String(typedArgs.shapeId || "");
    return { status: "ok", summary: `Added label near ${targetId}` };
  }

  if (toolName === "agent_move") {
    const shape = resolveShape(typedArgs.shapeId);
    if (!shape) {
      return { status: "error", summary: "Shape not found for move" };
    }
    const x = toNumber(typedArgs.x, shape.x ?? 0);
    const y = toNumber(typedArgs.y, shape.y ?? 0);
    await runtime.whiteboard.dispatchAction({
      _type: "move",
      intent: "Move shape",
      shapeId: shape.shapeId || typedArgs.shapeId,
      shapeType: shape._type || shape.type || "geo",
      x,
      y,
    });
    return { status: "ok", summary: `Moved shape to (${x}, ${y})` };
  }

  if (toolName === "agent_delete") {
    const shape = resolveShape(typedArgs.shapeId);
    if (!shape) {
      return { status: "error", summary: "Shape not found for delete" };
    }
    await runtime.whiteboard.dispatchAction({
      _type: "delete",
      intent: "Delete shape",
      shapeId: shape.shapeId || typedArgs.shapeId,
    });
    const targetId = shape.shapeId || String(typedArgs.shapeId || "");
    return { status: "ok", summary: `Deleted shape ${targetId}` };
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
      String(typedArgs.content || ""),
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
export async function gatherSpaceContext(
  runtime: import("../../types/toolContracts").AgentRuntime,
): Promise<SpaceContext> {
  const context: SpaceContext = {};

  const normalizeShape = (shape: any) => {
    if (!shape) return null;
    return {
      shapeId: String(shape.shapeId || shape.id || ""),
      type: String(shape.type || shape._type || "unknown"),
      x: typeof shape.x === "number" ? shape.x : 0,
      y: typeof shape.y === "number" ? shape.y : 0,
      w: typeof shape.w === "number" ? shape.w : undefined,
      h: typeof shape.h === "number" ? shape.h : undefined,
      text: String(shape.text || shape.label || ""),
      geo: shape.geo,
      color: shape.color,
      fill: shape.fill,
    };
  };

  const normalizeCluster = (cluster: any) => {
    if (!cluster) return null;
    const bounds = cluster.bounds || cluster.bbox || cluster.box;
    if (!bounds) return null;
    return {
      count: Number(cluster.count ?? cluster.size ?? 0) || 0,
      bounds: {
        x: bounds.x ?? 0,
        y: bounds.y ?? 0,
        w: bounds.w ?? 0,
        h: bounds.h ?? 0,
      },
    };
  };

  // Gather whiteboard context
  try {
    const viewContext = runtime.whiteboard.getViewContext() as any;
    if (viewContext) {
      const viewport = viewContext.viewport ||
        viewContext.bounds || { x: 0, y: 0, w: 1000, h: 800 };
      const shapes = (viewContext.shapes || viewContext.blurryShapes || [])
        .map(normalizeShape)
        .filter(Boolean);
      const selectedShapes = (viewContext.selectedShapes || [])
        .map(normalizeShape)
        .filter(Boolean);
      const peripheralClusters = (viewContext.peripheralClusters || [])
        .map(normalizeCluster)
        .filter(Boolean);
      const screenshot = await runtime.whiteboard
        .getScreenshot()
        .catch(() => null);

      context.whiteboard = {
        viewport: {
          x: viewport.x ?? 0,
          y: viewport.y ?? 0,
          w: viewport.w ?? 1000,
          h: viewport.h ?? 800,
        },
        shapes,
        selectedShapes,
        peripheralClusters,
        screenshot: screenshot || undefined,
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
