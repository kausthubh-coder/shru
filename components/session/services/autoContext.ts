import type { MutableRefObject } from "react";
import {
  getViewContext,
  getViewportScreenshot,
} from "@/lib/viewContext";

type ViewContextEditor = Parameters<typeof getViewContext>[0];
type TransportLike = { sendEvent?: (evt: unknown) => void };
type SessionLike = { transport?: TransportLike };

export async function sendAutoContext(
  editorRef: MutableRefObject<unknown>,
  agentRef: MutableRefObject<unknown>,
  sessionRef: MutableRefObject<unknown>,
  appendLog: (line: string) => void,
  setDebugContext: (v: { text?: string; imageUrl?: string | null; ts: number } | null) => void,
  triggerResponse: boolean = false,
  ideSnapshot?: { name: string; language: string; content: string } | null,
  notesYaml?: string,
): Promise<'ok' | 'no-session' | 'error'> {
  const session = sessionRef.current as SessionLike | null;
  const transport = session?.transport;
  if (!transport || typeof transport.sendEvent !== "function") return 'no-session';
  try {
    const ctx = getViewContext(editorRef.current as ViewContextEditor, agentRef.current);
    const whiteboard = {
      bounds: ctx.bounds,
      blurryShapes: Array.isArray(ctx.blurryShapes) ? ctx.blurryShapes.slice(0, 60) : [],
      peripheralClusters: Array.isArray(ctx.peripheralClusters) ? ctx.peripheralClusters.slice(0, 32) : [],
      selectedShapes: Array.isArray(ctx.selectedShapes) ? ctx.selectedShapes.slice(0, 20) : [],
    };
    const workspace = {
      type: 'workspace_context',
      whiteboard,
      ide: ideSnapshot ? { name: ideSnapshot.name, language: ideSnapshot.language, content: ideSnapshot.content } : null,
      notes: { yaml: String(notesYaml ?? '') },
    };
    const text = JSON.stringify(workspace);
    appendLog(`[transport] conversation.item.create (auto-context text ${text.length} chars)`);
    transport.sendEvent({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
    });
    const url = await getViewportScreenshot(editorRef.current as ViewContextEditor);
    if (url && url !== 'null') {
      appendLog(`[transport] conversation.item.create (auto-context image length=${url.length})`);
      transport.sendEvent({
        type: 'conversation.item.create',
        item: { type: 'message', role: 'user', content: [{ type: 'input_image', image_url: url }] },
      });
    }
    setDebugContext({ text, imageUrl: url ?? null, ts: Date.now() });
    if (triggerResponse) {
      // Small debounce to ensure context items arrive before response is generated
      await new Promise((r) => setTimeout(r, 120));
      appendLog('[transport] response.create (after auto-context + 120ms)');
      transport.sendEvent({ type: 'response.create' });
    }
    return 'ok';
  } catch (e: unknown) {
    appendLog(`auto-context error: ${e instanceof Error ? e.message : String(e)}`);
    return 'error';
  }
}


