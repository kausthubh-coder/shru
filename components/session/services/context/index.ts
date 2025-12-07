import type { MutableRefObject } from "react";
import {
  getViewContext,
  getViewportScreenshot,
} from "@/lib/viewContext";

type ViewContextEditor = Parameters<typeof getViewContext>[0];
type TransportLike = { sendEvent?: (evt: unknown) => void };
type SessionLike = { transport?: TransportLike };

type DebugSetter = (v: { text?: string; imageUrl?: string | null; ts: number } | null) => void;

type LastContext = { jsonHash: string; imageHash: string; ts: number };

const lastBySession = new WeakMap<object, LastContext>();

function hashString(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

export async function sendAutoContext(
  editorRef: MutableRefObject<unknown>,
  agentRef: MutableRefObject<unknown>,
  sessionRef: MutableRefObject<unknown>,
  appendLog: (line: string) => void,
  setDebugContext: DebugSetter,
  triggerResponse: boolean = false,
  ideSnapshot?: { name: string; language: string; content: string } | null,
  notesYaml?: string,
): Promise<'ok' | 'no-session' | 'noop' | 'error'> {
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
    const jsonHash = hashString(text);

    const imageUrl = await getViewportScreenshot(editorRef.current as ViewContextEditor);
    const imageHash = imageUrl && imageUrl !== 'null' ? hashString(imageUrl.slice(0, 512)) : '';

    const key = session as object;
    const last = key ? lastBySession.get(key) : undefined;
    const now = Date.now();
    if (last && last.jsonHash === jsonHash && last.imageHash === imageHash && now - last.ts < 300) {
      return 'noop';
    }

    const content: Array<{ type: string; text?: string; image_url?: string }> = [{ type: 'input_text', text }];
    if (imageUrl && imageUrl !== 'null') content.push({ type: 'input_image', image_url: imageUrl });

    appendLog(`[transport] conversation.item.create (auto-context combined parts: text ${text.length} chars${imageUrl ? `, image length=${imageUrl.length}` : ''})`);
    transport.sendEvent({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content },
    });

    setDebugContext({ text, imageUrl: imageUrl ?? null, ts: now });
    if (key) lastBySession.set(key, { jsonHash, imageHash, ts: now });

    if (triggerResponse) {
      await new Promise((r) => setTimeout(r, 120));
      appendLog('[transport] response.create (after combined auto-context + 120ms)');
      transport.sendEvent({ type: 'response.create' });
    }
    return 'ok';
  } catch (e: unknown) {
    appendLog(`auto-context error: ${e instanceof Error ? e.message : String(e)}`);
    return 'error';
  }
}


