"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Tldraw, Box } from "tldraw";
import "tldraw/tldraw.css";
import { TldrawAgent } from "../../agent/client/agent/TldrawAgent";
import { AgentHelpers } from "../../agent/shared/AgentHelpers";
import { convertTldrawShapeToSimpleShape } from "../../agent/shared/format/convertTldrawShapeToSimpleShape";
import { convertTldrawShapeToBlurryShape } from "../../agent/shared/format/convertTldrawShapeToBlurryShape";
import { convertTldrawShapesToPeripheralShapes } from "../../agent/shared/format/convertTldrawShapesToPeripheralShapes";

// Dynamically load Monaco on client only
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<any>;
  }
}

let pyodideInstancePromise: Promise<any> | null = null;
async function loadPyodideOnce() {
  if (!pyodideInstancePromise) {
    pyodideInstancePromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js";
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    }).then(() => {
      if (!window.loadPyodide) throw new Error("Pyodide loader not found");
      return window.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.0/full/",
      });
    });
  }
  return pyodideInstancePromise;
}

type PythonWindowState = {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  code: string;
  outputs: Array<{ type: "stdout" | "stderr"; text: string; ts: number }>;
};

function useDragResize(
  x: number,
  y: number,
  w: number,
  h: number,
  onChange: (next: { x: number; y: number; w: number; h: number }) => void,
) {
  const draggingRef = useRef<{
    kind: "move" | "resize" | null;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const s = draggingRef.current;
      if (!s) return;
      e.preventDefault();
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      if (s.kind === "move") {
        onChange({ x: s.origX + dx, y: s.origY + dy, w, h });
      } else if (s.kind === "resize") {
        const minW = 360;
        const minH = 240;
        onChange({
          x,
          y,
          w: Math.max(minW, s.origW + dx),
          h: Math.max(minH, s.origH + dy),
        });
      }
    },
    [onChange, w, h, x, y],
  );

  const endDrag = useCallback(() => {
    draggingRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
  }, [onPointerMove]);

  const beginMove = useCallback(
    (e: React.PointerEvent) => {
      draggingRef.current = {
        kind: "move",
        startX: e.clientX,
        startY: e.clientY,
        origX: x,
        origY: y,
        origW: w,
        origH: h,
      };
      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", endDrag);
    },
    [x, y, w, h, onPointerMove, endDrag],
  );

  const beginResize = useCallback(
    (e: React.PointerEvent) => {
      draggingRef.current = {
        kind: "resize",
        startX: e.clientX,
        startY: e.clientY,
        origX: x,
        origY: y,
        origW: w,
        origH: h,
      };
      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", endDrag);
    },
    [x, y, w, h, onPointerMove, endDrag],
  );

  return { beginMove, beginResize };
}

function PythonWindow({
  win,
  onChange,
  onClose,
}: {
  win: PythonWindowState;
  onChange: (next: Partial<PythonWindowState>) => void;
  onClose: () => void;
}) {
  const { beginMove, beginResize } = useDragResize(
    win.x,
    win.y,
    win.w,
    win.h,
    ({ x, y, w, h }) => onChange({ x, y, w, h }),
  );

  const [running, setRunning] = useState(false);

  const runCode = useCallback(async () => {
    try {
      setRunning(true);
      const pyodide = await loadPyodideOnce();
      // Redirect stdout/stderr
      const out: Array<{ type: "stdout" | "stderr"; text: string; ts: number }> = [];
      const print = (s: string) => out.push({ type: "stdout", text: String(s), ts: Date.now() });
      const printerr = (s: string) => out.push({ type: "stderr", text: String(s), ts: Date.now() });
      pyodide.setStdout({ batched: (s: string) => print(s) });
      pyodide.setStderr({ batched: (s: string) => printerr(s) });
      await pyodide.runPythonAsync(win.code);
      onChange({ outputs: [...win.outputs, ...out] });
    } catch (err: any) {
      onChange({ outputs: [...win.outputs, { type: "stderr", text: String(err?.message ?? err), ts: Date.now() }] });
    } finally {
      setRunning(false);
    }
  }, [win.code, win.outputs, onChange]);

  return (
    <div
      className="absolute rounded-lg border bg-white/90 dark:bg-slate-900/90 shadow-lg overflow-hidden"
      style={{ left: win.x, top: win.y, width: win.w, height: win.h }}
    >
      <div
        className="h-9 px-3 flex items-center justify-between border-b bg-slate-50 dark:bg-slate-800 cursor-move select-none"
        onPointerDown={beginMove}
      >
        <div className="text-sm font-medium">{win.title}</div>
        <div className="flex items-center gap-2">
          <button
            className="text-xs px-2 py-1 rounded border"
            onClick={runCode}
            disabled={running}
          >
            {running ? "Running..." : "Run"}
          </button>
          <button className="text-xs px-2 py-1 rounded border" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="w-full h-[60%]">
        <MonacoEditor
          theme="vs-dark"
          defaultLanguage="python"
          value={win.code}
          onChange={(v) => onChange({ code: v ?? "" })}
          options={{ fontSize: 14, minimap: { enabled: false } }}
        />
      </div>
      <div className="w-full h-[40%] border-t overflow-auto bg-slate-50 dark:bg-slate-900">
        <div className="p-2 space-y-1 text-xs">
          {win.outputs.length === 0 ? (
            <div className="text-slate-500">Outputs will appear here…</div>
          ) : (
            win.outputs.map((o, i) => (
              <pre key={i} className={o.type === "stderr" ? "text-red-600" : "text-slate-800 dark:text-slate-100"}>
                {o.text}
              </pre>
            ))
          )}
        </div>
      </div>
      <div
        className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize"
        onPointerDown={beginResize}
      />
    </div>
  );
}

export default function TestAppPage() {
  const [windows, setWindows] = useState<Array<PythonWindowState>>([]);
  const editorRef = useRef<any>(null);
  const agentRef = useRef<any>(null);

  // Voice agent/session state
  const sessionRef = useRef<any>(null);
  const [agentStatus, setAgentStatus] = useState<"disconnected"|"connecting"|"connected">("disconnected");
  const [toolBusy, setToolBusy] = useState(false);
  const [logs, setLogs] = useState<Array<string>>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const audioCtxRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const unsubTransportRef = useRef<null | (() => void)>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const waitingResponseRef = useRef<boolean>(false);
  const sessionReadyRef = useRef<boolean>(false);

  // Workspace UI state
  const [activeTab, setActiveTab] = useState<"whiteboard" | "code" | "notes">("whiteboard");
  const [showLogs, setShowLogs] = useState<boolean>(true);
  const [showContext, setShowContext] = useState<boolean>(false);
  const [showCalls, setShowCalls] = useState<boolean>(false);

  // Debug: latest auto-context sent to the model
  const [debugContext, setDebugContext] = useState<{
    text?: string;
    imageUrl?: string | null;
    ts: number;
  } | null>(null);

  // Debug: structured tool call events
  type ToolEvent = { ts: number; rid: string; name: string; status: 'start'|'done'|'error'; args?: any; result?: any; ms?: number; err?: string };
  const [toolEvents, setToolEvents] = useState<Array<ToolEvent>>([]);
  const [languageLock] = useState<boolean>(true);

  // Output (AI) audio meter
  const [outputLevel, setOutputLevel] = useState(0);
  const rafOutRef = useRef<number | null>(null);

  // Simple in-memory IDE workspace
  type IdeFile = { id: string; name: string; language: string; content: string };
  const [files, setFiles] = useState<Array<IdeFile>>([
    {
      id: "file-1",
      name: "main.py",
      language: "python",
      content: "# Welcome to the workspace\nprint('Hello from the IDE tab')\n",
    },
  ]);
  const [activeFileId, setActiveFileId] = useState<string>("file-1");
  const activeFile = useMemo(() => files.find((f) => f.id === activeFileId) ?? files[0], [files, activeFileId]);
  const updateActiveFileContent = useCallback(
    (next: string) => {
      setFiles((prev) => prev.map((f) => (f.id === activeFileId ? { ...f, content: next } : f)));
    },
    [activeFileId],
  );
  const createFile = useCallback((name: string, language: string, content: string) => {
    const id = `file-${Date.now()}`;
    setFiles((prev) => [...prev, { id, name, language, content }]);
    setActiveFileId(id);
  }, []);

  // Notes / markdown doc content
  const [notesText, setNotesText] = useState<string>("# Notes\nWrite here…\n");

  const appendLog = useCallback((line: string) => setLogs((l) => [line, ...l].slice(0, 50)), []);

  const randomId = useCallback(() => Math.random().toString(36).slice(2), []);

  const dispatchAction = useCallback(async (action: any) => {
    const agent = agentRef.current;
    if (!agent) throw new Error("Agent not ready");
    const rid = Math.random().toString(36).slice(2, 8);
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const safeJson = (v: any, limit = 400) => {
      try { const s = JSON.stringify(v); return s.length > limit ? s.slice(0, limit) + '…' : s; } catch { return '[unserializable]'; }
    };
    const summarizeDiff = (diff: any) => {
      try {
        let aS = 0, aO = 0, uS = 0, uO = 0, rS = 0, rO = 0;
        for (const k in (diff?.added ?? {})) {
          const rec = (diff.added as any)[k];
          if (rec?.typeName === 'shape') aS++; else aO++;
        }
        for (const k in (diff?.updated ?? {})) {
          const recAfter = (diff.updated as any)[k]?.[1];
          if (recAfter?.typeName === 'shape') uS++; else uO++;
        }
        for (const k in (diff?.removed ?? {})) {
          const rec = (diff.removed as any)[k];
          if (rec?.typeName === 'shape') rS++; else rO++;
        }
        return `diff: +${aS}/${aO} ~${uS}/${uO} -${rS}/${rO}`;
      } catch {
        return 'diff: n/a';
      }
    };
    appendLog(`[act:start] rid=${rid} ${safeJson(action)}`);
    setToolBusy(true);
    try {
      const { diff, promise } = agent.act({ ...action, complete: true, time: 0 });
      await promise;
      const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      appendLog(`[act:done] rid=${rid} ${Math.round(t1 - t0)}ms ${summarizeDiff(diff)}`);
    } catch (e: any) {
      const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      appendLog(`[act:error] rid=${rid} ${Math.round(t1 - t0)}ms ${String(e?.message ?? e)}`);
      throw e;
    } finally {
      setToolBusy(false);
    }
  }, [appendLog]);

  const getViewContext = useCallback(() => {
    const editor = editorRef.current;
    const agent = agentRef.current;
    if (!editor || !agent) throw new Error("Editor/agent not ready");
    const helpers = new AgentHelpers(agent);
    const viewport = editor.getViewportPageBounds();
    const bounds = helpers.applyOffsetToBox(viewport);
    const allShapes = editor.getCurrentPageShapesSorted();
    const inView = allShapes.filter((s: any) => {
      const b = editor.getShapeMaskedPageBounds(s);
      return b && b.collides(viewport);
    });
    const outView = allShapes.filter((s: any) => {
      const b = editor.getShapeMaskedPageBounds(s);
      return b && !b.collides(viewport);
    });
    const blurryShapes = inView
      .map((s: any) => convertTldrawShapeToBlurryShape(editor, s))
      .filter(Boolean);
    const peripheralClusters = convertTldrawShapesToPeripheralShapes(editor, outView, { padding: 8 });
    const selectedShapes = editor
      .getSelectedShapes()
      .map((shape: any) => convertTldrawShapeToSimpleShape(editor, shape));
    return { bounds, blurryShapes, peripheralClusters, selectedShapes };
  }, []);

  const getScreenshot = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) throw new Error("Editor not ready");
    const viewport = editor.getViewportPageBounds();
    const shapes = editor.getCurrentPageShapesSorted().filter((s: any) => {
      const b = editor.getShapeMaskedPageBounds(s);
      return b && b.collides(viewport);
    });
    if (!shapes.length) return null;
    const result = await editor.toImage(shapes, { format: "jpeg", background: true, bounds: Box.From(viewport), padding: 0, pixelRatio: 1, scale: 1 });
    const blob = result.blob as Blob;
    const toDataUrl = () => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return await toDataUrl();
  }, []);

  const fetchEphemeralToken = useCallback(async () => {
    // Prefer configured Convex site URL; fallback to known deployment to avoid 404s on Next host
    const base = (process.env.NEXT_PUBLIC_CONVEX_SITE_URL as string | undefined) ?? "https://adorable-canary-627.convex.site";
    const url = `${base.replace(/\/$/, "")}/realtime/token`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
    const data = await res.json();
    if (!data?.value) throw new Error("Invalid token response");
    return data.value as string;
  }, []);

  // Configure the realtime session (declared after helpers to avoid TDZ)
  let configureSession = (async () => {}) as unknown as () => Promise<void>;

  // Build multi-section tutor instructions
  const buildTutorInstructions = useCallback(() => {
    return [
      '# Studi Tutor — Operating Rules',
      '',
      '## Role & Objective',
      '- You are a friendly, concise human tutor on an infinite whiteboard. Teach, explain, and clarify while keeping the board tidy.',
      '',
      '## Style & Verbosity',
      '- Voice output: 2–3 short sentences per turn; brisk but not rushed.',
      '- Use plain language. Only brief tool preambles. Avoid rambling.',
      '- Speak English only. Do not switch languages. If asked to switch, politely decline and continue in English.',
      '',
      '## Auto Context (use first)',
      '- Before most responses you will receive: (1) a compact JSON block named "view_context" (viewport bounds + summarized shapes) and (2) a screenshot of the current viewport.',
      '- Treat these as your primary context. Call extra tools only if you truly need more or to change the canvas.',
      '',
      '## Agentic Eagerness & Persistence',
      '- Default reasoning effort: low-to-medium. Prefer quick, correct action over overthinking.',
      '- Context gathering budget per turn: usually ≤ 2 tool calls. Escalate beyond this only if needed for correctness.',
      '- You are an agent: keep going until the user\'s request is fully resolved. Do not hand back at uncertainty—make the most reasonable assumption, act, and note it.',
      '',
      '## Tool Preambles (concise)',
      '- Rephrase the user\'s goal in one short sentence, then outline a 1–3 step plan.',
      '- Before each tool call say one short line (e.g., “Let me align these.”). Keep status updates minimal.',
      '- After a sequence of tools, give a one-line summary of what changed.',
      '',
      '## Whiteboard Reading & Layout',
      '- For pen-drawn math/text, reason over the provided screenshot. If needed, zoom with agent_set_view, then optionally call agent_get_text_context (for visible text shapes only).',
      '- Prefer layout tools (agent_align, agent_distribute, agent_stack, agent_place) over guessing coordinates.',
      '- Use z-order tools only when overlapping matters.',
      '- For drawing tasks (e.g., “draw a cat” or “make a simple math problem”), do not ask clarifying questions; choose sensible defaults and draw immediately. Use ellipses/triangles/rectangles, default sizes (~120×90), and place near the current viewport center.',
      '',
      '## Action Safety & Verification',
      '- Perform small, atomic steps. After create/move/update, verify the result (e.g., shape exists; position change within tolerance). If verification fails, fix or roll back with a minimal correction.',
      '- Ask for explicit confirmation before destructive actions (e.g., clearing the canvas).',
      '',
      '## Drawing Guidance',
      '- Compose complex objects from multiple shapes. Prefer tint/background fills over large solid-black areas; choose contrasting strokes for clarity.',
      '',
      '## Markdown (when applicable)',
      '- Use Markdown only when semantically helpful (bullets, short code fences, inline math). Keep it minimal in voice responses.',
    ].join('\n');
  }, []);

  // Send compact auto-context (viewport + shapes + image)
  const sendAutoContext = useCallback(async (triggerResponse: boolean = false) => {
    const session = sessionRef.current;
    const transport = session?.transport;
    if (!transport) return 'no-session';
    try {
      const ctx = getViewContext();
      const compact = {
        type: 'view_context',
        bounds: ctx.bounds,
        blurryShapes: Array.isArray(ctx.blurryShapes) ? ctx.blurryShapes.slice(0, 60) : [],
        peripheralClusters: Array.isArray(ctx.peripheralClusters) ? ctx.peripheralClusters.slice(0, 32) : [],
        selectedShapes: Array.isArray(ctx.selectedShapes) ? ctx.selectedShapes.slice(0, 20) : [],
      };
      const text = JSON.stringify(compact);
      appendLog(`[transport] conversation.item.create (auto-context text ${text.length} chars)`);
      transport.sendEvent({
        type: 'conversation.item.create',
        item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
      });
      const url = await getScreenshot();
      if (url && url !== 'null') {
        appendLog(`[transport] conversation.item.create (auto-context image length=${url.length})`);
        transport.sendEvent({
          type: 'conversation.item.create',
          item: { type: 'message', role: 'user', content: [{ type: 'input_image', image_url: url }] },
        });
      }
      setDebugContext({ text, imageUrl: url ?? null, ts: Date.now() });
      if (triggerResponse) {
        appendLog('[transport] response.create (after auto-context)');
        transport.sendEvent({ type: 'response.create' });
      }
      return 'ok';
    } catch (e: any) {
      appendLog(`auto-context error: ${String(e?.message ?? e)}`);
      return 'error';
    }
  }, [appendLog, getViewContext, getScreenshot]);

  // Now that helpers exist, define configureSession
  configureSession = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      appendLog('[transport] session.update -> tutor prompt, voice, modalities');
      session.transport?.sendEvent?.({
        type: 'session.update',
        session: {
          type: 'realtime',
          model: 'gpt-realtime',
          output_modalities: ['audio'],
          audio: {
            input: {
              format: { type: 'audio/pcm', rate: 24000 },
              turn_detection: { type: 'semantic_vad', eagerness: 'medium', create_response: true, interrupt_response: true },
            },
            output: { format: { type: 'audio/pcm' }, voice: 'marin' },
          },
          instructions: buildTutorInstructions(),
        },
      } as any);
      try { await sendAutoContext(false); } catch {}
    } catch (e: any) {
      appendLog(`session.update error: ${String(e?.message ?? e)}`);
    }
  }, [appendLog, buildTutorInstructions, sendAutoContext]);

  const addPython = useCallback(() => {
    const id = `python-${Date.now()}`;
    setWindows((prev) => [
      ...prev,
      {
        id,
        title: "Python: Scratchpad",
        x: 40,
        y: 40,
        w: 640,
        h: 420,
        code: "print('Hello from Pyodide!')",
        outputs: [],
      },
    ]);
  }, []);

  const updateWin = useCallback((id: string, next: Partial<PythonWindowState>) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, ...next } : w)));
  }, []);

  const removeWin = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  // Whiteboard helpers (simple structured ops)
  const addBox = useCallback((x: number, y: number) => {
    try {
      editorRef.current?.createShape({ type: "geo", x, y } as any);
      appendLog(`create_box at (${x}, ${y})`);
    } catch (e) {
      appendLog(`create_box error: ${String((e as any)?.message ?? e)}`);
    }
  }, [appendLog]);

  const addText = useCallback((x: number, y: number, text: string) => {
    try {
      editorRef.current?.createShape({
        type: "geo",
        x,
        y,
        props: { w: 240, h: 80, geo: "rectangle", text: text ?? "" },
      } as any);
      appendLog(`add_text "${text}" as geo at (${x}, ${y})`);
    } catch (e) {
      appendLog(`add_text error: ${String((e as any)?.message ?? e)}`);
    }
  }, [appendLog]);

  // Voice agent start/stop with tools
  const startAgent = useCallback(async () => {
    if (agentStatus !== "disconnected") return;
    setAgentStatus("connecting");
    appendLog("Starting voice agent...");
    try {
      const token = await fetchEphemeralToken();
      const mod = await import("@openai/agents/realtime");
      const zmod = await import("zod");
      const { RealtimeAgent, RealtimeSession, tool, OpenAIRealtimeWebRTC } = mod as any;
      const { z } = zmod as any;

      // Tool logging helpers
      const safeToolJson = (v: any, limit = 600) => {
        try {
          const s = JSON.stringify(v);
          return s.length > limit ? s.slice(0, limit) + "…" : s;
        } catch {
          return "[unserializable]";
        }
      };
      const wrapExecute = (
        name: string,
        fn: (args: any, details?: any) => Promise<any> | any,
      ) => async (args: any, details?: any) => {
        const rid = Math.random().toString(36).slice(2, 8);
        const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
         appendLog(`[tool:start] ${name} rid=${rid} args=${safeToolJson(args)}`);
        try { setToolEvents((prev: Array<ToolEvent>) => [{ ts: Date.now(), rid, name, status: 'start' as const, args }, ...prev].slice(0, 100)); } catch {}
        try {
           const res = await fn(args, details);
          const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          const ms = Math.round(t1 - t0);
           appendLog(`[tool:done] ${name} rid=${rid} ${ms}ms result=${typeof res === 'string' ? res : safeToolJson(res)}`);
          try { setToolEvents((prev: Array<ToolEvent>) => [{ ts: Date.now(), rid, name, status: 'done' as const, result: res, ms }, ...prev].slice(0, 100)); } catch {}
          return res;
        } catch (e: any) {
          const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          const ms = Math.round(t1 - t0);
          const stack = e?.stack ? String(e.stack).slice(0, 600) : '';
          appendLog(`[tool:error] ${name} rid=${rid} ${ms}ms err=${String(e?.message ?? e)}${stack ? ` stack=${stack}` : ''}`);
          try { setToolEvents((prev: Array<ToolEvent>) => [{ ts: Date.now(), rid, name, status: 'error' as const, err: String(e?.message ?? e), ms }, ...prev].slice(0, 100)); } catch {}
          throw e;
        }
       };

      // Tools — Agent Actions
      const agentDelete = tool({
        name: "agent_delete",
        description: "Delete a shape by simple id.",
        parameters: z.object({ shapeId: z.string() }),
        execute: wrapExecute("agent_delete", async ({ shapeId }: any) => {
          await dispatchAction({ _type: "delete", intent: "Delete shape", shapeId });
          return `deleted ${shapeId}`;
        }),
      });

      const agentClear = tool({
        name: "agent_clear",
        description: "Clear the canvas (delete all shapes).",
        parameters: z.object({}),
        execute: wrapExecute("agent_clear", async () => {
          await dispatchAction({ _type: "clear" });
          return "cleared canvas";
        }),
      });

      const agentCreateShape = tool({
        name: "agent_create_shape",
        description: "Create a geo shape (rectangle, ellipse, triangle, diamond, etc.) with optional text/color/fill.",
        parameters: z.object({
          geo: z.enum(["rectangle","ellipse","triangle","diamond","pentagon","hexagon","octagon","star","rhombus","parallelogram"]).default("ellipse"),
          x: z.number(),
          y: z.number(),
          w: z.number().default(100),
          h: z.number().default(100),
          text: z.string().nullable().optional(),
          color: z.string().default("black"),
          fill: z.enum(["none","tint","background","solid","pattern"]).default("none"),
        }),
        execute: wrapExecute("agent_create_shape", async ({ geo, x, y, w, h, text, color, fill }: any) => {
          const nx = (typeof x === 'number' && isFinite(x)) ? x : null;
          const ny = (typeof y === 'number' && isFinite(y)) ? y : null;
          const nw = (typeof w === 'number' && isFinite(w)) ? w : null;
          const nh = (typeof h === 'number' && isFinite(h)) ? h : null;
          if (nx === null || ny === null) return 'invalid position';
          if (nw === null || nh === null) return 'invalid size';
          await dispatchAction({
            _type: "create",
            intent: `Create ${geo}`,
            shape: {
              _type: geo,
              shapeId: randomId(),
              note: "",
              x: nx,
              y: ny,
              w: nw,
              h: nh,
              text: text ?? undefined,
              color,
              fill,
            },
          });
          return `created ${geo} at (${x},${y})`;
        }),
      });

      // Backward-compatible alias: some prompts/models will try calling agent_create
      const agentCreate = tool({
        name: "agent_create",
        description: "Create a shape (defaults to rectangle).",
        parameters: z.object({
          geo: z.enum(["rectangle","ellipse","triangle","diamond","pentagon","hexagon","octagon","star","rhombus","parallelogram"]).default("rectangle"),
          x: z.number(),
          y: z.number(),
          w: z.number().default(120),
          h: z.number().default(90),
          text: z.string().nullable().optional(),
          color: z.string().default("black"),
          fill: z.enum(["none","tint","background","solid","pattern"]).default("none"),
        }),
        execute: wrapExecute("agent_create", async ({ geo, x, y, w, h, text, color, fill }: any) => {
          const nx = (typeof x === 'number' && isFinite(x)) ? x : null;
          const ny = (typeof y === 'number' && isFinite(y)) ? y : null;
          const nw = (typeof w === 'number' && isFinite(w)) ? w : null;
          const nh = (typeof h === 'number' && isFinite(h)) ? h : null;
          if (nx === null || ny === null) return 'invalid position';
          if (nw === null || nh === null) return 'invalid size';
          await dispatchAction({
            _type: "create",
            intent: `Create ${geo}`,
            shape: {
              _type: geo,
              shapeId: randomId(),
              note: "",
              x: nx,
              y: ny,
              w: nw,
              h: nh,
              text: text ?? undefined,
              color,
              fill,
            },
          });
          return `created ${geo} at (${x},${y})`;
        }),
      });

      const agentMove = tool({
        name: "agent_move",
        description: "Move a shape by simple id to a new position.",
        parameters: z.object({ shapeId: z.string(), x: z.number(), y: z.number() }),
        execute: wrapExecute("agent_move", async ({ shapeId, x, y }: any) => {
          await dispatchAction({ _type: "move", intent: "Move shape", shapeId, x, y });
          return `moved ${shapeId} to (${x},${y})`;
        }),
      });

      const agentLabel = tool({
        name: "agent_label",
        description: "Set or change a shape's label/text.",
        parameters: z.object({ shapeId: z.string(), text: z.string() }),
        execute: wrapExecute("agent_label", async ({ shapeId, text }: any) => {
          await dispatchAction({ _type: "label", intent: "Label shape", shapeId, text });
          return `labeled ${shapeId}`;
        }),
      });

      const agentAlign = tool({
        name: "agent_align",
        description: "Align shapes by ids (top, bottom, left, right, center-horizontal, center-vertical).",
        parameters: z.object({ alignment: z.enum(["top","bottom","left","right","center-horizontal","center-vertical"]), shapeIds: z.array(z.string()), gap: z.number().default(0) }),
        execute: wrapExecute("agent_align", async ({ alignment, shapeIds, gap }: any) => {
          await dispatchAction({ _type: "align", intent: `Align ${shapeIds.length} shapes`, alignment, shapeIds, gap });
          return `aligned ${shapeIds.length} shapes (${alignment})`;
        }),
      });

      const agentDistribute = tool({
        name: "agent_distribute",
        description: "Distribute shapes (horizontal or vertical).",
        parameters: z.object({ direction: z.enum(["horizontal","vertical"]), shapeIds: z.array(z.string()), gap: z.number().default(0) }),
        execute: wrapExecute("agent_distribute", async ({ direction, shapeIds, gap }: any) => {
          await dispatchAction({ _type: "distribute", intent: `Distribute ${shapeIds.length} shapes`, direction, shapeIds, gap });
          return `distributed ${shapeIds.length} shapes (${direction})`;
        }),
      });

      const agentStack = tool({
        name: "agent_stack",
        description: "Stack shapes (vertical or horizontal).",
        parameters: z.object({ direction: z.enum(["vertical","horizontal"]), shapeIds: z.array(z.string()), gap: z.number().default(0.1) }),
        execute: wrapExecute("agent_stack", async ({ direction, shapeIds, gap }: any) => {
          await dispatchAction({ _type: "stack", intent: `Stack ${shapeIds.length} shapes`, direction, shapeIds, gap });
          return `stacked ${shapeIds.length} shapes (${direction})`;
        }),
      });

      const agentRotate = tool({
        name: "agent_rotate",
        description: "Rotate shapes around an origin by degrees.",
        parameters: z.object({ shapeIds: z.array(z.string()), degrees: z.number(), originX: z.number(), originY: z.number() }),
        execute: wrapExecute("agent_rotate", async ({ shapeIds, degrees, originX, originY }: any) => {
          await dispatchAction({ _type: "rotate", intent: `Rotate ${shapeIds.length} shapes`, shapeIds, degrees, originX, originY, centerY: 0 });
          return `rotated ${shapeIds.length} shapes by ${degrees}°`;
        }),
      });

      const agentResize = tool({
        name: "agent_resize",
        description: "Resize shapes with scaleX/scaleY relative to origin.",
        parameters: z.object({ shapeIds: z.array(z.string()), scaleX: z.number(), scaleY: z.number(), originX: z.number(), originY: z.number() }),
        execute: wrapExecute("agent_resize", async ({ shapeIds, scaleX, scaleY, originX, originY }: any) => {
          await dispatchAction({ _type: "resize", intent: `Resize ${shapeIds.length} shapes`, shapeIds, scaleX, scaleY, originX, originY });
          return `resized ${shapeIds.length} shapes`;
        }),
      });

      const agentBringToFront = tool({
        name: "agent_bring_to_front",
        description: "Bring shapes to front (z-order).",
        parameters: z.object({ shapeIds: z.array(z.string()) }),
        execute: wrapExecute("agent_bring_to_front", async ({ shapeIds }: any) => {
          await dispatchAction({ _type: "bringToFront", intent: `Bring to front`, shapeIds });
          return `brought ${shapeIds.length} to front`;
        }),
      });

      const agentSendToBack = tool({
        name: "agent_send_to_back",
        description: "Send shapes to back (z-order).",
        parameters: z.object({ shapeIds: z.array(z.string()) }),
        execute: wrapExecute("agent_send_to_back", async ({ shapeIds }: any) => {
          await dispatchAction({ _type: "sendToBack", intent: "Send to back", shapeIds });
          return `sent ${shapeIds.length} to back`;
        }),
      });

      const agentPlace = tool({
        name: "agent_place",
        description: "Place a shape relative to another (top/bottom/left/right with alignment/end/center/start).",
        parameters: z.object({ shapeId: z.string(), referenceShapeId: z.string(), side: z.enum(["top","bottom","left","right"]), align: z.enum(["start","center","end"]), sideOffset: z.number().default(0), alignOffset: z.number().default(0) }),
        execute: wrapExecute("agent_place", async ({ shapeId, referenceShapeId, side, align, sideOffset, alignOffset }: any) => {
          await dispatchAction({ _type: "place", intent: "Place shape", shapeId, referenceShapeId, side, align, sideOffset, alignOffset });
          return `placed ${shapeId} ${side} of ${referenceShapeId}`;
        }),
      });

      const agentPen = tool({
        name: "agent_pen",
        description: "Draw a path with the pen (points, style, closed, color, fill).",
        parameters: z.object({ points: z.array(z.object({ x: z.number(), y: z.number() })), style: z.enum(["smooth","straight"]).default("smooth"), closed: z.boolean().default(false), color: z.string().default("blue"), fill: z.enum(["none","tint","background","solid","pattern"]).default("none") }),
        execute: wrapExecute("agent_pen", async ({ points, style, closed, color, fill }: any) => {
          await dispatchAction({ _type: "pen", intent: "Draw path", points, style, closed, color, fill });
          return `drew ${points.length} points`;
        }),
      });

      const agentUpdate = tool({
        name: "agent_update",
        description: "Update a shape's properties (text, color, fill, size, position, geo).",
        parameters: z.object({
          shapeId: z.string(),
          text: z.string().nullable().optional(),
          color: z.string().nullable().optional(),
          fill: z.enum(["none","tint","background","solid","pattern"]).nullable().optional(),
          x: z.number().nullable().optional(),
          y: z.number().nullable().optional(),
          w: z.number().nullable().optional(),
          h: z.number().nullable().optional(),
          geo: z.enum(["rectangle","ellipse","triangle","diamond","pentagon","hexagon","octagon","star","rhombus","parallelogram"]).nullable().optional(),
        }),
        execute: wrapExecute("agent_update", async ({ shapeId, text, color, fill, x, y, w, h, geo }: any) => {
          const editor = editorRef.current;
          if (!editor) return "editor not ready";
          const tldId = `shape:${shapeId}`;
          const shape = editor.getShape(tldId);
          if (!shape) return `not found ${shapeId}`;
          const simple = convertTldrawShapeToSimpleShape(editor, shape);
          const update: any = { ...simple, shapeId };
          if (typeof text !== 'undefined' && text !== null) update.text = String(text);
          if (typeof color !== 'undefined' && color !== null) update.color = String(color);
          if (typeof fill !== 'undefined' && fill !== null) update.fill = fill as any;
          if (typeof x === 'number') update.x = x;
          if (typeof y === 'number') update.y = y;
          if (typeof w === 'number') update.w = w;
          if (typeof h === 'number') update.h = h;
          if (typeof geo === 'string' && update._type === 'geo') update.geo = geo;
          await dispatchAction({ _type: "update", intent: "Update shape", update });
          return `updated ${shapeId}`;
        }),
      });

      const agentGetTextContext = tool({
        name: "agent_get_text_context",
        description: "Return visible texts from shapes in the viewport for OCR-free reading.",
        parameters: z.object({}),
        execute: wrapExecute("agent_get_text_context", async () => {
          const editor = editorRef.current;
          if (!editor) return "editor not ready";
          const viewport = editor.getViewportPageBounds();
          const shapes = editor.getCurrentPageShapesSorted().filter((s: any) => {
            const b = editor.getShapeMaskedPageBounds(s);
            return b && b.collides(viewport);
          });
          const items = shapes.map((s: any) => {
            const simple = convertTldrawShapeToSimpleShape(editor, s) as any;
            const text = simple?.text ?? "";
            const note = simple?.note ?? "";
            return { shapeId: simple?.shapeId, type: simple?._type, text, note };
          }).filter((i: any) => (i.text && i.text.length) || (i.note && i.note.length));
          return JSON.stringify({ items });
        }),
      });

      // Share current viewport screenshot into the conversation as an input_image item
      const agentSendViewImage = tool({
        name: "agent_send_view_image",
        description: "Capture the current viewport as an image and attach it to the conversation.",
        parameters: z.object({ triggerResponse: z.boolean().default(true) }),
        execute: wrapExecute("agent_send_view_image", async ({ triggerResponse }: any) => {
          const url = await getScreenshot();
          if (!url || url === "null") return "no-visible-shapes";
          try {
            const session = sessionRef.current;
            const transport = session?.transport;
            appendLog(`[transport] conversation.item.create (image length=${url.length})`);
            transport?.sendEvent({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'user',
                content: [ { type: 'input_image', image_url: url } ],
              },
            });
            if (triggerResponse) {
              appendLog(`[transport] response.create`);
              transport?.sendEvent({ type: 'response.create' });
            }
            return 'image-shared';
          } catch (e: any) {
            return `error: ${String(e?.message ?? e)}`;
          }
        }),
      });

      // Return the current viewport screenshot as a data URL (fallback/non-attaching)
      const agentCaptureViewImage = tool({
        name: "agent_capture_view_image",
        description: "Return a data URL JPEG of the current viewport if shapes are visible.",
        parameters: z.object({}),
        execute: wrapExecute("agent_capture_view_image", async () => {
          const url = await getScreenshot();
          return url ?? "null";
        }),
      });

      const agentSetView = tool({
        name: "agent_set_view",
        description: "Move the agent's viewport to bounds.",
        parameters: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
        execute: wrapExecute("agent_set_view", async ({ x, y, w, h }: any) => {
          await dispatchAction({ _type: "setMyView", intent: "Move camera", x, y, w, h });
          return `viewport set (${x},${y},${w},${h})`;
        }),
      });

      // Tools — Read-only context
      const agentGetViewContext = tool({
        name: "agent_get_view_context",
        description: "Get viewport bounds and summarized shapes/context.",
        parameters: z.object({}),
        execute: wrapExecute("agent_get_view_context", async () => {
          const ctx = getViewContext();
          return JSON.stringify(ctx);
        }),
      });

      const agentGetScreenshot = tool({
        name: "agent_get_screenshot",
        description: "Get a JPEG data URL of the current viewport if shapes are visible.",
        parameters: z.object({}),
        execute: wrapExecute("agent_get_screenshot", async () => {
          const url = await getScreenshot();
          return url ?? "null";
        }),
      });

      // Existing Python demo tools (kept)
      const createPythonTool = tool({
        name: "create_python_window",
        description: "Create a new Python editor window.",
        parameters: z.object({ title: z.string().nullable() }),
        execute: wrapExecute("create_python_window", async ({ title }: { title: string | null }) => {
          setToolBusy(true);
          addPython();
          setToolBusy(false);
          return `created ${title ?? "Python: Scratchpad"}`;
        }),
      });

      const pythonSetCode = tool({
        name: "python_set_code",
        description: "Set code in the first Python window.",
        parameters: z.object({ code: z.string() }),
        execute: wrapExecute("python_set_code", async ({ code }: { code: string }) => {
          setToolBusy(true);
          setWindows((prev) => prev.length ? [{ ...prev[0], code }, ...prev.slice(1)] : prev);
          setToolBusy(false);
          return `code set (${code.length} chars)`;
        }),
      });

      const pythonRun = tool({
        name: "python_run",
        description: "Run code in the first Python window.",
        parameters: z.object({}),
        execute: wrapExecute("python_run", async () => {
          setToolBusy(true);
          // Trigger run by toggling a flag or reusing logic: call runCode-like by patching code (no-op) to keep simple
          // We'll append a small log and rely on user to click Run if needed.
          // For demo: ensure there is a window and append a hint output.
          setWindows((prev) => prev.length ? [
            { ...prev[0], outputs: [...prev[0].outputs, { type: "stdout", text: "[agent] run requested", ts: Date.now() }] },
            ...prev.slice(1)
          ] : prev);
          setToolBusy(false);
          return "run requested";
        }),
      });

      // IDE workspace tools
      const ideCreateFile = tool({
        name: "ide_create_file",
        description: "Create a new file in the IDE workspace.",
        parameters: z.object({ name: z.string(), language: z.string().default("typescript"), content: z.string().default("") }),
        execute: wrapExecute("ide_create_file", async ({ name, language, content }: any) => {
          setToolBusy(true);
          createFile(name, language, content ?? "");
          setToolBusy(false);
          return `created ${name}`;
        }),
      });

      const ideSetActive = tool({
        name: "ide_set_active",
        description: "Set the active file by name.",
        parameters: z.object({ name: z.string() }),
        execute: wrapExecute("ide_set_active", async ({ name }: any) => {
          setToolBusy(true);
          const f = files.find((f) => f.name === name);
          if (f) setActiveFileId(f.id);
          setToolBusy(false);
          return f ? `active ${name}` : `not found ${name}`;
        }),
      });

      const ideUpdateContent = tool({
        name: "ide_update_content",
        description: "Replace the active file's content.",
        parameters: z.object({ content: z.string() }),
        execute: wrapExecute("ide_update_content", async ({ content }: any) => {
          setToolBusy(true);
          updateActiveFileContent(String(content ?? ""));
          setToolBusy(false);
          return `updated content (${(content ?? "").length} chars)`;
        }),
      });

      const ideGetContext = tool({
        name: "ide_get_context",
        description: "Get JSON of files and active file.",
        parameters: z.object({}),
        execute: wrapExecute("ide_get_context", async () => {
          const ctx = { files: files.map((f) => ({ name: f.name, language: f.language, size: f.content.length })), active: activeFile?.name };
          return JSON.stringify(ctx);
        }),
      });

      // Notes tools
      const notesSetText = tool({
        name: "notes_set_text",
        description: "Replace the notes markdown text.",
        parameters: z.object({ text: z.string() }),
        execute: wrapExecute("notes_set_text", async ({ text }: any) => {
          setToolBusy(true);
          setNotesText(String(text ?? ""));
          setToolBusy(false);
          return `notes set (${(text ?? "").length} chars)`;
        }),
      });

      const notesAppend = tool({
        name: "notes_append",
        description: "Append markdown to the notes text.",
        parameters: z.object({ text: z.string() }),
        execute: wrapExecute("notes_append", async ({ text }: any) => {
          setToolBusy(true);
          setNotesText((prev) => `${prev}\n${String(text ?? "")}`);
          setToolBusy(false);
          return `notes appended (${(text ?? "").length} chars)`;
        }),
      });

      const agent = new RealtimeAgent({
        name: "Studi",
        // Keep initial instructions minimal; the full operating rules are injected via session.update
        instructions: "Studi is a realtime voice tutor. Speak naturally and concisely.",
        tools: [
          agentGetViewContext,
          agentGetScreenshot,
          agentSendViewImage,
          agentCaptureViewImage,
          agentCreateShape,
          agentCreate,
          agentMove,
          agentLabel,
          agentSetView,
          agentDelete,
          agentClear,
          agentAlign,
          agentDistribute,
          agentStack,
          agentRotate,
          agentResize,
          agentBringToFront,
          agentSendToBack,
          agentPlace,
          agentPen,
          agentUpdate,
          agentGetTextContext,
          ideCreateFile,
          ideSetActive,
          ideUpdateContent,
          ideGetContext,
          notesSetText,
          notesAppend,
          createPythonTool,
          pythonSetCode,
          pythonRun,
        ],
      });

      // Explicitly configure WebRTC transport with audio element for playback
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = mediaStream;
      // Apply current mute state to mic track(s)
      if (muted) {
        try { mediaStream.getAudioTracks().forEach((t) => (t.enabled = false)); } catch {}
      }
      try {
        const t = mediaStream.getAudioTracks()?.[0];
        if (t) {
          const s = t.getSettings?.() ?? {};
          appendLog(`mic track: ${t.label || 'unknown'} state=${t.readyState} deviceId=${(s as any).deviceId || 'n/a'}`);
        }
      } catch {}
      // Setup local mic level meter
      const setupAnalyser = (ms: MediaStream) => {
        try {
          const AudioContextCtor: any = (window as any).AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContextCtor();
          // Some browsers start suspended until a user gesture
          ctx.resume?.().catch(() => {});
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(ms);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          analyserRef.current = analyser;
          source.connect(analyser);
          const byteData = new Uint8Array(analyser.fftSize);
          const floatData = new Float32Array(analyser.fftSize);
          let speaking = false;
          let thresh = 0.005; // start with a low threshold, adapt after a short calibration
          const hysteresis = 0.002;
          let frames = 0;
          let baseline = 0;
          const loop = () => {
            // Prefer float time domain data if available
            let rms = 0;
            if (analyser.getFloatTimeDomainData) {
              analyser.getFloatTimeDomainData(floatData);
              let sum = 0;
              for (let i = 0; i < floatData.length; i++) {
                const v = floatData[i];
                sum += v * v;
              }
              rms = Math.sqrt(sum / floatData.length);
            } else {
              analyser.getByteTimeDomainData(byteData);
              let sum = 0;
              for (let i = 0; i < byteData.length; i++) {
                const v = (byteData[i] - 128) / 128;
                sum += v * v;
              }
              rms = Math.sqrt(sum / byteData.length);
            }
            setInputLevel(rms);
            // quick calibration for baseline noise in first 30 frames
            if (frames < 30) {
              baseline = (baseline * frames + rms) / (frames + 1);
              frames++;
              // keep threshold slightly above baseline
              thresh = Math.max(0.003, baseline * 2.5);
            }
            if (!speaking && rms > thresh) {
              speaking = true;
              setUserSpeaking(true);
            } else if (speaking && rms < Math.max(0, thresh - hysteresis)) {
              speaking = false;
              setUserSpeaking(false);
            }
            rafRef.current = requestAnimationFrame(loop);
          };
          loop();
        } catch (e) {
          appendLog(`analyser error: ${String((e as any)?.message ?? e)}`);
        }
      };
      setupAnalyser(mediaStream);
      const transport = new OpenAIRealtimeWebRTC({
        mediaStream,
        audioElement: audioRef.current ?? document.createElement("audio"),
      });

      const session = new RealtimeSession(agent, { model: "gpt-realtime", transport, config: { inputAudioTranscription: { model: 'gpt-4o-mini-transcribe', language: 'en' } } });
      sessionRef.current = session;
      await session.connect({ apiKey: token });
      setAgentStatus("connected");
      appendLog("Agent connected");
      // Configure session with tutor instructions and send initial auto-context
      try { await configureSession(); sessionReadyRef.current = true; } catch (e) { appendLog(`configureSession error: ${String((e as any)?.message ?? e)}`); }
      try {
        if (audioRef.current) {
          audioRef.current.muted = false;
          await audioRef.current.play().catch((e) => appendLog(`audio play err: ${String(e)}`));
          // Setup output analyser from audio element
          const setupOutput = async () => {
            try {
              const ctx = audioCtxRef.current ?? new (window as any).AudioContext();
              audioCtxRef.current = ctx;
              await ctx.resume?.();
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 1024;
              let source: any = null;
              try {
                const stream = (audioRef.current as any).captureStream?.();
                if (stream) {
                  source = ctx.createMediaStreamSource(stream);
                }
              } catch {}
              if (!source) {
                try { source = ctx.createMediaElementSource(audioRef.current); } catch {}
              }
              if (source) {
                try { source.connect(analyser); } catch {}
                const floatData = new Float32Array(analyser.fftSize);
                const byteData = new Uint8Array(analyser.fftSize);
                const loop = () => {
                  let rms = 0;
                  if (analyser.getFloatTimeDomainData) {
                    analyser.getFloatTimeDomainData(floatData);
                    let sum = 0; for (let i = 0; i < floatData.length; i++) { const v = floatData[i]; sum += v * v; }
                    rms = Math.sqrt(sum / floatData.length);
                  } else {
                    analyser.getByteTimeDomainData(byteData);
                    let sum = 0; for (let i = 0; i < byteData.length; i++) { const v = (byteData[i] - 128) / 128; sum += v * v; }
                    rms = Math.sqrt(sum / byteData.length);
                  }
                  setOutputLevel(rms);
                  rafOutRef.current = requestAnimationFrame(loop);
                };
                loop();
              }
            } catch (e) {
              appendLog(`output analyser error: ${String((e as any)?.message ?? e)}`);
            }
          };
          setupOutput();
        }
      } catch {}

      // Optional history updates
      session.on?.("history_updated", (history: any) => {
        // No-op: could render snippets
      });

      // Transport event logging and speaking indicators
      try {
        const off = session.transport?.on?.("*", (evt: any) => {
          if (!evt || !evt.type) return;
          appendLog(`[evt] ${evt.type}`);
          // Minimal transcript/text previews for debugging
          try {
            if (evt.type === 'response.output_audio_transcript.delta') {
              const d = String((evt as any)?.delta ?? '');
              if (d) {
                appendLog(`[transcript.delta] ${d.slice(0,160)}${d.length>160?'…':''}`);
                if (languageLock) maybeReassertLanguage(d);
              }
            }
            if (evt.type === 'response.output_text.delta') {
              const d = String((evt as any)?.delta ?? '');
              if (d) appendLog(`[text.delta] ${d.slice(0,160)}${d.length>160?'…':''}`);
            }
            if (evt.type === 'invalid_request_error' || evt.type === 'error') {
              const code = (evt as any)?.code ?? 'n/a';
              const msg = (evt as any)?.message ?? 'n/a';
              appendLog(`[server-error] code=${code} msg=${msg}`);
            }
          } catch {}
          if (evt.type === "input_audio_buffer.speech_started") setUserSpeaking(true);
          if (evt.type === "input_audio_buffer.speech_stopped") {
            setUserSpeaking(false);
            if (!waitingResponseRef.current) {
              waitingResponseRef.current = true;
              appendLog('[transport] auto-context + response.create (on speech_stopped)');
              try { if (sessionReadyRef.current) sendAutoContext(true); } catch {}
            }
          }
          if (evt.type === "response.output_audio.delta") setAgentSpeaking(true);
          if (evt.type === "response.output_audio.done" || evt.type === "response.done") {
            setAgentSpeaking(false);
            waitingResponseRef.current = false;
          }
          if (evt.type === "session.created" || evt.type === "session.updated") {
            // marker to quickly spot session lifecycle
          }
        });
        unsubTransportRef.current = typeof off === "function" ? off : null;
      } catch {}
    } catch (e: any) {
      setAgentStatus("disconnected");
      appendLog(`Agent error: ${String(e?.message ?? e)}`);
    }
  }, [agentStatus, fetchEphemeralToken, appendLog, addPython, setWindows, addBox, addText, muted]);

  const stopAgent = useCallback(async () => {
    if (agentStatus !== "connected") return;
    try {
      await sessionRef.current?.disconnect?.();
    } catch {}
    sessionRef.current = null;
    setAgentStatus("disconnected");
    appendLog("Agent disconnected");
    setAgentSpeaking(false);
    setUserSpeaking(false);
    // Stop mic tracks
    try {
      mediaStreamRef.current?.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
    } catch {}
    mediaStreamRef.current = null;
    // Pause audio output
    try {
      if (audioRef.current) {
        try { (audioRef.current as any).srcObject = null; } catch {}
        await audioRef.current.pause?.();
        audioRef.current.muted = true;
      }
    } catch {}
    // Close transport if available
    try { (sessionRef.current as any)?.transport?.close?.(); } catch {}
    if (unsubTransportRef.current) {
      try { unsubTransportRef.current(); } catch {}
      unsubTransportRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try { await audioCtxRef.current?.close?.(); } catch {}
    audioCtxRef.current = null;
  }, [agentStatus, appendLog]);

  // Soft language guard: if the model drifts away from English, gently re-assert
  const maybeReassertLanguage = useCallback((delta: string) => {
    try {
      // Detect a high ratio of non-ASCII letters as a proxy for non-English
      const nonAscii = delta.replace(/[\x00-\x7F]/g, '').length;
      if (nonAscii > 8) {
        const session = sessionRef.current;
        appendLog('[language] reassert English preference via session.update');
        session?.transport?.sendEvent?.({
          type: 'session.update',
          session: {
            type: 'realtime',
            instructions: buildTutorInstructions(),
            audio: {
              input: { format: { type: 'audio/pcm', rate: 24000 }, turn_detection: { type: 'semantic_vad', eagerness: 'medium', create_response: true, interrupt_response: true } },
              output: { format: { type: 'audio/pcm' }, voice: 'marin' },
            },
          },
        } as any);
      }
    } catch {}
  }, [appendLog, buildTutorInstructions]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    const ms = mediaStreamRef.current;
    if (ms) {
      try { ms.getAudioTracks().forEach((t) => (t.enabled = !next)); } catch {}
    }
  }, [muted]);

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-slate-100/70 to-slate-200/70 dark:from-slate-900/80 dark:to-slate-950/80">
      {/* Workspace layer */}
      <section className="absolute inset-0">
        {/* Whiteboard tab */}
        {activeTab === "whiteboard" && (
          <div className="relative w-full h-full">
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <Tldraw onMount={(editor) => { editorRef.current = editor; }} />
        </div>
        {(() => {
          if (editorRef.current && !agentRef.current) {
            try { agentRef.current = new TldrawAgent({ editor: editorRef.current, id: "voice-agent", onError: (e: any) => appendLog(`agent error: ${String(e?.message ?? e)}`) }); } catch {}
          }
          return null;
        })()}
            {/* Python windows overlay retained */}
        <div className="absolute inset-0 pointer-events-none" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {windows.map((win) => (
            <div key={win.id} className="pointer-events-auto">
              <PythonWindow
                win={win}
                onChange={(next) => updateWin(win.id, next)}
                onClose={() => removeWin(win.id)}
              />
            </div>
          ))}
        </div>
          </div>
        )}

        {/* Code IDE tab */}
        {activeTab === "code" && (
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: '240px 1fr' }}>
            <aside className="border-r bg-white/50 dark:bg-slate-900/40 backdrop-blur p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Workspace</div>
                <button className="text-xs px-2 py-1 rounded border" onClick={() => createFile(`file-${files.length + 1}.ts`, 'typescript', '// New file\n')}>New</button>
              </div>
              <ul className="space-y-1">
                {files.map((f) => (
                  <li key={f.id}>
                    <button
                      className={`w-full text-left text-xs px-2 py-1 rounded ${activeFileId === f.id ? 'bg-slate-200 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}
                      onClick={() => setActiveFileId(f.id)}
                    >
                      {f.name}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <button className="text-xs px-2 py-1 rounded border w-full" onClick={() => addPython()}>+ Python Window</button>
              </div>
            </aside>
            <div className="relative">
              <div className="h-9 border-b bg-white/50 dark:bg-slate-900/40 backdrop-blur flex items-center gap-2 px-3">
                <div className="text-xs text-slate-700 dark:text-slate-200 truncate">{activeFile?.name ?? 'untitled'}</div>
                <div className="ml-auto flex items-center gap-2">
                  <button className="text-xs px-2 py-1 rounded border" onClick={() => {
                    // Open current content into a Python window (best effort)
                    setWindows((prev) => [
                      ...prev,
                      { id: `python-${Date.now()}`, title: `Python: ${activeFile?.name ?? 'Scratchpad'}`, x: 40, y: 40, w: 640, h: 420, code: activeFile?.content ?? '', outputs: [] },
                    ]);
                  }}>Run in Python</button>
                </div>
              </div>
              <div className="absolute inset-0 top-9">
                <MonacoEditor
                  theme="vs-dark"
                  defaultLanguage={activeFile?.language ?? 'typescript'}
                  value={activeFile?.content ?? ''}
                  onChange={(v) => updateActiveFileContent(v ?? '')}
                  options={{ fontSize: 14, minimap: { enabled: false } }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Notes tab */}
        {activeTab === "notes" && (
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="p-4 bg-white/60 dark:bg-slate-900/40 backdrop-blur">
              <div className="text-sm font-medium mb-2">Markdown</div>
              <textarea
                className="w-full h-[calc(100%-1.75rem)] resize-none rounded border bg-white/70 dark:bg-slate-900/50 p-3 text-sm"
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
              />
            </div>
            <div className="p-4 border-l bg-white/30 dark:bg-slate-900/30 backdrop-blur overflow-auto">
              <div className="text-sm font-medium mb-2">Preview</div>
              <pre className="whitespace-pre-wrap text-sm">{notesText}</pre>
            </div>
          </div>
        )}
      </section>

      {/* Bottom-left: Tab switcher */}
      <div className="fixed left-4 bottom-4 z-40">
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur shadow-lg rounded-full p-1 flex gap-1 border">
          <button className={`px-3 py-1.5 text-xs rounded-full ${activeTab==='whiteboard' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`} onClick={() => setActiveTab('whiteboard')}>Whiteboard</button>
          <button className={`px-3 py-1.5 text-xs rounded-full ${activeTab==='code' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`} onClick={() => setActiveTab('code')}>Code</button>
          <button className={`px-3 py-1.5 text-xs rounded-full ${activeTab==='notes' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`} onClick={() => setActiveTab('notes')}>Notes</button>
        </div>
      </div>

      {/* Bottom-right: AI control dock */}
      <div className="fixed right-4 bottom-4 z-40">
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur shadow-lg rounded-xl border p-3 w-[320px]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">AI Voice Agent</div>
            <span className={`inline-flex items-center gap-1 text-[10px] ${agentStatus === 'connected' ? 'text-emerald-600' : agentStatus === 'connecting' ? 'text-amber-600' : 'text-slate-500'}`}>
            <span className={`inline-block w-2 h-2 rounded-full ${agentStatus === 'connected' ? 'bg-emerald-500' : agentStatus === 'connecting' ? 'bg-amber-500' : 'bg-slate-400'}`} />
            {agentStatus}
          </span>
        </div>
          <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
              {agentStatus !== 'connected' ? (
                <button className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs dark:bg-white dark:text-slate-900" onClick={startAgent}>Start</button>
          ) : (
            <>
                  <button className="px-3 py-1.5 rounded-md border text-xs" onClick={stopAgent}>Stop</button>
                  <button className="px-3 py-1.5 rounded-md border text-xs" onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
            </>
          )}
        </div>
            {/* Reactive speaking bubble */}
            <div className="relative">
              {(() => {
                const speaking = agentSpeaking || userSpeaking;
                const level = agentSpeaking ? Math.min(1, outputLevel * 6) : Math.min(1, inputLevel * 6);
                const color = agentSpeaking ? 'bg-blue-500' : (userSpeaking ? 'bg-red-500' : 'bg-slate-300');
                const size = 14 + Math.round(level * 18);
                return (
                  <div className="grid place-items-center">
                    <div className={`rounded-full transition-all ${color}`} style={{ width: `${size}px`, height: `${size}px` }} />
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${toolBusy ? 'bg-blue-500' : 'bg-slate-300'}`} />
          {toolBusy ? 'Running tool…' : 'Idle'}
        </div>
        <div className="flex items-center gap-2">
              <button className="px-2 py-1 rounded border text-[11px]" onClick={() => setShowLogs((v) => !v)}>{showLogs ? 'Hide Logs' : 'Show Logs'}</button>
              <button className="px-2 py-1 rounded border text-[11px]" onClick={() => setShowContext((v) => !v)}>{showContext ? 'Hide Context' : 'Show Context'}</button>
              <button className="px-2 py-1 rounded border text-[11px]" onClick={() => setShowCalls((v) => !v)}>{showCalls ? 'Hide Calls' : 'Show Calls'}</button>
              <button className="px-2 py-1 rounded border text-[11px]" onClick={addPython}>+ Py</button>
          </div>
        </div>
        </div>
      </div>

      {/* Logs window (top-right) */}
      {showLogs && (
        <div className="fixed right-4 top-4 z-40 w-80 max-h-[50vh] bg-white/80 dark:bg-slate-900/80 backdrop-blur border rounded-xl shadow-lg overflow-hidden">
          <div className="h-9 px-3 flex items-center justify-between border-b">
            <div className="text-sm">Logs</div>
            <button className="text-xs px-2 py-1 rounded border" onClick={() => setShowLogs(false)}>Close</button>
          </div>
          <div className="p-2 h-[calc(50vh-2.25rem)] overflow-auto">
          <ul className="text-xs space-y-1">
            {logs.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
        </div>
      )}

      {/* Context window (top-left) */}
      {showContext && (
        <div className="fixed left-4 top-4 z-40 w-[420px] max-h-[60vh] bg-white/90 dark:bg-slate-900/90 backdrop-blur border rounded-xl shadow-lg overflow-hidden">
          <div className="h-9 px-3 flex items-center justify-between border-b">
            <div className="text-sm">Auto Context</div>
            <button className="text-xs px-2 py-1 rounded border" onClick={() => setShowContext(false)}>Close</button>
          </div>
          <div className="p-3 space-y-2 text-xs overflow-auto" style={{ maxHeight: 'calc(60vh - 2.25rem)' }}>
            <div className="text-[11px] text-slate-500">Last sent: {debugContext ? new Date(debugContext.ts).toLocaleTimeString() : '—'}</div>
            <div>
              <div className="font-medium mb-1">view_context (JSON)</div>
              <pre className="whitespace-pre-wrap break-words">{debugContext?.text ?? '—'}</pre>
            </div>
            <div>
              <div className="font-medium mb-1">viewport image</div>
              {debugContext?.imageUrl ? (
                <img src={debugContext.imageUrl} alt="viewport" className="w-full border rounded" />
              ) : (
                <div className="text-slate-500">—</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tool calls window (bottom-left) */}
      {showCalls && (
        <div className="fixed left-4 bottom-24 z-40 w-[420px] max-h-[40vh] bg-white/90 dark:bg-slate-900/90 backdrop-blur border rounded-xl shadow-lg overflow-hidden">
          <div className="h-9 px-3 flex items-center justify-between border-b">
            <div className="text-sm">Tool Calls</div>
            <button className="text-xs px-2 py-1 rounded border" onClick={() => setShowCalls(false)}>Close</button>
          </div>
          <div className="p-2 h-[calc(40vh-2.25rem)] overflow-auto">
            <ul className="text-xs space-y-1">
              {toolEvents.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[10px] text-slate-500">{new Date(e.ts).toLocaleTimeString()}</span>
                  <span className={`text-[10px] ${e.status==='error' ? 'text-red-600' : e.status==='done' ? 'text-emerald-600' : 'text-slate-700'}`}>{e.status}</span>
                  <span className="text-[10px] font-mono">{e.name}</span>
                  {typeof e.ms === 'number' && <span className="text-[10px] text-slate-500">{e.ms}ms</span>}
                  <span className="text-[10px] text-slate-500">rid={e.rid}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Hidden audio element for playback */}
      <audio ref={audioRef} autoPlay playsInline className="w-0 h-0 absolute" />
    </main>
  );
}


