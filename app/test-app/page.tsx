"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Tldraw } from "tldraw";
import { toRichText } from "@tldraw/tlschema";
import "tldraw/tldraw.css";

// Playground infrastructure
import { usePlayground } from "./hooks/usePlayground";
import { PlaygroundControls } from "./components/PlaygroundControls";
import { EventLogPanel } from "./components/EventLogPanel";
import { AIVoiceAgentPanel } from "./components/AIVoiceAgentPanel";

// Agents
import { createRealtimeSessionHandle } from "./agents/voice/session";
import { buildVoiceInstructions } from "./agents/voice/config";
import { handleSpeechEnd } from "./agents/voice/bridge";
import { gatherSpaceContext } from "./agents/planner/agent";

// Existing utilities
import { loadPyodideOnce } from "./lib/pyodide";
import { getViewContext as computeViewContext, getViewportScreenshot } from "./lib/viewContext";
import { buildRuntime } from "./agent/runtime";
import { buildAllTools } from "./agent/registry";
import { NotesEditor } from "./components/NotesEditor";
import { NotesRenderer } from "./components/NotesRenderer";
import { serializeNotesYaml, NotesDocT, parseNotesYaml } from "./types/notesYaml";
import type { AgentRuntime } from "./types/toolContracts";

// Dynamically load Monaco on client only
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

export default function PlaygroundPage() {
  const editorRef = useRef<any>(null);
  const agentRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const sessionHandleRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const runtimeRef = useRef<AgentRuntime | null>(null);

  // Use the playground hook for central state management
  const playground = usePlayground();
  const { config, updateConfig, updatePlannerConfig, eventBus, events, clearEvents, exportEvents } = playground;

  // Local UI state
  const [activeTab, setActiveTab] = useState<"whiteboard" | "code" | "notes">("whiteboard");
  const [toolBusy, setToolBusy] = useState(false);
  
  // Audio meters
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [muted, setMuted] = useState(false);

  // Voice agent state
  const [agentStatus, setAgentStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  // Device selection
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState("");
  const [selectedOutputId, setSelectedOutputId] = useState("");
  const [pushToTalk, setPushToTalk] = useState(false);

  const appendLog = useCallback((line: string) => {
    // Just for compatibility with old code that might call appendLog
    try {
      const isTool = line.includes("[turn:tool]") || line.includes("[act:");
      if (!isTool) {
        // console.log("[Playground Log]", line);
      }
    } catch {}
  }, []);

  // IDE state
  type IdeFile = { id: string; name: string; language: string; content: string };
  const [files, setFiles] = useState<IdeFile[]>([
    { id: "file-1", name: "main.py", language: "python", content: "# Welcome to the playground\nprint('Hello!')\n" },
  ]);
  const [activeFileId, setActiveFileId] = useState("file-1");
  const activeFile = useMemo(() => files.find((f) => f.id === activeFileId) ?? files[0], [files, activeFileId]);
  const [showConsole, setShowConsole] = useState(true);
  type IdeOutput = { type: "stdout" | "stderr" | "info"; text: string; ts: number };
  const [ideOutputs, setIdeOutputs] = useState<IdeOutput[]>([]);
  const [ideRunning, setIdeRunning] = useState(false);

  // Notes state
  const initialYaml: NotesDocT = {
    title: "Notes",
    version: 1,
    blocks: [{ type: "text", md: "Write here…" } as any],
  };
  const [notesYaml, setNotesYaml] = useState(() => serializeNotesYaml(initialYaml));
  const [showYaml, setShowYaml] = useState(false);

  // Device enumeration
  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setInputDevices(list.filter((d) => d.kind === "audioinput"));
      setOutputDevices(list.filter((d) => d.kind === "audiooutput"));
    } catch {}
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", refreshDevices);
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", refreshDevices);
  }, [refreshDevices]);

  // File operations
  const updateActiveFileContent = useCallback(
    (next: string) => setFiles((prev) => prev.map((f) => (f.id === activeFileId ? { ...f, content: next } : f))),
    [activeFileId]
  );

  const createFile = useCallback((name: string, language: string, content: string) => {
    const id = `file-${Date.now()}`;
    setFiles((prev) => [...prev, { id, name, language, content }]);
    setActiveFileId(id);
  }, []);

  const getActiveFileSnapshot = useCallback(() => {
    if (!activeFile) return null;
    return { name: activeFile.name, language: activeFile.language, content: activeFile.content };
  }, [activeFile]);

  // Run Python file
  const runActiveFile = useCallback(async () => {
    if (!activeFile || activeFile.language !== "python") {
      setIdeOutputs((prev) => [{ type: "info", text: "Run supports Python only.", ts: Date.now() }, ...prev]);
      return { stdout: "", stderr: "", info: ["Python only"] };
    }
    try {
      setIdeRunning(true);
      const pyodide = await loadPyodideOnce();
      const out: IdeOutput[] = [];
      pyodide.setStdout({ batched: (s: string) => out.push({ type: "stdout", text: s, ts: Date.now() }) });
      pyodide.setStderr({ batched: (s: string) => out.push({ type: "stderr", text: s, ts: Date.now() }) });
      await pyodide.runPythonAsync(activeFile.content);
      setIdeOutputs((prev) => [...out, ...prev].slice(0, 500));
      return {
        stdout: out.filter((o) => o.type === "stdout").map((o) => o.text).join(""),
        stderr: out.filter((o) => o.type === "stderr").map((o) => o.text).join(""),
        info: [],
      };
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      setIdeOutputs((prev) => [{ type: "stderr", text: msg, ts: Date.now() }, ...prev]);
      return { stdout: "", stderr: msg, info: [] };
    } finally {
      setIdeRunning(false);
    }
  }, [activeFile]);

  // Whiteboard dispatch
  const dispatchAction = useCallback(async (action: any) => {
    const agent = agentRef.current;
    if (!agent) throw new Error("Agent not ready");
    setToolBusy(true);
    try {
      const { promise } = agent.act(action);
      await promise;
    } finally {
      setToolBusy(false);
    }
  }, []);

  const getViewContext = useCallback(() => computeViewContext(editorRef.current, agentRef.current), []);
  const getScreenshot = useCallback(async () => getViewportScreenshot(editorRef.current), []);

  // Build runtime for tools
  const buildRuntimeMemo = useCallback(() => {
    const runtime = buildRuntime({
      editorRef,
      sessionRef,
      appendLog,
      onToolEvent: (evt: any) => {
        eventBus.emit("tool:done", { name: evt.name, result: evt.result, durationMs: evt.ms || 0 });
      },
      setToolBusy,
      createFile,
      setActiveFileIdByName: (name: string) => {
        const f = files.find((x) => x.name === name);
        if (f) setActiveFileId(f.id);
        return !!f;
      },
      updateActiveFileContent,
      listFilesContext: () => ({ files: files.map((f) => ({ name: f.name, language: f.language, size: f.content.length })), active: activeFile?.name }),
      getActiveFileSnapshot,
      runActiveFile,
      getScreenshot,
      getViewContext,
      dispatchAction,
      getSimpleShape: (shapeId: string) => {
        try {
          const editor = editorRef.current;
          if (!editor) return null;
          const shape = editor.getShape(`shape:${shapeId}`);
          if (!shape) return null;
          return {
            _type: shape.type,
            shapeId: String(shape.id).replace(/^shape:/, ""),
            x: shape.x ?? 0,
            y: shape.y ?? 0,
            w: shape.props?.w ?? 0,
            h: shape.props?.h ?? 0,
            text: shape.props?.label ?? "",
          };
        } catch {
          return null;
        }
      },
      getVisibleTextItems: () => {
        try {
          const editor = editorRef.current;
          if (!editor) return [];
          const viewport = editor.getViewportPageBounds();
          return editor
            .getCurrentPageShapesSorted()
            .filter((s: any) => {
              const b = editor.getShapeMaskedPageBounds(s);
              return b && b.collides(viewport);
            })
            .map((s: any) => ({
              shapeId: String(s.id).replace(/^shape:/, ""),
              type: s.type,
              text: s.props?.label || "",
              note: s.props?.note || "",
            }))
            .filter((i: any) => i.text || i.note);
        } catch {
          return [];
        }
      },
      notesGetText: () => notesYaml,
      notesSetText: (text: string) => setNotesYaml(text),
      notesAppend: (text: string) => {
        try {
          const parsed = parseNotesYaml(notesYaml);
          if (parsed.doc) {
            const next = { ...parsed.doc, blocks: [...parsed.doc.blocks, { type: "text", md: text } as any] };
            setNotesYaml(serializeNotesYaml(next));
          }
        } catch {}
      },
    });
    runtimeRef.current = runtime;
    return runtime;
  }, [files, activeFile, notesYaml, eventBus, appendLog, createFile, updateActiveFileContent, getActiveFileSnapshot, runActiveFile, getScreenshot, getViewContext, dispatchAction]);

  // Fetch ephemeral token
  const fetchEphemeralToken = useCallback(async () => {
    const deriveSite = (url?: string) => {
      if (!url) return null;
      try {
        const u = new URL(url);
        return `${u.protocol}//${u.host.replace("convex.cloud", "convex.site")}`;
      } catch {
        return null;
      }
    };
    const site = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || deriveSite(process.env.NEXT_PUBLIC_CONVEX_URL);
    if (!site) throw new Error("Convex site URL not configured");
    const res = await fetch(`${site.replace(/\/$/, "")}/realtime/token`);
    if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
    const data = await res.json();
    if (!data?.value) throw new Error("Invalid token response");
    return data.value as string;
  }, []);

  // Start voice agent
  const startAgent = useCallback(async () => {
    if (agentStatus !== "disconnected") return;
    setAgentStatus("connecting");
    eventBus.emit("voice:connecting", {});
    
    try {
      const token = await fetchEphemeralToken();
      const runtime = buildRuntimeMemo();
      const mod = await import("@openai/agents/realtime");
      const tools = buildAllTools((def: any) => (mod as any).tool(def), runtime);

      const handle = createRealtimeSessionHandle();
      sessionHandleRef.current = handle;

      await handle.connect({
        token,
        selectedInputDeviceId: selectedInputId || undefined,
        selectedOutputDeviceId: selectedOutputId || undefined,
        audioElement: audioRef.current,
        appendLog,
        tools: config.architecture === "realtime_tools" ? tools : [], // Only pass tools in realtime_tools mode
        agentName: "Studi",
      });

      sessionRef.current = handle.getSession();
      mediaStreamRef.current = handle.getMediaStream();

      // Configure voice agent with appropriate instructions
      handle.configure({
        model: config.voice.model,
        voice: config.voice.voice,
        vadEagerness: config.voice.vadEagerness,
        instructions: buildVoiceInstructions(config.architecture),
        createResponseFromVad: config.architecture === "realtime_tools", // Auto-respond only in realtime mode
        interruptResponseFromVad: true,
      });

      // Setup mic level meter
      if (mediaStreamRef.current) {
        const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextCtor();
        ctx.resume?.();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(mediaStreamRef.current);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const floatData = new Float32Array(analyser.fftSize);
        const loop = () => {
          analyser.getFloatTimeDomainData(floatData);
          let sum = 0;
          for (let i = 0; i < floatData.length; i++) sum += floatData[i] * floatData[i];
          const rms = Math.sqrt(sum / floatData.length);
          setInputLevel(rms);
          if (rms > 0.01) setUserSpeaking(true);
          else setUserSpeaking(false);
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      }

      // Wire up transport events
      handle.onAll((evt: any) => {
        if (!evt?.type) return;
        
        if (evt.type === "input_audio_buffer.speech_started") {
          setUserSpeaking(true);
          eventBus.emit("voice:speech_start", {});
        }

        if (evt.type === "input_audio_buffer.speech_stopped") {
          setUserSpeaking(false);

          // In split_planner mode, route to planner
          if (config.architecture === "split_planner" && runtimeRef.current) {
            // Get transcript and route to planner
            const transcript = (evt as any).transcript || "User spoke";
            
            handleSpeechEnd(transcript, {
              architecture: config.architecture,
              plannerConfig: config.planner,
              runtime: runtimeRef.current,
              eventBus,
              onPlannerResponse: (text) => {
                // Send response back to voice agent to speak
                sessionRef.current?.transport?.sendEvent?.({
                  type: "conversation.item.create",
                  item: {
                    type: "message",
                    role: "assistant",
                    content: [{ type: "text", text }],
                  },
                });
                sessionRef.current?.transport?.sendEvent?.({ type: "response.create" });
              },
              appendLog,
            });
          } else {
            // In realtime_tools mode, trigger response normally
            sessionRef.current?.transport?.sendEvent?.({ type: "response.create" });
          }
        }

        if (evt.type === "response.output_audio.delta") setAgentSpeaking(true);
        if (evt.type === "response.done") {
          setAgentSpeaking(false);
          eventBus.emit("voice:agent_speaking", { speaking: false });
        }
      });

      setAgentStatus("connected");
      eventBus.emit("voice:connected", {});

      // Play audio
      if (audioRef.current) {
        audioRef.current.muted = false;
        await audioRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setAgentStatus("disconnected");
      eventBus.emit("voice:error", { error: err.message || String(err) });
    }
  }, [agentStatus, config, eventBus, fetchEphemeralToken, buildRuntimeMemo, selectedInputId, selectedOutputId, appendLog]);

  // Stop voice agent
  const stopAgent = useCallback(async () => {
    if (agentStatus !== "connected") return;
    try {
      await sessionHandleRef.current?.disconnect?.();
    } catch {}
    sessionRef.current = null;
    sessionHandleRef.current = null;
    setAgentStatus("disconnected");
    setAgentSpeaking(false);
    setUserSpeaking(false);
    eventBus.emit("voice:disconnected", {});

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try { mediaStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { await audioCtxRef.current?.close?.(); } catch {}
  }, [agentStatus, eventBus]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    mediaStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
  }, [muted]);

  const playTestTone = useCallback(() => {
    try {
      const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 440;
      const gain = ctx.createGain();
      gain.gain.value = 0.1;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 500);
    } catch {}
  }, []);

  // Setup tldraw agent ref
  useEffect(() => {
    if (editorRef.current && !agentRef.current) {
      agentRef.current = {
        act: ({ _type, ...rest }: any) => {
          const editor = editorRef.current;
          if (!editor) return { diff: {}, promise: Promise.resolve() };

          if (_type === "create") {
            const shapeType = rest.shape?._type;
            if (shapeType === "text") {
              editor.createShape({
                type: "text",
                x: rest.shape?.x ?? 0,
                y: rest.shape?.y ?? 0,
                props: { w: rest.shape?.w ?? 220, richText: toRichText(String(rest.shape?.text ?? "")) },
              });
            } else {
              editor.createShape({
                type: "geo",
                x: rest.shape?.x ?? 0,
                y: rest.shape?.y ?? 0,
                props: { w: rest.shape?.w ?? 100, h: rest.shape?.h ?? 80, geo: shapeType || "rectangle" },
              });
            }
          } else if (_type === "delete") {
            editor.deleteShape?.(`shape:${rest.shapeId}`);
          } else if (_type === "move") {
            editor.updateShapes?.([{ id: `shape:${rest.shapeId}`, type: "geo", x: rest.x, y: rest.y }]);
          } else if (_type === "clear") {
            editor.deleteShapes?.(editor.getCurrentPageShapeIds());
          } else if (_type === "setMyView") {
            editor.zoomToBounds?.({ x: rest.x, y: rest.y, w: rest.w, h: rest.h });
          }

          return { diff: {}, promise: Promise.resolve() };
        },
      };
    }
  });

  const languageOptions = [
    { value: "python", label: "Python" },
    { value: "typescript", label: "TypeScript" },
    { value: "javascript", label: "JavaScript" },
  ];

  return (
    <div className="flex h-screen w-full bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden font-sans">
      {/* Sidebar: Controls */}
      <div className="w-80 h-full flex-shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm z-20">
        <PlaygroundControls
          config={config}
          onConfigChange={updateConfig}
          onPlannerConfigChange={updatePlannerConfig}
          isConnected={agentStatus === "connected"}
          inputDevices={inputDevices}
          outputDevices={outputDevices}
          selectedInputId={selectedInputId}
          setSelectedInputId={setSelectedInputId}
          selectedOutputId={selectedOutputId}
          setSelectedOutputId={setSelectedOutputId}
          playTestTone={playTestTone}
          pushToTalk={pushToTalk}
          setPushToTalk={setPushToTalk}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Top Header/Toolbar - Prevents overlay conflict with canvas */}
        <div className="h-14 px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between z-30 shrink-0">
          {/* Left: Tab Switcher (Spaces) */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
            <button
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "whiteboard" ? "bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-neutral-100" : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"}`}
              onClick={() => setActiveTab("whiteboard")}
            >
              Whiteboard
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "code" ? "bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-neutral-100" : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"}`}
              onClick={() => setActiveTab("code")}
            >
              Code
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "notes" ? "bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-neutral-100" : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"}`}
              onClick={() => setActiveTab("notes")}
            >
              Notes
            </button>
          </div>

          {/* Right: Voice Agent Status */}
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
          />
        </div>

        {/* Workspace */}
        <div className="flex-1 relative bg-white dark:bg-neutral-950 overflow-hidden">
          {/* Whiteboard tab */}
          {activeTab === "whiteboard" && (
            <div className="absolute inset-0">
              <Tldraw onMount={(editor) => { editorRef.current = editor; }} />
            </div>
          )}

          {/* Code IDE tab */}
          {activeTab === "code" && (
            <div className="absolute inset-0 flex flex-col">
              <div className="h-12 px-4 shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Editor</span>
                  <select
                    className="text-xs px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                    value={activeFile?.language}
                    onChange={(e) => setFiles((prev) => prev.map((f) => (f.id === activeFileId ? { ...f, language: e.target.value } : f)))}
                  >
                    {languageOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm transition-colors disabled:opacity-50"
                    onClick={runActiveFile}
                    disabled={ideRunning}
                  >
                    {ideRunning ? "Running…" : "Run Code"}
                  </button>
                  <button
                    className={`text-xs px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 font-medium transition-colors ${
                      showConsole ? "bg-neutral-100 dark:bg-neutral-800" : "bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                    onClick={() => setShowConsole(!showConsole)}
                  >
                    {showConsole ? "Hide Output" : "Show Output"}
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <MonacoEditor
                  theme="vs-dark"
                  language={activeFile?.language}
                  value={activeFile?.content}
                  onChange={(v) => updateActiveFileContent(v ?? "")}
                  options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true }}
                />
              </div>
              {showConsole && (
                <div className="h-[25vh] border-t border-neutral-200 dark:border-neutral-800 bg-neutral-900 text-neutral-100 p-0 flex flex-col">
                  <div className="px-3 py-1.5 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">Console Output</span>
                    <button onClick={clearConsole} className="text-[10px] text-neutral-400 hover:text-white">Clear</button>
                  </div>
                  <div className="flex-1 p-2 overflow-auto font-mono text-xs">
                    {ideOutputs.length === 0 ? (
                      <span className="text-neutral-600 italic">No output</span>
                    ) : (
                      ideOutputs.map((o, i) => (
                        <div key={i} className={`mb-1 break-words ${o.type === "stderr" ? "text-red-400" : o.type === "info" ? "text-blue-400" : "text-neutral-300"}`}>
                          <span className="opacity-30 mr-2 select-none">{new Date(o.ts).toLocaleTimeString()}</span>
                          {o.text}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes tab */}
          {activeTab === "notes" && (
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: showYaml ? "1fr 1fr" : "1fr" }}>
              {showYaml && (
                <div className="p-0 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 overflow-auto">
                  <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 font-mono text-xs font-medium text-neutral-500 uppercase">YAML Source</div>
                  <div className="p-4">
                    <NotesEditor value={notesYaml} onChange={setNotesYaml} />
                  </div>
                </div>
              )}
              <div className="bg-white dark:bg-neutral-950 overflow-auto flex flex-col">
                <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-neutral-900 sticky top-0 z-10">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Lesson Preview</span>
                  <button
                    className="text-[10px] px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    onClick={() => setShowYaml(!showYaml)}
                  >
                    {showYaml ? "Hide Source" : "Edit Source"}
                  </button>
                </div>
                <div className="p-8 max-w-3xl mx-auto w-full">
                  <NotesRenderer yaml={notesYaml} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar: Logs (Collapsible or toggleable via config) */}
      {config.debug.showLogs && (
        <div className="w-96 h-full flex-shrink-0 border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm z-20">
          <EventLogPanel
            events={events}
            onClear={clearEvents}
            onExport={() => {
              const data = exportEvents();
              const blob = new Blob([data], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "playground-events.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
            onClose={() => updateConfig({ debug: { ...config.debug, showLogs: false } })}
          />
        </div>
      )}

      {/* Hidden audio element */}
      <audio ref={audioRef} autoPlay playsInline className="w-0 h-0 absolute" />
    </div>
  );
}