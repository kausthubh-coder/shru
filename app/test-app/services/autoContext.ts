import { getViewContext, getViewportScreenshot } from "../lib/viewContext";

export async function sendAutoContext(
  editorRef: React.MutableRefObject<any>,
  agentRef: React.MutableRefObject<any>,
  sessionRef: React.MutableRefObject<any>,
  appendLog: (line: string) => void,
  setDebugContext: (v: any) => void,
  triggerResponse: boolean = false,
  ideSnapshot?: { name: string; language: string; content: string } | null,
  notesYaml?: string,
): Promise<'ok' | 'no-session' | 'error'> {
  const session = sessionRef.current;
  const transport = session?.transport;
  if (!transport) return 'no-session';
  try {
    const ctx = getViewContext(editorRef.current, agentRef.current);
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
    const url = await getViewportScreenshot(editorRef.current);
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
  } catch (e: any) {
    appendLog(`auto-context error: ${String(e?.message ?? e)}`);
    return 'error';
  }
}


