import { getViewContext, getViewportScreenshot } from "../../lib/viewContext";

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

export async function buildAutoContextPayload(
  editorRef: React.MutableRefObject<any>,
  agentRef: React.MutableRefObject<any>,
  ideSnapshot?: { name: string; language: string; content: string } | null,
  notesYaml?: string,
): Promise<{ text: string; imageUrl: string | null; jsonHash: string; imageHash: string }> {
  const ctx = getViewContext(editorRef.current, agentRef.current);
  const whiteboard = {
    bounds: (ctx as any).bounds,
    blurryShapes: Array.isArray((ctx as any).blurryShapes) ? (ctx as any).blurryShapes.slice(0, 60) : [],
    peripheralClusters: Array.isArray((ctx as any).peripheralClusters) ? (ctx as any).peripheralClusters.slice(0, 32) : [],
    selectedShapes: Array.isArray((ctx as any).selectedShapes) ? (ctx as any).selectedShapes.slice(0, 20) : [],
  };
  const workspace = {
    type: "workspace_context",
    whiteboard,
    ide: ideSnapshot ? { name: ideSnapshot.name, language: ideSnapshot.language, content: ideSnapshot.content } : null,
    notes: { yaml: String(notesYaml ?? "") },
  };
  const text = JSON.stringify(workspace);
  const jsonHash = hashString(text);

  const imageUrl0 = await getViewportScreenshot(editorRef.current);
  const imageUrl = imageUrl0 && imageUrl0 !== "null" ? imageUrl0 : null;
  const imageHash = imageUrl ? hashString(imageUrl.slice(0, 512)) : "";

  return { text, imageUrl, jsonHash, imageHash };
}

export async function sendAutoContext(
  editorRef: React.MutableRefObject<any>,
  agentRef: React.MutableRefObject<any>,
  sessionRef: React.MutableRefObject<any>,
  appendLog: (line: string) => void,
  setDebugContext: DebugSetter,
  triggerResponse: boolean = false,
  ideSnapshot?: { name: string; language: string; content: string } | null,
  notesYaml?: string,
): Promise<'ok' | 'no-session' | 'noop' | 'error'> {
  const session = sessionRef.current;
  const transport = session?.transport;
  if (!transport) return 'no-session';

  try {
    const built = await buildAutoContextPayload(editorRef, agentRef, ideSnapshot, notesYaml);
    const text = built.text;
    const imageUrl = built.imageUrl;
    const jsonHash = built.jsonHash;
    const imageHash = built.imageHash;

    const key = session as object;
    const last = key ? lastBySession.get(key) : undefined;
    const now = Date.now();
    if (last && last.jsonHash === jsonHash && last.imageHash === imageHash && now - last.ts < 300) {
      return 'noop';
    }

    const content: Array<any> = [{ type: 'input_text', text }];
    if (imageUrl) content.push({ type: 'input_image', image_url: imageUrl });

    appendLog(
      `[transport] conversation.item.create (auto-context combined parts: text ${text.length} chars${imageUrl ? `, image length=${imageUrl.length}` : ""})`,
    );
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
  } catch (e: any) {
    appendLog(`auto-context error: ${String(e?.message ?? e)}`);
    return 'error';
  }
}


