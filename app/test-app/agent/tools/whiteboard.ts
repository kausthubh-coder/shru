import { z } from "zod";
import { AgentRuntime, ToolResult, createWrapExecute } from "../../types/toolContracts";

const ALLOWED_GEOS = [
  "cloud",
  "rectangle",
  "ellipse",
  "triangle",
  "diamond",
  "pentagon",
  "hexagon",
  "octagon",
  "star",
  "rhombus",
  "rhombus-2",
  "oval",
  "trapezoid",
  "arrow-right",
  "arrow-left",
  "arrow-up",
  "arrow-down",
  "x-box",
  "check-box",
  "heart",
];

function coerceGeo(input: any, log?: (s: string) => void): string {
  const g0 = typeof input === 'string' ? input.toLowerCase() : '';
  let g = g0;
  // common synonyms → allowed
  if (g === 'circle') g = 'ellipse';
  if (g === 'square') g = 'rectangle';
  if (g === 'arrow') g = 'arrow-right';
  if (g === 'parallelogram') g = 'rhombus';
  if (!ALLOWED_GEOS.includes(g)) {
    const fallback = 'rectangle';
    if (log) log(`[geo:coerce] from=${g0} → ${fallback}`);
    return fallback;
  }
  if (g !== g0 && log) log(`[geo:coerce] from=${g0} → ${g}`);
  return g;
}

export function buildWhiteboardTools(runtime: AgentRuntime) {
  const wrapExecute = createWrapExecute(runtime);
  const needsApproval = new Set(["agent_clear"]);
  const maybeApprove = async (name: string, actionSummary: string) => {
    if (!needsApproval.has(name)) return true;
    // Emit an approval request event the page can intercept to show UI
    try { runtime.onToolEvent?.({ ts: Date.now(), rid: "approval", name, status: 'start', args: { approval: actionSummary } }); } catch {}
    // For now, respect an environment toggle: auto-approve false means blocked
    // The page can intercept this event in onToolEvent to display a dialog and then re-dispatch
    return false;
  };

  const agent_delete = {
    name: "agent_delete",
    description: "Delete a shape by simple id.",
    parameters: z.object({ shapeId: z.string() }),
    execute: wrapExecute("agent_delete", async ({ shapeId }: any): Promise<ToolResult<string>> => {
      await runtime.whiteboard.dispatchAction({ _type: "delete", intent: "Delete shape", shapeId });
      return { status: 'ok', summary: `deleted ${shapeId}` };
    }),
  } as const;

  const agent_create_text = {
    name: "agent_create_text",
    description: "Create a standalone text shape at coordinates.",
    parameters: z.object({
      x: z.number(),
      y: z.number(),
      text: z.string(),
      w: z.number().default(220),
      h: z.number().default(60),
      color: z.string().default("black"),
    }),
    execute: wrapExecute("agent_create_text", async ({ x, y, text, w, h, color }: any): Promise<ToolResult<string>> => {
      const nx = (typeof x === 'number' && isFinite(x)) ? x : null;
      const ny = (typeof y === 'number' && isFinite(y)) ? y : null;
      const nw = (typeof w === 'number' && isFinite(w)) ? w : 220;
      const nh = (typeof h === 'number' && isFinite(h)) ? h : 60;
      if (nx === null || ny === null) return { status: 'error', summary: 'invalid position' };
      await runtime.whiteboard.dispatchAction({
        _type: "create",
        intent: "Create text",
        shape: {
          _type: 'text',
          shapeId: Math.random().toString(36).slice(2),
          x: nx,
          y: ny,
          w: nw,
          h: nh,
          text: String(text ?? ''),
          color: String(color ?? 'black'),
        },
      });
      return { status: 'ok', summary: `text created at (${x},${y})` };
    }),
  } as const;

  const agent_clear = {
    name: "agent_clear",
    description: "Clear the canvas (delete all shapes).",
    parameters: z.object({}),
    execute: wrapExecute("agent_clear", async (): Promise<ToolResult<string>> => {
      const approved = await maybeApprove("agent_clear", "Clear the canvas");
      if (!approved) return { status: 'error', summary: 'approval_required' };
      await runtime.whiteboard.dispatchAction({ _type: "clear" });
      return { status: 'ok', summary: "cleared canvas" };
    }),
  } as const;

  const agent_create_shape = {
    name: "agent_create_shape",
    description: "Create a geo shape with optional text/color/fill.",
    parameters: z.object({
      geo: z.string().default("rectangle"),
      x: z.number(),
      y: z.number(),
      w: z.number().default(100),
      h: z.number().default(100),
      text: z.string().nullable().optional(),
      color: z.string().default("black"),
      fill: z.enum(["none","tint","background","solid","pattern"]).default("none"),
    }),
    execute: wrapExecute("agent_create_shape", async ({ geo, x, y, w, h, text, color, fill }: any): Promise<ToolResult<string>> => {
      const normalizedGeo = coerceGeo(geo, runtime.appendLog);
      const nx = (typeof x === 'number' && isFinite(x)) ? x : null;
      const ny = (typeof y === 'number' && isFinite(y)) ? y : null;
      const nw = (typeof w === 'number' && isFinite(w)) ? w : null;
      const nh = (typeof h === 'number' && isFinite(h)) ? h : null;
      if (nx === null || ny === null) return { status: 'error', summary: 'invalid position' };
      if (nw === null || nh === null) return { status: 'error', summary: 'invalid size' };
      // Do not set inline label on geo for this version; model can add text via agent_label or separate text shape
      await runtime.whiteboard.dispatchAction({
        _type: "create",
        intent: `Create ${normalizedGeo}`,
        shape: {
          _type: normalizedGeo,
          shapeId: Math.random().toString(36).slice(2),
          note: "",
          x: nx,
          y: ny,
          w: nw,
          h: nh,
          // text omitted for geo compatibility
          color,
          fill,
        },
      });
      return { status: 'ok', summary: `created ${normalizedGeo} at (${x},${y})` };
    }),
  } as const;

  const agent_create = {
    name: "agent_create",
    description: "Create a shape (defaults to rectangle).",
    parameters: z.object({
      geo: z.string().default("rectangle"),
      x: z.number(),
      y: z.number(),
      w: z.number().default(120),
      h: z.number().default(90),
      text: z.string().nullable().optional(),
      color: z.string().default("black"),
      fill: z.enum(["none","tint","background","solid","pattern"]).default("none"),
    }),
    execute: wrapExecute("agent_create", async ({ geo, x, y, w, h, text, color, fill }: any): Promise<ToolResult<string>> => {
      const normalizedGeo = coerceGeo(geo, runtime.appendLog);
      const nx = (typeof x === 'number' && isFinite(x)) ? x : null;
      const ny = (typeof y === 'number' && isFinite(y)) ? y : null;
      const nw = (typeof w === 'number' && isFinite(w)) ? w : null;
      const nh = (typeof h === 'number' && isFinite(h)) ? h : null;
      if (nx === null || ny === null) return { status: 'error', summary: 'invalid position' };
      if (nw === null || nh === null) return { status: 'error', summary: 'invalid size' };
      await runtime.whiteboard.dispatchAction({
        _type: "create",
        intent: `Create ${normalizedGeo}`,
        shape: { _type: normalizedGeo, shapeId: Math.random().toString(36).slice(2), note: "", x: nx, y: ny, w: nw, h: nh, color, fill },
      });
      return { status: 'ok', summary: `created ${normalizedGeo} at (${x},${y})` };
    }),
  } as const;

  const agent_move = {
    name: "agent_move",
    description: "Move a shape by simple id to a new position.",
    parameters: z.object({ shapeId: z.string(), x: z.number(), y: z.number() }),
    execute: wrapExecute("agent_move", async ({ shapeId, x, y }: any): Promise<ToolResult<string>> => {
      await runtime.whiteboard.dispatchAction({ _type: "move", intent: "Move shape", shapeId, x, y });
      return { status: 'ok', summary: `moved ${shapeId} to (${x},${y})` };
    }),
  } as const;

  const agent_label = {
    name: "agent_label",
    description: "Set or change a shape's label/text.",
    parameters: z.object({ shapeId: z.string(), text: z.string() }),
    execute: wrapExecute("agent_label", async ({ shapeId, text }: any): Promise<ToolResult<string>> => {
      runtime.appendLog?.(`[label] requested label change shapeId=${shapeId} text=${String(text ?? '')}`);
      // If target is non-text, create a nearby text shape instead of no-op
      try {
        const simple = runtime.whiteboard.getSimpleShape?.(shapeId);
        const baseX = (simple?.x ?? 0) + 8;
        const baseY = (simple?.y ?? 0) + 8;
        await runtime.whiteboard.dispatchAction({
          _type: "create",
          intent: "Create text label",
          shape: {
            _type: 'text',
            shapeId: Math.random().toString(36).slice(2),
            x: baseX,
            y: baseY,
            w: 220,
            h: 60,
            text: String(text ?? ''),
            color: 'black',
          },
        });
        return { status: 'ok', summary: `label created as text near ${shapeId}` };
      } catch {
        return { status: 'error', summary: 'label create failed' };
      }
    }),
  } as const;

  const agent_align = {
    name: "agent_align",
    description: "Align shapes by ids.",
    parameters: z.object({ alignment: z.enum(["top","bottom","left","right","center-horizontal","center-vertical"]), shapeIds: z.array(z.string()), gap: z.number().default(0) }),
    execute: wrapExecute("agent_align", async ({ alignment, shapeIds, gap }: any): Promise<ToolResult<string>> => {
      await runtime.whiteboard.dispatchAction({ _type: "align", intent: `Align ${shapeIds.length} shapes`, alignment, shapeIds, gap });
      return { status: 'ok', summary: `aligned ${shapeIds.length} shapes (${alignment})` };
    }),
  } as const;

  const agent_distribute = {
    name: "agent_distribute",
    description: "Distribute shapes.",
    parameters: z.object({ direction: z.enum(["horizontal","vertical"]), shapeIds: z.array(z.string()), gap: z.number().default(0) }),
    execute: wrapExecute("agent_distribute", async ({ direction, shapeIds, gap }: any): Promise<ToolResult<string>> => {
      await runtime.whiteboard.dispatchAction({ _type: "distribute", intent: `Distribute ${shapeIds.length} shapes`, direction, shapeIds, gap });
      return { status: 'ok', summary: `distributed ${shapeIds.length} shapes (${direction})` };
    }),
  } as const;

  const agent_stack = {
    name: "agent_stack",
    description: "Stack shapes.",
    parameters: z.object({ direction: z.enum(["vertical","horizontal"]), shapeIds: z.array(z.string()), gap: z.number().default(0.1) }),
    execute: wrapExecute("agent_stack", async ({ direction, shapeIds, gap }: any): Promise<ToolResult<string>> => {
      await runtime.whiteboard.dispatchAction({ _type: "stack", intent: `Stack ${shapeIds.length} shapes`, direction, shapeIds, gap });
      return { status: 'ok', summary: `stacked ${shapeIds.length} shapes (${direction})` };
    }),
  } as const;

  const agent_rotate = {
    name: "agent_rotate",
    description: "Rotate shapes.",
    parameters: z.object({ shapeIds: z.array(z.string()), degrees: z.number(), originX: z.number(), originY: z.number() }),
    execute: wrapExecute("agent_rotate", async ({ shapeIds, degrees, originX, originY }: any): Promise<ToolResult<string>> => {
      await runtime.whiteboard.dispatchAction({ _type: "rotate", intent: `Rotate ${shapeIds.length} shapes`, shapeIds, degrees, originX, originY, centerY: 0 });
      return { status: 'ok', summary: `rotated ${shapeIds.length} shapes by ${degrees}°` };
    }),
  } as const;

  const agent_resize = {
    name: "agent_resize",
    description: "Resize shapes.",
    parameters: z.object({ shapeIds: z.array(z.string()), scaleX: z.number(), scaleY: z.number(), originX: z.number(), originY: z.number() }),
    execute: wrapExecute("agent_resize", async ({ shapeIds, scaleX, scaleY, originX, originY }: any): Promise<ToolResult<string>> => {
      await runtime.whiteboard.dispatchAction({ _type: "resize", intent: `Resize ${shapeIds.length} shapes`, shapeIds, scaleX, scaleY, originX, originY });
      return { status: 'ok', summary: `resized ${shapeIds.length} shapes` };
    }),
  } as const;

  const agent_bring_to_front = {
    name: "agent_bring_to_front",
    description: "Bring shapes to front.",
    parameters: z.object({ shapeIds: z.array(z.string()) }),
    execute: wrapExecute("agent_bring_to_front", async ({ shapeIds }: any): Promise<ToolResult<string>> => {
      await runtime.whiteboard.dispatchAction({ _type: "bringToFront", intent: `Bring to front`, shapeIds });
      return { status: 'ok', summary: `brought ${shapeIds.length} to front` };
    }),
  } as const;

  const agent_send_to_back = {
    name: "agent_send_to_back",
    description: "Send shapes to back.",
    parameters: z.object({ shapeIds: z.array(z.string()) }),
    execute: wrapExecute("agent_send_to_back", async ({ shapeIds }: any): Promise<ToolResult<string>> => {
      await runtime.whiteboard.dispatchAction({ _type: "sendToBack", intent: "Send to back", shapeIds });
      return { status: 'ok', summary: `sent ${shapeIds.length} to back` };
    }),
  } as const;

  const agent_place = {
    name: "agent_place",
    description: "Place a shape relative to another.",
    parameters: z.object({ shapeId: z.string(), referenceShapeId: z.string(), side: z.enum(["top","bottom","left","right"]), align: z.enum(["start","center","end"]), sideOffset: z.number().default(0), alignOffset: z.number().default(0) }),
    execute: wrapExecute("agent_place", async ({ shapeId, referenceShapeId, side, align, sideOffset, alignOffset }: any): Promise<ToolResult<string>> => {
      await runtime.whiteboard.dispatchAction({ _type: "place", intent: "Place shape", shapeId, referenceShapeId, side, align, sideOffset, alignOffset });
      return { status: 'ok', summary: `placed ${shapeId} ${side} of ${referenceShapeId}` };
    }),
  } as const;

  const agent_pen = {
    name: "agent_pen",
    description: "Draw a path with the pen.",
    parameters: z.object({ points: z.array(z.object({ x: z.number(), y: z.number() })), style: z.enum(["smooth","straight"]).default("smooth"), closed: z.boolean().default(false), color: z.string().default("blue"), fill: z.enum(["none","tint","background","solid","pattern"]).default("none") }),
    execute: wrapExecute("agent_pen", async ({ points, style, closed, color, fill }: any): Promise<ToolResult<string>> => {
      await runtime.whiteboard.dispatchAction({ _type: "pen", intent: "Draw path", points, style, closed, color, fill });
      return { status: 'ok', summary: `drew ${points.length} points` };
    }),
  } as const;

  const agent_update = {
    name: "agent_update",
    description: "Update a shape's properties.",
    parameters: z.object({
      shapeId: z.string(),
      text: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
      fill: z.enum(["none","tint","background","solid","pattern"]).nullable().optional(),
      x: z.number().nullable().optional(),
      y: z.number().nullable().optional(),
      w: z.number().nullable().optional(),
      h: z.number().nullable().optional(),
      geo: z.string().nullable().optional(),
    }),
    execute: wrapExecute("agent_update", async ({ shapeId, text, color, fill, x, y, w, h, geo }: any): Promise<ToolResult<string>> => {
      const update: any = { shapeId };
      if (typeof text !== 'undefined' && text !== null) update.label = String(text);
      if (typeof color !== 'undefined' && color !== null) update.color = String(color);
      if (typeof fill !== 'undefined' && fill !== null) update.fill = fill as any;
      if (typeof x === 'number') update.x = x;
      if (typeof y === 'number') update.y = y;
      if (typeof w === 'number') update.w = w;
      if (typeof h === 'number') update.h = h;
      if (typeof geo === 'string') update.geo = coerceGeo(geo, runtime.appendLog);
      await runtime.whiteboard.dispatchAction({ _type: "update", intent: "Update shape", update });
      return { status: 'ok', summary: `updated ${shapeId}` };
    }),
  } as const;

  const agent_get_text_context = {
    name: "agent_get_text_context",
    description: "Return visible texts from shapes in the viewport.",
    parameters: z.object({}),
    execute: wrapExecute("agent_get_text_context", async (): Promise<string> => {
      const items = runtime.whiteboard.getVisibleTextItems();
      return JSON.stringify({ items });
    }),
  } as const;

  const agent_send_view_image = {
    name: "agent_send_view_image",
    description: "Capture the current viewport and attach to conversation.",
    parameters: z.object({ triggerResponse: z.boolean().default(true) }),
    execute: wrapExecute("agent_send_view_image", async ({ triggerResponse }: any): Promise<ToolResult<string>> => {
      const url = await runtime.whiteboard.getScreenshot();
      if (!url || url === "null") return { status: 'error', summary: 'no-visible-shapes' };
      runtime.appendLog?.(`[transport] conversation.item.create (image length=${url.length})`);
      runtime.sendTransportEvent?.({
        type: 'conversation.item.create',
        item: { type: 'message', role: 'user', content: [{ type: 'input_image', image_url: url }] },
      });
      if (triggerResponse) {
        runtime.appendLog?.(`[transport] response.create`);
        runtime.sendTransportEvent?.({ type: 'response.create' });
      }
      return { status: 'ok', summary: 'image-shared' };
    }),
  } as const;

  const agent_capture_view_image = {
    name: "agent_capture_view_image",
    description: "Return a data URL JPEG of the current viewport.",
    parameters: z.object({}),
    execute: wrapExecute("agent_capture_view_image", async (): Promise<string> => {
      const url = await runtime.whiteboard.getScreenshot();
      return url ?? "null";
    }),
  } as const;

  const agent_set_view = {
    name: "agent_set_view",
    description: "Move the agent's viewport to bounds.",
    parameters: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
    execute: wrapExecute("agent_set_view", async ({ x, y, w, h }: any): Promise<ToolResult<string>> => {
      await runtime.whiteboard.dispatchAction({ _type: "setMyView", intent: "Move camera", x, y, w, h });
      return { status: 'ok', summary: `viewport set (${x},${y},${w},${h})` };
    }),
  } as const;

  const agent_get_view_context = {
    name: "agent_get_view_context",
    description: "Get viewport bounds and summarized shapes/context.",
    parameters: z.object({}),
    execute: wrapExecute("agent_get_view_context", async (): Promise<string> => {
      const ctx = runtime.whiteboard.getViewContext();
      return JSON.stringify(ctx);
    }),
  } as const;

  const agent_get_screenshot = {
    name: "agent_get_screenshot",
    description: "Get a JPEG data URL of the current viewport.",
    parameters: z.object({}),
    execute: wrapExecute("agent_get_screenshot", async (): Promise<string> => {
      const url = await runtime.whiteboard.getScreenshot();
      return url ?? "null";
    }),
  } as const;

  return [
    agent_get_view_context,
    agent_get_screenshot,
    agent_send_view_image,
    agent_capture_view_image,
    agent_create_shape,
    agent_create,
    agent_create_text,
    agent_move,
    agent_label,
    agent_set_view,
    agent_delete,
    agent_clear,
    agent_align,
    agent_distribute,
    agent_stack,
    agent_rotate,
    agent_resize,
    agent_bring_to_front,
    agent_send_to_back,
    agent_place,
    agent_pen,
    agent_update,
    agent_get_text_context,
  ];
}


