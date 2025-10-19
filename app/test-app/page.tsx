"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
// Local minimal helpers to avoid missing agent/shared imports
import { AIVoiceAgentPanel } from "./components/AIVoiceAgentPanel";
import { loadPyodideOnce } from "./lib/pyodide";
import { buildTutorInstructions } from "./lib/realtimeInstructions";
import { buildTutorInstructions as buildPersonaInstructions } from "./prompts/tutor";
import { getViewContext as computeViewContext, getViewportScreenshot } from "./lib/viewContext";
import { sendAutoContext as sendAutoContextService } from "./services/autoContext";
import { sendAutoContext as sendAutoContextCombined } from "./services/context";
import { buildAllTools } from "./agent/registry";
import { AgentRuntime } from "./types/toolContracts";
import { createRealtimeSessionHandle } from "./agent/session";
import { buildRuntime } from "./agent/runtime";
import { NotesEditor } from "./components/NotesEditor";
import { NotesRenderer } from "./components/NotesRenderer";
import { serializeNotesYaml, NotesDocT, parseNotesYaml } from "./types/notesYaml";

// Dynamically load Monaco on client only
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});


export default function TestAppPage() {
  const editorRef = useRef<any>(null);
  const agentRef = useRef<any>(null);

  // Voice agent/session state
  const sessionRef = useRef<any>(null);
  const sessionHandleRef = useRef<any>(null);
  const [agentStatus, setAgentStatus] = useState<"disconnected"|"connecting"|"connected">("disconnected");
  const [toolBusy, setToolBusy] = useState(false);
  const [logs, setLogs] = useState<Array<string>>([]);
  const appendLog = useCallback((line: string) => setLogs((l) => [line, ...l].slice(0, 50)), []);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const audioCtxRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const unsubTransportRef = useRef<null | (() => void)>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const tokenPromiseRef = useRef<Promise<string> | null>(null);
  const [muted, setMuted] = useState(false);
  const waitingResponseRef = useRef<boolean>(false);
  const sessionReadyRef = useRef<boolean>(false);
  const currentTurnRef = useRef<any | null>(null);
  const lastLangAssertRef = useRef<number>(0);
  const sessionTurnsRef = useRef<Array<any>>([]);
  const [inputDevices, setInputDevices] = useState<Array<MediaDeviceInfo>>([]);
  const [outputDevices, setOutputDevices] = useState<Array<MediaDeviceInfo>>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>("");
  const [selectedOutputId, setSelectedOutputId] = useState<string>("");
  const [pushToTalk, setPushToTalk] = useState<boolean>(false);
  const [vadEagerness, setVadEagerness] = useState<'low'|'medium'|'high'>('medium');

  // Workspace UI state
  const [activeTab, setActiveTab] = useState<"whiteboard" | "code" | "notes">("whiteboard");
  const [showLogs, setShowLogs] = useState<boolean>(true);
  const [showContext, setShowContext] = useState<boolean>(false);
  const [showCalls, setShowCalls] = useState<boolean>(false);
  const [showSaveLog, setShowSaveLog] = useState<boolean>(false);

  // Debug: latest auto-context sent to the model
  const [debugContext, setDebugContext] = useState<{
    text?: string;
    imageUrl?: string | null;
    ts: number;
  } | null>(null);

  // When auto-context updates, attach details to the current turn and log
  useEffect(() => {
    try {
      if (debugContext && currentTurnRef.current) {
        const jsonChars = (debugContext.text ?? '').length;
        const imgLen = debugContext.imageUrl ? debugContext.imageUrl.length : 0;
        currentTurnRef.current.contextChars = jsonChars;
        currentTurnRef.current.imageLen = imgLen;
        appendLog(`[turn:context] id=${currentTurnRef.current.id} json=${jsonChars} image=${imgLen}`);
        const snippet = (debugContext.text ?? '').slice(0, 300);
        if (snippet) appendLog(`[turn:context.json] id=${currentTurnRef.current.id} ${snippet}${(debugContext.text ?? '').length>300?'…':''}`);
      }
    } catch {}
  }, [debugContext, appendLog]);

  // Debug: structured tool call events
  type ToolEvent = { ts: number; rid: string; name: string; status: 'start'|'done'|'error'; args?: any; result?: any; ms?: number; err?: string };
  const [toolEvents, setToolEvents] = useState<Array<ToolEvent>>([]);
  const [languageLock] = useState<boolean>(true);

  // Output (AI) audio meter
  const [outputLevel, setOutputLevel] = useState(0);
  const rafOutRef = useRef<number | null>(null);

  // Media device enumeration
  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setInputDevices(list.filter((d) => d.kind === 'audioinput'));
      setOutputDevices(list.filter((d) => d.kind === 'audiooutput'));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      refreshDevices();
      navigator.mediaDevices.addEventListener?.('devicechange', refreshDevices);
      return () => {
        try { navigator.mediaDevices.removeEventListener?.('devicechange', refreshDevices); } catch {}
      };
    } catch {}
  }, [refreshDevices]);

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

  const getActiveFileSnapshot = useCallback(() => {
    const f = activeFile;
    if (!f) return null;
    return { name: f.name, language: f.language, content: f.content };
  }, [activeFile]);

  // Notes YAML document
  const initialYaml: NotesDocT = {
    title: "Notes",
    version: 1,
    blocks: [
      { type: 'text', md: 'Write here…' } as any,
    ],
  };
  const [notesYaml, setNotesYaml] = useState<string>(() => serializeNotesYaml(initialYaml));
  const [showYaml, setShowYaml] = useState<boolean>(false);

  const randomId = useCallback(() => Math.random().toString(36).slice(2), []);

  const playTestTone = useCallback(async () => {
    try {
      const AudioContextCtor: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextCtor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.value = 0.1;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      setTimeout(() => { try { osc.stop(); ctx.close(); } catch {} }, 600);
    } catch {}
  }, []);

  const applyVadEagerness = useCallback((eag: 'low'|'medium'|'high') => {
    setVadEagerness(eag);
    try {
      sessionRef.current?.transport?.sendEvent?.({
        type: 'session.update',
        session: {
          type: 'realtime',
          audio: {
            input: { turn_detection: { type: 'semantic_vad', eagerness: eag, create_response: false, interrupt_response: false } },
          },
        },
      });
    } catch {}
  }, [sessionRef]);

  // IDE console state
  const [showConsole, setShowConsole] = useState<boolean>(true);
  type IdeOutput = { type: "stdout" | "stderr" | "info"; text: string; ts: number };
  const [ideOutputs, setIdeOutputs] = useState<Array<IdeOutput>>([]);
  const [ideRunning, setIdeRunning] = useState<boolean>(false);
  const languageOptions = [
    { value: 'python', label: 'Python' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'cpp', label: 'C++' },
    { value: 'java', label: 'Java' },
  ];

  const runActiveFile = useCallback(async () => {
    const lang = (activeFile?.language ?? '').toLowerCase();
    if (!activeFile) return;
    if (lang !== 'python') {
      setIdeOutputs((prev) => [{ type: 'info', text: 'Run currently supports Python only. Switch language to Python to execute.', ts: Date.now() }, ...prev]);
      return;
    }
    try {
      setIdeRunning(true);
      const pyodide = await loadPyodideOnce();
      const out: Array<IdeOutput> = [];
      const pushOut = (type: IdeOutput['type'], s: string) => out.push({ type, text: String(s), ts: Date.now() });
      pyodide.setStdout({ batched: (s: string) => pushOut('stdout', s) });
      pyodide.setStderr({ batched: (s: string) => pushOut('stderr', s) });
      await pyodide.runPythonAsync(activeFile.content);
      setIdeOutputs((prev) => [...out, ...prev].slice(0, 500));
    } catch (err: any) {
      setIdeOutputs((prev) => [{ type: 'stderr', text: String(err?.message ?? err), ts: Date.now() }, ...prev]);
    } finally {
      setIdeRunning(false);
    }
  }, [activeFile]);

  const runActiveFileCollect = useCallback(async (): Promise<{ stdout: string; stderr: string; info: string[] }> => {
    const lang = (activeFile?.language ?? '').toLowerCase();
    if (!activeFile) {
      return { stdout: '', stderr: '', info: ['No active file to run.'] };
    }
    if (lang !== 'python') {
      return { stdout: '', stderr: '', info: ['Run currently supports Python only. Switch language to Python to execute.'] };
    }
    try {
      setIdeRunning(true);
      const pyodide = await loadPyodideOnce();
      const out: Array<IdeOutput> = [];
      const pushOut = (type: IdeOutput['type'], s: string) => out.push({ type, text: String(s), ts: Date.now() });
      pyodide.setStdout({ batched: (s: string) => pushOut('stdout', s) });
      pyodide.setStderr({ batched: (s: string) => pushOut('stderr', s) });
      await pyodide.runPythonAsync(activeFile.content);
      
      // Aggregate outputs
      const stdout = out.filter(o => o.type === 'stdout').map(o => o.text).join('');
      const stderr = out.filter(o => o.type === 'stderr').map(o => o.text).join('');
      const info = out.filter(o => o.type === 'info').map(o => o.text);
      
      // Also update UI state
      setIdeOutputs((prev) => [...out, ...prev].slice(0, 500));
      
      return { stdout, stderr, info };
    } catch (err: any) {
      const errorMsg = String(err?.message ?? err);
      setIdeOutputs((prev) => [{ type: 'stderr', text: errorMsg, ts: Date.now() }, ...prev]);
      return { stdout: '', stderr: errorMsg, info: [] };
    } finally {
      setIdeRunning(false);
    }
  }, [activeFile]);

  const clearConsole = useCallback(() => setIdeOutputs([]), []);

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
    try {
      // Developer console visibility for conversions into tldraw actions
      console.log('[act:start]', { rid, action });
    } catch {}
    setToolBusy(true);
    try {
      const mapped = { ...action, complete: true, time: 0 };
      try { console.log('[act:map]', { rid, mapped }); } catch {}
      const { diff, promise } = agent.act(mapped);
      await promise;
      const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      appendLog(`[act:done] rid=${rid} ${Math.round(t1 - t0)}ms ${summarizeDiff(diff)}`);
      try { console.log('[act:done]', { rid, ms: Math.round(t1 - t0), diff }); } catch {}
    } catch (e: any) {
      const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      appendLog(`[act:error] rid=${rid} ${Math.round(t1 - t0)}ms ${String(e?.message ?? e)}`);
      try { console.error('[act:error]', { rid, error: e }); } catch {}
      throw e;
    } finally {
      setToolBusy(false);
    }
  }, [appendLog]);

  const getViewContext = useCallback(() => {
    return computeViewContext(editorRef.current, agentRef.current);
  }, []);

  const getScreenshot = useCallback(async () => {
    return await getViewportScreenshot(editorRef.current);
  }, []);

  const fetchEphemeralToken = useCallback(async () => {
    // Accept NEXT_PUBLIC_CONVEX_SITE_URL or derive from NEXT_PUBLIC_CONVEX_URL by replacing convex.cloud → convex.site
    const deriveSiteFromCloud = (cloudUrl: string | undefined): string | null => {
      if (!cloudUrl) return null;
      try {
        const u = new URL(cloudUrl);
        const host = u.host.replace("convex.cloud", "convex.site");
        return `${u.protocol}//${host}`;
      } catch {
        return null;
      }
    };
    const siteBase = (process.env.NEXT_PUBLIC_CONVEX_SITE_URL as string | undefined) || deriveSiteFromCloud(process.env.NEXT_PUBLIC_CONVEX_URL as string | undefined);
    if (!siteBase) throw new Error("Convex site URL is not configured. Set NEXT_PUBLIC_CONVEX_SITE_URL or NEXT_PUBLIC_CONVEX_URL.");
    if (tokenPromiseRef.current) return await tokenPromiseRef.current;
    tokenPromiseRef.current = (async () => {
      const url = `${siteBase.replace(/\/$/, "")}/realtime/token`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
      const data = await res.json();
      if (!data?.value) throw new Error("Invalid token response");
      return data.value as string;
    })();
    try {
      const v = await tokenPromiseRef.current;
      return v;
    } finally {
      tokenPromiseRef.current = null;
    }
  }, []);

  // Configure the realtime session (declared after helpers to avoid TDZ)
  let configureSession = (async () => {}) as unknown as () => Promise<void>;

  // buildTutorInstructions is imported from lib/realtimeInstructions

  // Send compact auto-context (viewport + shapes + image)
  const sendAutoContext = useCallback(async (triggerResponse: boolean = false) => {
    // Prefer combined (JSON + image in one item); fallback to legacy on failure
    const res = await sendAutoContextCombined(editorRef, agentRef, sessionRef, appendLog, setDebugContext, triggerResponse);
    if (res === 'error' || res === 'no-session') {
      return await sendAutoContextService(editorRef, agentRef, sessionRef, appendLog, setDebugContext, triggerResponse);
    }
    return res;
  }, [appendLog]);

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
              // Disable auto responses from VAD; we will trigger response.create explicitly
              turn_detection: { type: 'semantic_vad', eagerness: 'medium', create_response: false, interrupt_response: false },
            },
            output: { format: { type: 'audio/pcm' }, voice: 'marin' },
          },
          instructions: buildPersonaInstructions('default'),
        },
      } as any);
      try { await sendAutoContext(false); } catch {}
    } catch (e: any) {
      appendLog(`session.update error: ${String(e?.message ?? e)}`);
    }
  }, [appendLog, buildTutorInstructions, sendAutoContext]);

  // Removed floating Python windows in favor of full-page IDE

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
        props: { w: 240, h: 80, geo: "rectangle", label: text ?? "" },
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
      const { tool } = mod as any;

      // Create runtime bridges used by modular tools
      const runtime: AgentRuntime = buildRuntime({
        editorRef,
        sessionRef,
        appendLog,
        onToolEvent: (e) => {
          try { setToolEvents((prev: Array<ToolEvent>) => [e as any, ...prev].slice(0, 100)); } catch {}
          try {
            if (currentTurnRef.current) {
              currentTurnRef.current.tools = currentTurnRef.current.tools || [];
              currentTurnRef.current.tools.push(e);
              const id = currentTurnRef.current.id;
              appendLog(`[turn:tool] id=${id} name=${e.name} status=${e.status}`);
            }
          } catch {}
        },
        setToolBusy: (busy: boolean) => setToolBusy(busy),
        createFile: (name: string, language: string, content: string) => { createFile(name, language, content); },
        setActiveFileIdByName: (name: string) => {
          const f = files.find((f) => f.name === name);
          if (f) setActiveFileId(f.id);
          return !!f;
        },
        updateActiveFileContent: (content: string) => { updateActiveFileContent(String(content ?? "")); },
        listFilesContext: () => ({ files: files.map((f) => ({ name: f.name, language: f.language, size: f.content.length })), active: activeFile?.name }),
        getActiveFileSnapshot: () => getActiveFileSnapshot(),
        runActiveFile: () => runActiveFileCollect(),
        getScreenshot: async () => await getScreenshot(),
        getViewContext: () => getViewContext(),
        dispatchAction: async (action: any) => { await dispatchAction(action); },
        getSimpleShape: (shapeId: string) => {
          try {
            const editor = editorRef.current;
            if (!editor) return null;
            const shape = editor.getShape(`shape:${shapeId}`);
            if (!shape) return null;
            const rawId = String(shape?.id ?? "");
            const simpleId = rawId.replace(/^shape:/, "");
            const type = String(shape?.type ?? "unknown");
            const x = typeof (shape as any)?.x === 'number' ? (shape as any).x : 0;
            const y = typeof (shape as any)?.y === 'number' ? (shape as any).y : 0;
            const w = typeof (shape as any)?.props?.w === 'number' ? (shape as any).props.w : (typeof (shape as any)?.w === 'number' ? (shape as any).w : 0);
            const h = typeof (shape as any)?.props?.h === 'number' ? (shape as any).props.h : (typeof (shape as any)?.h === 'number' ? (shape as any).h : 0);
            const text = typeof (shape as any)?.props?.label === 'string' ? (shape as any).props.label : '';
            const geo = typeof (shape as any)?.props?.geo === 'string' ? (shape as any).props.geo : undefined;
            return { _type: type, shapeId: simpleId, x, y, w, h, text, geo } as any;
          } catch { return null; }
        },
        getVisibleTextItems: () => {
          try {
            const editor = editorRef.current;
            if (!editor) return [] as any[];
            const viewport = editor.getViewportPageBounds();
            const shapes = editor.getCurrentPageShapesSorted().filter((s: any) => {
              const b = editor.getShapeMaskedPageBounds(s);
              return b && b.collides(viewport);
            });
            const items = shapes.map((s: any) => {
              try {
                const rawId = String(s?.id ?? "");
                const shapeId = rawId.replace(/^shape:/, "");
                const type = String(s?.type ?? "unknown");
                const text = typeof (s as any)?.props?.label === 'string' ? (s as any).props.label : '';
                const note = typeof (s as any)?.props?.note === 'string' ? (s as any).props.note : '';
                return { shapeId, type, text, note };
              } catch { return { shapeId: '', type: 'unknown', text: '', note: '' }; }
            }).filter((i: any) => (i.text && i.text.length) || (i.note && i.note.length));
            return items;
          } catch { return [] as any[]; }
        },
        notesGetText: () => notesYaml,
        notesSetText: (text: string) => { setNotesYaml(String(text ?? "")); },
        notesAppend: (text: string) => {
          try {
            const parsed = parseNotesYaml(notesYaml);
            if (!parsed.doc) return;
            const next = { ...parsed.doc, blocks: [...parsed.doc.blocks, { type: 'text', md: String(text ?? '') } as any] } as NotesDocT;
            setNotesYaml(serializeNotesYaml(next));
          } catch {}
        },
      });

      const tools = buildAllTools((def: any) => (mod as any).tool(def), runtime);

      // Connect session via handle
      const handle = createRealtimeSessionHandle();
      sessionHandleRef.current = handle;
      await handle.connect({ token, selectedInputDeviceId: selectedInputId || undefined, selectedOutputDeviceId: selectedOutputId || undefined, audioElement: audioRef.current, appendLog, tools, agentName: "Studi" });
      sessionRef.current = handle.getSession();
      mediaStreamRef.current = handle.getMediaStream();

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
      if (mediaStreamRef.current) setupAnalyser(mediaStreamRef.current);
      setAgentStatus("connected");
      appendLog("Agent connected");
      // Configure session with tutor instructions and send initial auto-context
      try { await configureSession(); } catch (e) { appendLog(`configureSession error: ${String((e as any)?.message ?? e)}`); }
      try {
        if (audioRef.current) {
          audioRef.current.muted = false;
          try {
            if (selectedOutputId && (audioRef.current as any).setSinkId) {
              await (audioRef.current as any).setSinkId(selectedOutputId);
              appendLog(`audio sink set to ${selectedOutputId}`);
            }
          } catch {}
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
      sessionRef.current?.on?.("history_updated", (history: any) => {
        try {
          // Best-effort: find last user message with text content
          const items = Array.isArray(history) ? history : [];
          for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            if (it && it.type === 'message' && it.role === 'user' && Array.isArray(it.content)) {
              const textPart = it.content.find((c: any) => c?.type === 'input_text' && typeof c?.text === 'string');
              if (textPart && typeof textPart.text === 'string') {
                if (currentTurnRef.current) {
                  currentTurnRef.current.userTranscript = textPart.text;
                  const short = textPart.text.length > 180 ? textPart.text.slice(0, 180) + '…' : textPart.text;
                  appendLog(`[turn:user] id=${currentTurnRef.current.id} text="${short}"`);
                }
                break;
              }
            }
          }
        } catch {}
      });

      // Transport event logging and speaking indicators
      try {
        const off = sessionRef.current?.transport?.on?.("*", (evt: any) => {
          if (!evt || !evt.type) return;
          appendLog(`[evt] ${evt.type}`);
          // Minimal transcript/text previews for debugging
          try {
            if (evt.type === 'response.output_audio_transcript.delta') {
              const d = String((evt as any)?.delta ?? '');
              if (d) {
                appendLog(`[transcript.delta] ${d.slice(0,160)}${d.length>160?'…':''}`);
                if (languageLock) maybeReassertLanguage(d);
                try {
                  if (currentTurnRef.current) {
                    currentTurnRef.current.assistantTranscript = (currentTurnRef.current.assistantTranscript || '') + d;
                  }
                } catch {}
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
              try {
                // Start a new turn log
                currentTurnRef.current = { id: randomId(), startedAt: Date.now(), userTranscript: '', assistantTranscript: '', tools: [], contextChars: 0, imageLen: 0 };
                appendLog(`[turn:start] id=${currentTurnRef.current.id}`);
              } catch {}
              try {
                if (sessionReadyRef.current) {
                  Promise.resolve(sendAutoContext(true)).catch(() => {});
                }
              } catch {}
            }
          }
          if (evt.type === "response.output_audio.delta") setAgentSpeaking(true);
          if (evt.type === "response.output_audio.done" || evt.type === "response.done") {
            setAgentSpeaking(false);
            waitingResponseRef.current = false;
            try {
              if (currentTurnRef.current) {
                const id = currentTurnRef.current.id;
                const a = String(currentTurnRef.current.assistantTranscript || '');
                const aShort = a.length > 220 ? a.slice(0, 220) + '…' : a;
                const toolsCount = Array.isArray(currentTurnRef.current.tools) ? currentTurnRef.current.tools.length : 0;
                appendLog(`[turn:end] id=${id} tools=${toolsCount} assistant="${aShort}"`);
                try { sessionTurnsRef.current.push({ ...currentTurnRef.current, endedAt: Date.now() }); } catch {}
                currentTurnRef.current = null;
              }
            } catch {}
          }
          if (evt.type === "session.updated") {
            // Set readiness only after server ack of session.update
            sessionReadyRef.current = true;
          }
        });
        unsubTransportRef.current = typeof off === "function" ? off : null;
      } catch {}
    } catch (e: any) {
      setAgentStatus("disconnected");
      appendLog(`Agent error: ${String(e?.message ?? e)}`);
    }
  }, [agentStatus, fetchEphemeralToken, appendLog, addBox, addText, muted]);

  const stopAgent = useCallback(async () => {
    if (agentStatus !== "connected") return;
    try {
      await sessionHandleRef.current?.disconnect?.();
    } catch {}
    sessionRef.current = null;
    sessionHandleRef.current = null;
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
            try {
              // Minimal shim for agentRef to satisfy dispatchAction calls
              agentRef.current = {
                act: ({ _type, ...rest }: any) => {
                  const editor = editorRef.current;
                  const result = { diff: {}, promise: Promise.resolve() } as any;
                  try {
                    if (!editor) return result;
                    if (_type === 'create') {
                      const shapeType = rest.shape?._type;
                      let shapePayload: any;
                      
                      if (shapeType === 'text') {
                        // Create text shape with proper tldraw text type
                        shapePayload = {
                          type: 'text',
                          x: rest.shape?.x ?? 0,
                          y: rest.shape?.y ?? 0,
                          props: {
                            text: rest.shape?.text ?? '',
                            w: rest.shape?.w ?? 220,
                            h: rest.shape?.h ?? 60,
                            color: rest.shape?.color ?? 'black'
                          }
                        };
                      } else {
                        // Create geo shape with allowed geo types
                        const geoType = rest.shape?._type ?? 'rectangle';
                        const normalizedGeo = ['rectangle', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'octagon', 'star', 'rhombus', 'rhombus-2', 'oval', 'trapezoid', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'x-box', 'check-box', 'heart', 'cloud'].includes(geoType) 
                          ? geoType 
                          : 'rectangle'; // fallback
                        
                        shapePayload = {
                          type: 'geo',
                          x: rest.shape?.x ?? 0,
                          y: rest.shape?.y ?? 0,
                          props: {
                            w: rest.shape?.w ?? 100,
                            h: rest.shape?.h ?? 80,
                            geo: normalizedGeo
                          }
                        };
                      }
                      
                      try { console.log('[tldraw:createShape]', shapePayload); } catch {}
                      editor.createShape(shapePayload as any);
                    } else if (_type === 'delete') {
                      if (rest.shapeId) editor.deleteShape?.(`shape:${rest.shapeId}`);
                    } else if (_type === 'move') {
                      if (rest.shapeId) editor.updateShapes?.([{ id: `shape:${rest.shapeId}`, type: 'geo', x: rest.x, y: rest.y }] as any);
                    } else if (_type === 'label') {
                      // For v4.0.2, inline text on geo may be invalid; skip or switch to a dedicated text shape
                      try { console.warn('[tldraw:label] geo text not supported, skipping label change', { shapeId: rest.shapeId, text: rest.text }); } catch {}
                    } else if (_type === 'clear') {
                      const ids = editor.getCurrentPageShapeIds();
                      editor.deleteShapes?.(ids as any);
                    } else if (_type === 'setMyView') {
                      editor.zoomToBounds?.({ x: rest.x, y: rest.y, w: rest.w, h: rest.h });
                    }
                  } catch {}
                  return { diff: {}, promise: Promise.resolve() };
                },
              };
            } catch {}
          }
          return null;
        })()}
          </div>
        )}

        {/* Code IDE tab */}
        {activeTab === "code" && (
          <div className="absolute inset-0 flex flex-col">
            {/* Toolbar */}
            <div className="h-12 px-3 md:px-4 shrink-0 border-b border-white/20 dark:border-white/10 bg-gradient-to-r from-slate-900/80 via-slate-900/70 to-slate-900/80 text-slate-200 flex items-center justify-between" role="toolbar" aria-label="IDE controls">
              <div className="flex items-center gap-2 min-w-0">
                <label htmlFor="language-select" className="sr-only">Language</label>
                <select
                  id="language-select"
                  aria-label="Select language"
                  className="text-xs px-2 py-1 rounded-md border border-white/10 bg-slate-800 text-slate-100 focus:outline-none"
                  value={(activeFile?.language ?? 'python')}
                  onChange={(e) => {
                    const nextLang = e.target.value;
                    setFiles((prev) => prev.map((f) => (f.id === activeFileId ? { ...f, language: nextLang } : f)));
                  }}
                >
                  {languageOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`text-xs px-3 py-1.5 rounded-md border border-emerald-400/30 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white transition ${ideRunning ? 'opacity-70 cursor-not-allowed' : ''}`}
                  onClick={runActiveFile}
                  disabled={ideRunning}
                  aria-busy={ideRunning}
                  aria-label="Run program"
                >
                  {ideRunning ? 'Running…' : 'Run ▶'}
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-md border border-white/10 bg-slate-800 hover:bg-slate-700 text-slate-100 transition"
                  onClick={() => setShowConsole((v) => !v)}
                  aria-pressed={showConsole}
                  aria-label={showConsole ? 'Hide output panel' : 'Show output panel'}
                >
                  {showConsole ? 'Hide Output' : 'Show Output'}
                </button>
              </div>
            </div>

            {/* Editor + Output area */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0">
                <MonacoEditor
                  key={activeFile?.language}
                  theme="vs-dark"
                  language={activeFile?.language ?? 'typescript'}
                  defaultLanguage={activeFile?.language ?? 'typescript'}
                  value={activeFile?.content ?? ''}
                  onChange={(v) => updateActiveFileContent(v ?? '')}
                  options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true, wordWrap: 'on' }}
                />
              </div>

              {showConsole && (
                <div className="h-[26vh] border-t border-white/10 bg-slate-900/80 text-slate-100">
                  <div className="h-9 px-3 border-b border-white/10 flex items-center justify-between">
                    <div className="text-[11px] font-medium">Output</div>
                    <div className="flex items-center gap-2">
                      <button className="text-[11px] px-2 py-1 rounded border border-white/10 bg-slate-800 hover:bg-slate-700" onClick={clearConsole}>Clear</button>
                    </div>
                  </div>
                  <div className="p-2 h-[calc(26vh-2.25rem)] overflow-auto text-xs">
                    {ideOutputs.length === 0 ? (
                      <div className="text-slate-400">No output yet. Use Run ▶ to execute your Python file.</div>
                    ) : (
                      <ul className="space-y-1">
                        {ideOutputs.map((o, i) => (
                          <li key={i} className={o.type === 'stderr' ? 'text-red-400' : o.type === 'info' ? 'text-cyan-300' : 'text-slate-100'}>
                            <span className="text-[10px] text-slate-500 mr-2">{new Date(o.ts).toLocaleTimeString()}</span>
                            <span>{o.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes tab */}
        {activeTab === "notes" && (
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: showYaml ? '1fr 1fr' : '1fr' }}>
            {showYaml && (
              <div className="p-4 bg-white/60 dark:bg-slate-900/40 backdrop-blur overflow-auto">
                <NotesEditor value={notesYaml} onChange={setNotesYaml} />
              </div>
            )}
            <div className={showYaml ? "p-4 border-l bg-white/30 dark:bg-slate-900/30 backdrop-blur overflow-auto" : "p-4 bg-white/30 dark:bg-slate-900/30 backdrop-blur overflow-auto"}>
              <div className="h-10 flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Lesson</div>
                <button
                  className="text-[11px] px-2 py-1 rounded border border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/40 hover:bg-white/40 dark:hover:bg-slate-800/60"
                  onClick={() => setShowYaml((v) => !v)}
                >{showYaml ? 'Hide YAML' : 'Show YAML'}</button>
              </div>
              <div className="w-full grid place-items-center">
                <NotesRenderer yaml={notesYaml} />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Bottom-left: Tab switcher */}
      <div className="fixed left-4 bottom-4 z-40">
        <div className="rounded-full p-1 flex gap-1 border border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-900/30 backdrop-blur-xl shadow-2xl">
          <button className={`px-3 py-1.5 text-xs rounded-full transition ${activeTab==='whiteboard' ? 'bg-gradient-to-r from-fuchsia-500/80 to-pink-500/80 text-white' : 'hover:bg-white/40 dark:hover:bg-slate-800/60 text-slate-900 dark:text-slate-100'}`} onClick={() => setActiveTab('whiteboard')}>Whiteboard</button>
          <button className={`px-3 py-1.5 text-xs rounded-full transition ${activeTab==='code' ? 'bg-gradient-to-r from-emerald-500/80 to-cyan-500/80 text-white' : 'hover:bg-white/40 dark:hover:bg-slate-800/60 text-slate-900 dark:text-slate-100'}`} onClick={() => setActiveTab('code')}>Code</button>
          <button className={`px-3 py-1.5 text-xs rounded-full transition ${activeTab==='notes' ? 'bg-gradient-to-r from-violet-500/80 to-indigo-500/80 text-white' : 'hover:bg-white/40 dark:hover:bg-slate-800/60 text-slate-900 dark:text-slate-100'}`} onClick={() => setActiveTab('notes')}>Notes</button>
        </div>
      </div>

      {/* Bottom-right: AI control dock */}
      <div className="fixed right-4 bottom-4 z-40">
        <AIVoiceAgentPanel
          agentStatus={agentStatus}
          startAgent={startAgent}
          stopAgent={stopAgent}
          muted={muted}
          toggleMute={toggleMute}
          toolBusy={toolBusy}
          inputLevel={inputLevel}
          outputLevel={outputLevel}
          agentSpeaking={agentSpeaking}
          userSpeaking={userSpeaking}
          showLogs={showLogs}
          setShowLogs={setShowLogs}
          showContext={showContext}
          setShowContext={setShowContext}
          showCalls={showCalls}
          setShowCalls={setShowCalls}
          inputDevices={inputDevices}
          outputDevices={outputDevices}
          selectedInputId={selectedInputId}
          setSelectedInputId={(id: string) => setSelectedInputId(id)}
          selectedOutputId={selectedOutputId}
          setSelectedOutputId={(id: string) => setSelectedOutputId(id)}
          playTestTone={playTestTone}
          pushToTalk={pushToTalk}
          setPushToTalk={(v: boolean) => setPushToTalk(v)}
          vadEagerness={vadEagerness}
          setVadEagerness={(v: any) => applyVadEagerness(v)}
        />
      </div>

      {/* Logs window (top-right) */}
      {showLogs && (
        <div className="fixed right-4 top-4 z-40 w-80 max-h-[50vh] rounded-xl border border-white/20 dark:border-white/10 bg-white/30 dark:bg-slate-900/40 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="h-9 px-3 flex items-center justify-between border-b border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-900/30">
            <div className="text-sm bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-500 to-pink-500">Logs</div>
            <div className="flex items-center gap-2">
              <button className="text-[10px] px-2 py-1 rounded border border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/40 hover:bg-white/40 dark:hover:bg-slate-800/60" onClick={() => setShowSaveLog((v) => !v)}>{showSaveLog ? 'Hide save' : 'Save'}</button>
              <button className="text-xs px-2 py-1 rounded border border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/40 hover:bg-white/40 dark:hover:bg-slate-800/60" onClick={() => setShowLogs(false)}>Close</button>
            </div>
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

      {/* Save log dialog */}
      {showSaveLog && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowSaveLog(false)} />
          <div className="relative w-[420px] rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl shadow-2xl p-4">
            <div className="text-sm font-medium mb-2">Export session log</div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mb-3">Downloads a <code>log.json</code> containing turns with transcripts, context sizes, images lengths, and tool calls.</div>
            <div className="flex items-center gap-2 justify-end">
              <button className="text-xs px-3 py-1.5 rounded-md border border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/40 hover:bg-white/40 dark:hover:bg-slate-800/60" onClick={() => setShowSaveLog(false)}>Cancel</button>
              <button className="text-xs px-3 py-1.5 rounded-md text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600" onClick={() => {
                try {
                  const payload = {
                    ts: Date.now(),
                    turns: sessionTurnsRef.current || [],
                    device: { inputId: selectedInputId || 'default', outputId: selectedOutputId || 'default' },
                    vad: { eagerness: vadEagerness, pushToTalk },
                  };
                  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'log.json';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                  setShowSaveLog(false);
                } catch {}
              }}>Download log.json</button>
            </div>
          </div>
        </div>
      )}

      {/* Context window (top-left) */}
      {showContext && (
        <div className="fixed left-4 top-4 z-40 w-[420px] max-h-[60vh] rounded-xl border border-white/20 dark:border-white/10 bg-white/30 dark:bg-slate-900/40 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="h-9 px-3 flex items-center justify-between border-b border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-900/30">
            <div className="text-sm bg-clip-text text-transparent bg-gradient-to-r from-violet-500 to-indigo-500">Auto Context</div>
            <button className="text-xs px-2 py-1 rounded border border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/40 hover:bg-white/40 dark:hover:bg-slate-800/60" onClick={() => setShowContext(false)}>Close</button>
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
        <div className="fixed left-4 bottom-24 z-40 w-[420px] max-h-[40vh] rounded-xl border border-white/20 dark:border-white/10 bg-white/30 dark:bg-slate-900/40 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="h-9 px-3 flex items-center justify-between border-b border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-900/30">
            <div className="text-sm bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-cyan-500">Tool Calls</div>
            <button className="text-xs px-2 py-1 rounded border border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/40 hover:bg-white/40 dark:hover:bg-slate-800/60" onClick={() => setShowCalls(false)}>Close</button>
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



