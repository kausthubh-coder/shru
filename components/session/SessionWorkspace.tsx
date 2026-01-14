"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Tldraw } from "tldraw";
import type { Editor } from "tldraw";
import { toRichText } from "@tldraw/tlschema";
import "tldraw/tldraw.css";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
// Local minimal helpers to avoid missing agent/shared imports
import { AIVoiceAgentPanel } from "./AIVoiceAgentPanel";
import { loadPyodideOnce } from "@/lib/pyodide";
import { buildTutorInstructions as buildPersonaInstructions } from "@/lib/prompts/tutor";
import {
  getViewContext as computeViewContext,
  getViewportScreenshot,
} from "@/lib/viewContext";
import { sendAutoContext as sendAutoContextService } from "./services/autoContext";
import { sendAutoContext as sendAutoContextCombined } from "./services/context";
import { buildAllTools } from "./agent/registry";
import { AgentRuntime, ToolEventRecord } from "@/types/toolContracts";
import { createRealtimeSessionHandle } from "./agent/session";
import { buildRuntime } from "./agent/runtime";
import { NotesEditor } from "@/components/lesson/NotesEditor";
import { NotesRenderer } from "@/components/lesson/NotesRenderer";
import {
  serializeNotesYaml,
  NotesDocT,
  parseNotesYaml,
} from "@/types/notesYaml";

type AgentHandle = {
  act: (action: Record<string, unknown>) => {
    diff: unknown;
    promise: Promise<unknown>;
  };
};

type SimpleShape = {
  shapeId: string;
  type: string;
  text: string;
  note?: string;
};

type SimpleGeoShape = {
  _type?: string;
  shapeId?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
  geo?: string;
  color?: string;
  fill?: string;
};

type RealtimeTransportLike = {
  sendEvent?: (evt: unknown) => void;
  on?: (event: string, handler: (evt: unknown) => void) => unknown;
  close?: () => void;
};

type RealtimeSessionLike = {
  transport?: RealtimeTransportLike;
  on?: (event: string, handler: (evt: unknown) => void) => void;
};

type ViewContextEditor = Parameters<typeof computeViewContext>[0];

type TurnLog = {
  id: string;
  startedAt: number;
  userTranscript: string;
  assistantTranscript: string;
  tools: Array<ToolEventRecord>;
  contextChars: number;
  imageLen: number;
  endedAt?: number;
};

const toErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

const DEFAULT_IDE_FILE = {
  name: "main.py",
  language: "python",
  content: "# Welcome to the workspace\nprint('Hello from the IDE tab')\n",
};

const DEFAULT_NOTES_DOC: NotesDocT = {
  title: "Notes",
  version: 1,
  blocks: [{ type: "text", md: "Write here…" }],
};

const DEFAULT_NOTES_YAML = serializeNotesYaml(DEFAULT_NOTES_DOC);

// Dynamically load Monaco on client only
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

export default function SessionWorkspace({
  sessionId,
  enabledTools = ["whiteboard", "code", "notes"],
}: {
  sessionId: Id<"sessions">;
  enabledTools?: ("whiteboard" | "code" | "notes")[];
}) {
  const editorRef = useRef<Editor | null>(null);
  const agentRef = useRef<AgentHandle | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  // Voice agent/session state
  const sessionRef = useRef<RealtimeSessionLike | null>(null);
  const sessionHandleRef = useRef<ReturnType<
    typeof createRealtimeSessionHandle
  > | null>(null);
  const [agentStatus, setAgentStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [toolBusy, setToolBusy] = useState(false);
  const [logs, setLogs] = useState<Array<string>>([]);
  const appendLog = useCallback(
    (line: string) => setLogs((l) => [line, ...l].slice(0, 50)),
    [],
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const unsubTransportRef = useRef<null | (() => void)>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const tokenPromiseRef = useRef<Promise<string> | null>(null);
  const [muted, setMuted] = useState(false);
  const waitingResponseRef = useRef<boolean>(false);
  const sessionReadyRef = useRef<boolean>(false);
  const currentTurnRef = useRef<TurnLog | null>(null);
  const sessionTurnsRef = useRef<Array<TurnLog>>([]);
  const [inputDevices, setInputDevices] = useState<Array<MediaDeviceInfo>>([]);
  const [outputDevices, setOutputDevices] = useState<Array<MediaDeviceInfo>>(
    [],
  );
  const [selectedInputId, setSelectedInputId] = useState<string>("");
  const [selectedOutputId, setSelectedOutputId] = useState<string>("");
  const [pushToTalk, setPushToTalk] = useState<boolean>(false);
  const [vadEagerness, setVadEagerness] = useState<"low" | "medium" | "high">(
    "medium",
  );
  const pendingWhiteboardSnapshotRef = useRef<unknown>(null);
  const whiteboardSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastSyncedWhiteboardHash = useRef<string | null>(null);
  const whiteboardUnsubscribeRef = useRef<(() => void) | null>(null);
  const ideLastServerHash = useRef<string | null>(null);
  const ideSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesLastServerHash = useRef<string | null>(null);
  const notesSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const hasWhiteboard = enabledTools.includes("whiteboard");
  const hasCode = enabledTools.includes("code");
  const hasNotes = enabledTools.includes("notes");

  const whiteboardDoc = useQuery(
    api.spaces.getWhiteboard,
    hasWhiteboard ? { sessionId } : "skip",
  );
  const ideDoc = useQuery(api.spaces.getIde, hasCode ? { sessionId } : "skip");
  const lessonDoc = useQuery(
    api.spaces.getLesson,
    hasNotes ? { sessionId } : "skip",
  );
  const whiteboardSchemaVersion = whiteboardDoc?.schemaVersion;

  const updateWhiteboardMutation = useMutation(api.spaces.updateWhiteboard);
  const updateIdeMutation = useMutation(api.spaces.updateIde);
  const updateLessonMutation = useMutation(api.spaces.updateLesson);
  const [whiteboardHydrated, setWhiteboardHydrated] = useState(!hasWhiteboard);
  const [ideHydrated, setIdeHydrated] = useState(!hasCode);
  const [lessonHydrated, setLessonHydrated] = useState(!hasNotes);

  useEffect(() => {
    if (!hasWhiteboard) {
      setWhiteboardHydrated(true);
    }
    if (!hasCode) {
      setIdeHydrated(true);
    }
    if (!hasNotes) {
      setLessonHydrated(true);
    }
  }, [hasWhiteboard, hasCode, hasNotes]);

  useEffect(() => {
    if (!hasCode) return;
    if (ideDoc === undefined) return;
    const rawFiles = Array.isArray(ideDoc?.files) ? ideDoc?.files : [];
    const serverFiles = rawFiles.length > 0 ? rawFiles : [DEFAULT_IDE_FILE];
    const nextFiles: Array<IdeFile> = serverFiles.map(
      (
        file: { name?: string; language?: string; content?: string },
        idx: number,
      ) => ({
        id: `${file.name || "file"}-${idx}-${sessionId}`,
        name: file.name || `file-${idx + 1}.py`,
        language: file.language || "python",
        content: file.content ?? "",
      }),
    );
    const activeName =
      (ideDoc?.activeFile &&
        nextFiles.some((f) => f.name === ideDoc.activeFile) &&
        ideDoc.activeFile) ||
      nextFiles[0]?.name ||
      DEFAULT_IDE_FILE.name;
    const activeId =
      nextFiles.find((f) => f.name === activeName)?.id ??
      nextFiles[0]?.id ??
      "file-1";
    setFiles(nextFiles);
    setActiveFileId(activeId);
    ideLastServerHash.current = hashString(
      JSON.stringify({
        files: serverFiles,
        activeFile: activeName,
      }),
    );
    setIdeHydrated(true);
  }, [ideDoc, hasCode, sessionId]);

  useEffect(() => {
    if (!hasNotes) return;
    if (lessonDoc === undefined) return;
    const yaml =
      typeof lessonDoc?.yaml === "string" && lessonDoc.yaml.length > 0
        ? lessonDoc.yaml
        : DEFAULT_NOTES_YAML;
    notesLastServerHash.current = hashString(yaml);
    setNotesYaml(yaml);
    setLessonHydrated(true);
  }, [lessonDoc, hasNotes]);

  // Workspace UI state
  const [activeTab, setActiveTab] = useState<"whiteboard" | "code" | "notes">(
    enabledTools[0] || "whiteboard",
  );
  useEffect(() => {
    if (!enabledTools.includes(activeTab)) {
      setActiveTab(enabledTools[0] || "whiteboard");
    }
  }, [enabledTools, activeTab]);
  const [showLogs, setShowLogs] = useState<boolean>(false);
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
        const jsonChars = (debugContext.text ?? "").length;
        const imgLen = debugContext.imageUrl ? debugContext.imageUrl.length : 0;
        currentTurnRef.current.contextChars = jsonChars;
        currentTurnRef.current.imageLen = imgLen;
        appendLog(
          `[turn:context] id=${currentTurnRef.current.id} json=${jsonChars} image=${imgLen}`,
        );
        const snippet = (debugContext.text ?? "").slice(0, 300);
        if (snippet)
          appendLog(
            `[turn:context.json] id=${currentTurnRef.current.id} ${snippet}${(debugContext.text ?? "").length > 300 ? "…" : ""}`,
          );
      }
    } catch {}
  }, [debugContext, appendLog]);

  // Debug: structured tool call events
  type ToolEvent = {
    ts: number;
    rid: string;
    name: string;
    status: "start" | "done" | "error";
    args?: unknown;
    result?: unknown;
    ms?: number;
    err?: string;
  };
  const [toolEvents, setToolEvents] = useState<Array<ToolEvent>>([]);
  const [languageLock] = useState<boolean>(true);

  // Output (AI) audio meter
  const [outputLevel, setOutputLevel] = useState(0);
  const rafOutRef = useRef<number | null>(null);

  // Media device enumeration
  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setInputDevices(list.filter((d) => d.kind === "audioinput"));
      setOutputDevices(list.filter((d) => d.kind === "audiooutput"));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      refreshDevices();
      navigator.mediaDevices.addEventListener?.("devicechange", refreshDevices);
      return () => {
        try {
          navigator.mediaDevices.removeEventListener?.(
            "devicechange",
            refreshDevices,
          );
        } catch {}
      };
    } catch {}
  }, [refreshDevices]);

  useEffect(() => {
    if (!hasWhiteboard) return;
    if (whiteboardDoc === undefined) return;
    setWhiteboardHydrated(true);
    const snapshot = whiteboardDoc?.snapshot ?? null;
    const hash = snapshotHash(snapshot);
    lastSyncedWhiteboardHash.current = hash;
    if (!snapshot || !editorRef.current) return;
    try {
      if (typeof editorRef.current.loadSnapshot === "function") {
        editorRef.current.loadSnapshot(snapshot);
      } else {
        const store = editorRef.current.store as
          | { loadSnapshot?: (snap: unknown) => void }
          | undefined;
        store?.loadSnapshot?.(snapshot);
      }
    } catch (err) {
      console.error("Failed to load whiteboard snapshot", err);
    }
  }, [whiteboardDoc, hasWhiteboard]);

  useEffect(() => {
    if (!hasWhiteboard || !editorReady) return;
    const editor = editorRef.current;
    if (!editor || !editor.store?.listen) return;
    const unsubscribe = editor.store.listen(
      () => {
        if (!whiteboardHydrated) return;
        try {
          const snap =
            editor.getSnapshot?.() ??
            (
              editor.store as { getSnapshot?: () => unknown } | undefined
            )?.getSnapshot?.() ??
            null;
          if (!snap) return;
          pendingWhiteboardSnapshotRef.current = snap;
          if (!whiteboardSaveTimeoutRef.current) {
            whiteboardSaveTimeoutRef.current = setTimeout(async () => {
              if (!pendingWhiteboardSnapshotRef.current) return;
              const snapshot = pendingWhiteboardSnapshotRef.current;
              pendingWhiteboardSnapshotRef.current = null;
              whiteboardSaveTimeoutRef.current = null;
              const hash = snapshotHash(snapshot);
              if (!hash || hash === lastSyncedWhiteboardHash.current) return;
              try {
                await updateWhiteboardMutation({
                  sessionId,
                  snapshot,
                  schemaVersion: whiteboardSchemaVersion,
                });
                lastSyncedWhiteboardHash.current = hash;
              } catch (err: unknown) {
                appendLog(`whiteboard save error: ${toErrorMessage(err)}`);
              }
            }, 800);
          }
        } catch (err: unknown) {
          appendLog(`whiteboard snapshot error: ${toErrorMessage(err)}`);
        }
      },
      { scope: "document", source: "user" },
    );
    whiteboardUnsubscribeRef.current = () => {
      try {
        unsubscribe?.();
      } catch {}
    };
    return () => {
      if (whiteboardUnsubscribeRef.current) {
        try {
          whiteboardUnsubscribeRef.current();
        } catch {}
        whiteboardUnsubscribeRef.current = null;
      }
    };
  }, [
    hasWhiteboard,
    editorReady,
    whiteboardHydrated,
    updateWhiteboardMutation,
    sessionId,
    whiteboardSchemaVersion,
    appendLog,
  ]);

  // Simple in-memory IDE workspace
  type IdeFile = {
    id: string;
    name: string;
    language: string;
    content: string;
  };
  const [files, setFiles] = useState<Array<IdeFile>>([
    {
      id: "file-1",
      ...DEFAULT_IDE_FILE,
    },
  ]);
  const [activeFileId, setActiveFileId] = useState<string>("file-1");
  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) ?? files[0],
    [files, activeFileId],
  );
  const updateActiveFileContent = useCallback(
    (next: string) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === activeFileId ? { ...f, content: next } : f)),
      );
    },
    [activeFileId],
  );
  const createFile = useCallback(
    (name: string, language: string, content: string) => {
      const id = `file-${Date.now()}`;
      setFiles((prev) => [...prev, { id, name, language, content }]);
      setActiveFileId(id);
    },
    [],
  );

  const getActiveFileSnapshot = useCallback(() => {
    const f = activeFile;
    if (!f) return null;
    return { name: f.name, language: f.language, content: f.content };
  }, [activeFile]);

  // Notes YAML document
  const [notesYaml, setNotesYaml] = useState<string>(DEFAULT_NOTES_YAML);
  const [showYaml, setShowYaml] = useState<boolean>(false);

  const randomId = useCallback(() => Math.random().toString(36).slice(2), []);

  const playTestTone = useCallback(async () => {
    try {
      const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 440;
      gain.gain.value = 0.1;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        try {
          osc.stop();
          ctx.close();
        } catch {}
      }, 600);
    } catch {}
  }, []);

  const applyVadEagerness = useCallback(
    (eag: "low" | "medium" | "high") => {
      setVadEagerness(eag);
      try {
        sessionRef.current?.transport?.sendEvent?.({
          type: "session.update",
          session: {
            type: "realtime",
            audio: {
              input: {
                turn_detection: {
                  type: "semantic_vad",
                  eagerness: eag,
                  create_response: false,
                  interrupt_response: false,
                },
              },
            },
          },
        });
      } catch {}
    },
    [sessionRef],
  );

  // IDE console state
  const [showConsole, setShowConsole] = useState<boolean>(true);
  type IdeOutput = {
    type: "stdout" | "stderr" | "info";
    text: string;
    ts: number;
  };
  const [ideOutputs, setIdeOutputs] = useState<Array<IdeOutput>>([]);
  const [ideRunning, setIdeRunning] = useState<boolean>(false);
  const languageOptions = [
    { value: "python", label: "Python" },
    { value: "typescript", label: "TypeScript" },
    { value: "javascript", label: "JavaScript" },
    { value: "cpp", label: "C++" },
    { value: "java", label: "Java" },
  ];

  const runActiveFile = useCallback(async () => {
    const lang = (activeFile?.language ?? "").toLowerCase();
    if (!activeFile) return;
    if (lang !== "python") {
      setIdeOutputs((prev) => [
        {
          type: "info",
          text: "Run currently supports Python only. Switch language to Python to execute.",
          ts: Date.now(),
        },
        ...prev,
      ]);
      return;
    }
    try {
      setIdeRunning(true);
      const pyodide = await loadPyodideOnce();
      const out: Array<IdeOutput> = [];
      const pushOut = (type: IdeOutput["type"], s: string) =>
        out.push({ type, text: String(s), ts: Date.now() });
      pyodide.setStdout({ batched: (s: string) => pushOut("stdout", s) });
      pyodide.setStderr({ batched: (s: string) => pushOut("stderr", s) });
      await pyodide.runPythonAsync(activeFile.content);
      setIdeOutputs((prev) => [...out, ...prev].slice(0, 500));
    } catch (err: unknown) {
      setIdeOutputs((prev) => [
        { type: "stderr", text: toErrorMessage(err), ts: Date.now() },
        ...prev,
      ]);
    } finally {
      setIdeRunning(false);
    }
  }, [activeFile]);

  const runActiveFileCollect = useCallback(async (): Promise<{
    stdout: string;
    stderr: string;
    info: string[];
  }> => {
    const lang = (activeFile?.language ?? "").toLowerCase();
    if (!activeFile) {
      return { stdout: "", stderr: "", info: ["No active file to run."] };
    }
    if (lang !== "python") {
      return {
        stdout: "",
        stderr: "",
        info: [
          "Run currently supports Python only. Switch language to Python to execute.",
        ],
      };
    }
    try {
      setIdeRunning(true);
      const pyodide = await loadPyodideOnce();
      const out: Array<IdeOutput> = [];
      const pushOut = (type: IdeOutput["type"], s: string) =>
        out.push({ type, text: String(s), ts: Date.now() });
      pyodide.setStdout({ batched: (s: string) => pushOut("stdout", s) });
      pyodide.setStderr({ batched: (s: string) => pushOut("stderr", s) });
      await pyodide.runPythonAsync(activeFile.content);

      // Aggregate outputs
      const stdout = out
        .filter((o) => o.type === "stdout")
        .map((o) => o.text)
        .join("");
      const stderr = out
        .filter((o) => o.type === "stderr")
        .map((o) => o.text)
        .join("");
      const info = out.filter((o) => o.type === "info").map((o) => o.text);

      // Also update UI state
      setIdeOutputs((prev) => [...out, ...prev].slice(0, 500));

      return { stdout, stderr, info };
    } catch (err: unknown) {
      const errorMsg = toErrorMessage(err);
      setIdeOutputs((prev) => [
        { type: "stderr", text: errorMsg, ts: Date.now() },
        ...prev,
      ]);
      return { stdout: "", stderr: errorMsg, info: [] };
    } finally {
      setIdeRunning(false);
    }
  }, [activeFile]);

  const clearConsole = useCallback(() => setIdeOutputs([]), []);

  const dispatchAction = useCallback(
    async (action: Record<string, unknown>) => {
      const agent = agentRef.current;
      if (!agent) throw new Error("Agent not ready");
      const rid = Math.random().toString(36).slice(2, 8);
      const t0 =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();
      const safeJson = (v: unknown, limit = 400) => {
        try {
          const s = JSON.stringify(v);
          return s.length > limit ? s.slice(0, limit) + "…" : s;
        } catch {
          return "[unserializable]";
        }
      };
      const summarizeDiff = (diff: unknown) => {
        try {
          let aS = 0,
            aO = 0,
            uS = 0,
            uO = 0,
            rS = 0,
            rO = 0;
          const delta = diff as {
            added?: Record<string, { typeName?: string }>;
            updated?: Record<string, [unknown, { typeName?: string }?]>;
            removed?: Record<string, { typeName?: string }>;
          };
          Object.values(delta?.added ?? {}).forEach((rec) => {
            if (rec?.typeName === "shape") aS++;
            else aO++;
          });
          Object.values(delta?.updated ?? {}).forEach((pair) => {
            const recAfter = Array.isArray(pair) ? pair[1] : undefined;
            if (
              (recAfter as { typeName?: string } | undefined)?.typeName ===
              "shape"
            )
              uS++;
            else uO++;
          });
          Object.values(delta?.removed ?? {}).forEach((rec) => {
            if (rec?.typeName === "shape") rS++;
            else rO++;
          });
          return `diff: +${aS}/${aO} ~${uS}/${uO} -${rS}/${rO}`;
        } catch {
          return "diff: n/a";
        }
      };
      appendLog(`[act:start] rid=${rid} ${safeJson(action)}`);
      try {
        // Developer console visibility for conversions into tldraw actions
        console.log("[act:start]", { rid, action });
      } catch {}
      setToolBusy(true);
      try {
        const mapped = { ...action, complete: true, time: 0 };
        try {
          console.log("[act:map]", { rid, mapped });
        } catch {}
        const { diff, promise } = agent.act(mapped);
        await promise;
        const t1 =
          typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now();
        appendLog(
          `[act:done] rid=${rid} ${Math.round(t1 - t0)}ms ${summarizeDiff(diff)}`,
        );
        try {
          console.log("[act:done]", { rid, ms: Math.round(t1 - t0), diff });
        } catch {}
      } catch (e: unknown) {
        const t1 =
          typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now();
        appendLog(
          `[act:error] rid=${rid} ${Math.round(t1 - t0)}ms ${toErrorMessage(e)}`,
        );
        try {
          console.error("[act:error]", { rid, error: e });
        } catch {}
        throw e;
      } finally {
        setToolBusy(false);
      }
    },
    [appendLog],
  );

  const getViewContext = useCallback(() => {
    return computeViewContext(
      editorRef.current as unknown as ViewContextEditor,
      agentRef.current,
    );
  }, [agentRef]);

  const getScreenshot = useCallback(async () => {
    return await getViewportScreenshot(
      editorRef.current as unknown as ViewContextEditor,
    );
  }, []);

  const fetchEphemeralToken = useCallback(async () => {
    if (tokenPromiseRef.current) return await tokenPromiseRef.current;
    tokenPromiseRef.current = (async () => {
      const res = await fetch("/api/realtime/token", { method: "GET" });
      if (!res.ok) {
        throw new Error(`Token fetch failed: ${res.status}`);
      }
      const data = await res.json();
      if (!data?.value) {
        throw new Error("Invalid token response");
      }
      return data.value as string;
    })();
    try {
      const v = await tokenPromiseRef.current;
      return v;
    } finally {
      tokenPromiseRef.current = null;
    }
  }, []);

  // Send compact auto-context (viewport + shapes + image)
  const sendAutoContext = useCallback(
    async (triggerResponse: boolean = false) => {
      // Prefer combined (JSON + image in one item); fallback to legacy on failure
      const ideSnap = getActiveFileSnapshot();
      const res = await sendAutoContextCombined(
        editorRef,
        agentRef,
        sessionRef,
        appendLog,
        setDebugContext,
        triggerResponse,
        ideSnap,
        notesYaml,
      );
      if (res === "error" || res === "no-session") {
        return await sendAutoContextService(
          editorRef,
          agentRef,
          sessionRef,
          appendLog,
          setDebugContext,
          triggerResponse,
          ideSnap,
          notesYaml,
        );
      }
      return res;
    },
    [appendLog, getActiveFileSnapshot, notesYaml],
  );

  // Configure the realtime session (declared after helpers to avoid TDZ)
  const configureSession = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      appendLog(
        "[transport] session.update -> tutor prompt, voice, modalities",
      );
      session.transport?.sendEvent?.({
        type: "session.update",
        session: {
          type: "realtime",
          model: "gpt-realtime",
          output_modalities: ["audio"],
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24000 },
              // Disable auto responses from VAD; we will trigger response.create explicitly
              turn_detection: {
                type: "semantic_vad",
                eagerness: "medium",
                create_response: false,
                interrupt_response: false,
              },
            },
            output: { format: { type: "audio/pcm" }, voice: "marin" },
          },
          instructions: buildPersonaInstructions("default"),
        },
      });
      try {
        await sendAutoContext(false);
      } catch {}
    } catch (e: unknown) {
      appendLog(`session.update error: ${toErrorMessage(e)}`);
    }
  }, [appendLog, sendAutoContext]);

  // Removed floating Python windows in favor of full-page IDE

  // Soft language guard: if the model drifts away from English, gently re-assert
  const maybeReassertLanguage = useCallback(
    (delta: string) => {
      try {
        const nonAscii = delta.replace(/[\x00-\x7F]/g, "").length;
        if (nonAscii > 8) {
          const session = sessionRef.current;
          appendLog(
            "[language] reassert English preference via session.update",
          );
          session?.transport?.sendEvent?.({
            type: "session.update",
            session: {
              type: "realtime",
              instructions: buildPersonaInstructions("default"),
              audio: {
                input: {
                  format: { type: "audio/pcm", rate: 24000 },
                  turn_detection: {
                    type: "semantic_vad",
                    eagerness: "medium",
                    create_response: true,
                    interrupt_response: true,
                  },
                },
                output: { format: { type: "audio/pcm" }, voice: "marin" },
              },
            },
          });
        }
      } catch {}
    },
    [appendLog],
  );

  // Voice agent start/stop with tools
  const startAgent = useCallback(async () => {
    if (agentStatus !== "disconnected") return;
    setAgentStatus("connecting");
    appendLog("Starting voice agent...");
    try {
      const token = await fetchEphemeralToken();
      const mod = await import("@openai/agents/realtime");

      // Create runtime bridges used by modular tools
      const runtime: AgentRuntime = buildRuntime({
        sessionRef,
        appendLog,
        onToolEvent: (evt: unknown) => {
          const e = evt as ToolEventRecord;
          try {
            setToolEvents((prev: Array<ToolEventRecord>) =>
              [e, ...prev].slice(0, 100),
            );
          } catch {}
          try {
            if (currentTurnRef.current) {
              currentTurnRef.current.tools = currentTurnRef.current.tools || [];
              currentTurnRef.current.tools.push(e);
              const id = currentTurnRef.current.id;
              appendLog(
                `[turn:tool] id=${id} name=${e.name} status=${e.status}`,
              );
            }
          } catch {}
        },
        setToolBusy: (busy: boolean) => setToolBusy(busy),
        createFile: (name: string, language: string, content: string) => {
          createFile(name, language, content);
        },
        setActiveFileIdByName: (name: string) => {
          const f = files.find((f) => f.name === name);
          if (f) setActiveFileId(f.id);
          return !!f;
        },
        updateActiveFileContent: (content: string) => {
          updateActiveFileContent(String(content ?? ""));
        },
        listFilesContext: () => ({
          files: files.map((f) => ({
            name: f.name,
            language: f.language,
            size: f.content.length,
          })),
          active: activeFile?.name,
        }),
        getActiveFileSnapshot: () => getActiveFileSnapshot(),
        runActiveFile: () => runActiveFileCollect(),
        getScreenshot: async () => await getScreenshot(),
        getViewContext: () => getViewContext(),
        dispatchAction: async (action) => {
          await dispatchAction(action as Record<string, unknown>);
        },
        getSimpleShape: (shapeId: string) => {
          try {
            const editor = editorRef.current;
            if (!editor || typeof editor.getShape !== "function") return null;
            const shapeGetter = editor as unknown as {
              getShape: (id: string) => unknown;
            };
            const shape = shapeGetter.getShape(`shape:${shapeId}`);
            if (!shape) return null;
            const shapeObj = shape as Record<string, unknown>;
            const rawId = String(shapeObj?.id ?? "");
            const simpleId = rawId.replace(/^shape:/, "");
            const type = String(shapeObj?.type ?? "unknown");
            const props =
              (shapeObj?.props as Record<string, unknown> | undefined) ?? {};
            const x = typeof shapeObj?.x === "number" ? shapeObj.x : 0;
            const y = typeof shapeObj?.y === "number" ? shapeObj.y : 0;
            const w =
              typeof props.w === "number"
                ? props.w
                : typeof (shapeObj as Record<string, unknown>)?.w === "number"
                  ? (shapeObj as Record<string, unknown>)?.w
                  : 0;
            const h =
              typeof props.h === "number"
                ? props.h
                : typeof (shapeObj as Record<string, unknown>)?.h === "number"
                  ? (shapeObj as Record<string, unknown>)?.h
                  : 0;
            const text = typeof props.label === "string" ? props.label : "";
            const geo = typeof props.geo === "string" ? props.geo : undefined;
            return {
              _type: type,
              shapeId: simpleId,
              x,
              y,
              w,
              h,
              text,
              geo,
            } as SimpleGeoShape;
          } catch {
            return null;
          }
        },
        getVisibleTextItems: () => {
          try {
            const editor = editorRef.current;
            if (
              !editor ||
              typeof editor.getCurrentPageShapesSorted !== "function" ||
              typeof editor.getViewportPageBounds !== "function"
            )
              return [] as SimpleShape[];
            const viewport = editor.getViewportPageBounds();
            const shapes =
              editor.getCurrentPageShapesSorted()?.filter((shape) => {
                const bounds = editor.getShapeMaskedPageBounds?.(shape);
                return Boolean(
                  bounds &&
                    typeof bounds.collides === "function" &&
                    bounds.collides(viewport),
                );
              }) ?? [];
            const items = shapes
              .map((shape) => {
                try {
                  const shapeObj = shape as unknown as Record<string, unknown>;
                  const rawId = String(shapeObj?.id ?? "");
                  const shapeId = rawId.replace(/^shape:/, "");
                  const type = String(shapeObj?.type ?? "unknown");
                  const props =
                    (shapeObj?.props as Record<string, unknown> | undefined) ??
                    {};
                  const text =
                    typeof props.label === "string" ? props.label : "";
                  const note = typeof props.note === "string" ? props.note : "";
                  return { shapeId, type, text, note };
                } catch {
                  return { shapeId: "", type: "unknown", text: "", note: "" };
                }
              })
              .filter(
                (i) => (i.text && i.text.length) || (i.note && i.note.length),
              );
            return items;
          } catch {
            return [] as SimpleShape[];
          }
        },
        notesGetText: () => notesYaml,
        notesSetText: (text: string) => {
          setNotesYaml(String(text ?? ""));
        },
        notesAppend: (text: string) => {
          try {
            const parsed = parseNotesYaml(notesYaml);
            if (!parsed.doc) return;
            const next = {
              ...parsed.doc,
              blocks: [
                ...parsed.doc.blocks,
                { type: "text", md: String(text ?? "") },
              ],
            } as NotesDocT;
            setNotesYaml(serializeNotesYaml(next));
          } catch {}
        },
      });

      const tools = buildAllTools(
        (def) => (mod as { tool: (definition: unknown) => unknown }).tool(def),
        runtime,
      );

      // Connect session via handle
      const handle = createRealtimeSessionHandle();
      sessionHandleRef.current = handle;
      await handle.connect({
        token,
        selectedInputDeviceId: selectedInputId || undefined,
        selectedOutputDeviceId: selectedOutputId || undefined,
        audioElement: audioRef.current,
        appendLog,
        tools,
        agentName: "Studi",
      });
      sessionRef.current = handle.getSession() as RealtimeSessionLike | null;
      mediaStreamRef.current = handle.getMediaStream();

      // Setup local mic level meter
      const setupAnalyser = (ms: MediaStream) => {
        try {
          const AudioContextCtor =
            window.AudioContext ?? window.webkitAudioContext;
          if (!AudioContextCtor) throw new Error("AudioContext not supported");
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
          appendLog(`analyser error: ${toErrorMessage(e)}`);
        }
      };
      if (mediaStreamRef.current) setupAnalyser(mediaStreamRef.current);
      setAgentStatus("connected");
      appendLog("Agent connected");
      // Configure session with tutor instructions and send initial auto-context
      try {
        await configureSession();
      } catch (e) {
        appendLog(`configureSession error: ${toErrorMessage(e)}`);
      }
      try {
        if (audioRef.current) {
          audioRef.current.muted = false;
          try {
            if (selectedOutputId && audioRef.current.setSinkId) {
              await audioRef.current.setSinkId(selectedOutputId);
              appendLog(`audio sink set to ${selectedOutputId}`);
            }
          } catch {}
          await audioRef.current
            .play()
            .catch((e) => appendLog(`audio play err: ${String(e)}`));
          // Setup output analyser from audio element
          const setupOutput = async () => {
            try {
              const audioElLocal = audioRef.current;
              if (!audioElLocal) return;
              const ctx =
                audioCtxRef.current ??
                (() => {
                  const AudioContextCtor =
                    window.AudioContext ?? window.webkitAudioContext;
                  if (!AudioContextCtor)
                    throw new Error("AudioContext not supported");
                  return new AudioContextCtor();
                })();
              audioCtxRef.current = ctx;
              await ctx.resume?.();
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 1024;
              let source:
                | MediaStreamAudioSourceNode
                | MediaElementAudioSourceNode
                | null = null;
              try {
                const stream =
                  audioElLocal.captureStream?.() ??
                  audioElLocal.mozCaptureStream?.();
                if (stream) {
                  source = ctx.createMediaStreamSource(stream);
                }
              } catch {}
              if (!source) {
                try {
                  source = ctx.createMediaElementSource(audioElLocal);
                } catch {}
              }
              if (source) {
                try {
                  source.connect(analyser);
                } catch {}
                const floatData = new Float32Array(analyser.fftSize);
                const byteData = new Uint8Array(analyser.fftSize);
                const loop = () => {
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
                  setOutputLevel(rms);
                  rafOutRef.current = requestAnimationFrame(loop);
                };
                loop();
              }
            } catch (e) {
              appendLog(`output analyser error: ${toErrorMessage(e)}`);
            }
          };
          setupOutput();
        }
      } catch {}

      // Optional history updates
      sessionRef.current?.on?.("history_updated", (history: unknown) => {
        try {
          // Best-effort: find last user message with text content
          const items = Array.isArray(history) ? history : [];
          for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i] as {
              type?: string;
              role?: string;
              content?: unknown;
            };
            const content = Array.isArray(it?.content) ? it.content : [];
            if (
              it &&
              it.type === "message" &&
              it.role === "user" &&
              Array.isArray(content)
            ) {
              const textPart = content.find(
                (c) =>
                  c &&
                  typeof c === "object" &&
                  (c as { type?: string }).type === "input_text" &&
                  typeof (c as { text?: unknown }).text === "string",
              ) as { text?: string } | undefined;
              if (textPart && typeof textPart.text === "string") {
                if (currentTurnRef.current) {
                  currentTurnRef.current.userTranscript = textPart.text;
                  const short =
                    textPart.text.length > 180
                      ? textPart.text.slice(0, 180) + "…"
                      : textPart.text;
                  appendLog(
                    `[turn:user] id=${currentTurnRef.current.id} text="${short}"`,
                  );
                }
                break;
              }
            }
          }
        } catch {}
      });

      // Transport event logging and speaking indicators
      try {
        const off = sessionRef.current?.transport?.on?.("*", (evt: unknown) => {
          const eventObj = evt as {
            type?: string;
            delta?: unknown;
            code?: unknown;
            message?: unknown;
          };
          if (!eventObj || !eventObj.type) return;
          appendLog(`[evt] ${eventObj.type}`);
          // Minimal transcript/text previews for debugging
          try {
            if (eventObj.type === "response.output_audio_transcript.delta") {
              const dRaw = eventObj.delta;
              const d =
                typeof dRaw === "string"
                  ? dRaw
                  : dRaw !== undefined
                    ? String(dRaw)
                    : "";
              if (d) {
                appendLog(
                  `[transcript.delta] ${d.slice(0, 160)}${d.length > 160 ? "…" : ""}`,
                );
                if (languageLock) maybeReassertLanguage(d);
                try {
                  if (currentTurnRef.current) {
                    currentTurnRef.current.assistantTranscript =
                      (currentTurnRef.current.assistantTranscript || "") + d;
                  }
                } catch {}
              }
            }
            if (eventObj.type === "response.output_text.delta") {
              const dRaw = eventObj.delta;
              const d =
                typeof dRaw === "string"
                  ? dRaw
                  : dRaw !== undefined
                    ? String(dRaw)
                    : "";
              if (d)
                appendLog(
                  `[text.delta] ${d.slice(0, 160)}${d.length > 160 ? "…" : ""}`,
                );
            }
            if (
              eventObj.type === "invalid_request_error" ||
              eventObj.type === "error"
            ) {
              const code = eventObj.code ?? "n/a";
              const msg = eventObj.message ?? "n/a";
              appendLog(
                `[server-error] code=${String(code)} msg=${String(msg)}`,
              );
            }
          } catch {}
          if (eventObj.type === "input_audio_buffer.speech_started")
            setUserSpeaking(true);
          if (eventObj.type === "input_audio_buffer.speech_stopped") {
            setUserSpeaking(false);
            if (!waitingResponseRef.current) {
              waitingResponseRef.current = true;
              appendLog(
                "[transport] auto-context + response.create (on speech_stopped)",
              );
              try {
                // Start a new turn log
                currentTurnRef.current = {
                  id: randomId(),
                  startedAt: Date.now(),
                  userTranscript: "",
                  assistantTranscript: "",
                  tools: [],
                  contextChars: 0,
                  imageLen: 0,
                };
                appendLog(`[turn:start] id=${currentTurnRef.current.id}`);
              } catch {}
              try {
                if (sessionReadyRef.current) {
                  Promise.resolve(sendAutoContext(true)).catch(() => {});
                }
              } catch {}
            }
          }
          if (eventObj.type === "response.output_audio.delta")
            setAgentSpeaking(true);
          if (
            eventObj.type === "response.output_audio.done" ||
            eventObj.type === "response.done"
          ) {
            setAgentSpeaking(false);
            waitingResponseRef.current = false;
            try {
              if (currentTurnRef.current) {
                const id = currentTurnRef.current.id;
                const a = String(
                  currentTurnRef.current.assistantTranscript || "",
                );
                const aShort = a.length > 220 ? a.slice(0, 220) + "…" : a;
                const toolsCount = Array.isArray(currentTurnRef.current.tools)
                  ? currentTurnRef.current.tools.length
                  : 0;
                appendLog(
                  `[turn:end] id=${id} tools=${toolsCount} assistant="${aShort}"`,
                );
                try {
                  sessionTurnsRef.current.push({
                    ...currentTurnRef.current,
                    endedAt: Date.now(),
                  });
                } catch {}
                currentTurnRef.current = null;
              }
            } catch {}
          }
          if (eventObj.type === "session.updated") {
            // Set readiness only after server ack of session.update
            sessionReadyRef.current = true;
          }
        });
        const unsubscribe =
          typeof off === "function" ? (off as () => void) : null;
        unsubTransportRef.current = unsubscribe;
      } catch {}
    } catch (e: unknown) {
      setAgentStatus("disconnected");
      appendLog(`Agent error: ${toErrorMessage(e)}`);
    }
  }, [
    activeFile,
    agentStatus,
    appendLog,
    configureSession,
    createFile,
    dispatchAction,
    fetchEphemeralToken,
    files,
    getActiveFileSnapshot,
    getScreenshot,
    getViewContext,
    languageLock,
    maybeReassertLanguage,
    notesYaml,
    randomId,
    runActiveFileCollect,
    selectedInputId,
    selectedOutputId,
    sendAutoContext,
    updateActiveFileContent,
  ]);

  const stopAgent = useCallback(async () => {
    if (agentStatus !== "connected") return;
    const session = sessionRef.current as RealtimeSessionLike | null;
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
        try {
          t.stop();
        } catch {}
      });
    } catch {}
    mediaStreamRef.current = null;
    // Pause audio output
    try {
      if (audioRef.current) {
        try {
          audioRef.current.srcObject = null;
        } catch {}
        await audioRef.current.pause?.();
        audioRef.current.muted = true;
      }
    } catch {}
    // Close transport if available
    try {
      session?.transport?.close?.();
    } catch {}
    if (unsubTransportRef.current) {
      try {
        unsubTransportRef.current();
      } catch {}
      unsubTransportRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      await audioCtxRef.current?.close?.();
    } catch {}
    audioCtxRef.current = null;
  }, [agentStatus, appendLog]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    const ms = mediaStreamRef.current;
    if (ms) {
      try {
        ms.getAudioTracks().forEach((t) => (t.enabled = !next));
      } catch {}
    }
  }, [muted]);

  useEffect(() => {
    if (!hasCode || !ideHydrated) return;
    const activeFileName =
      files.find((f) => f.id === activeFileId)?.name ??
      files[0]?.name ??
      DEFAULT_IDE_FILE.name;
    const payload = {
      files: files.map((f) => ({
        name: f.name || DEFAULT_IDE_FILE.name,
        language: f.language || DEFAULT_IDE_FILE.language,
        content: f.content ?? "",
      })),
      activeFile: activeFileName,
    };
    const hash = hashString(JSON.stringify(payload));
    if (!hash || hash === ideLastServerHash.current) return;
    if (ideSaveTimeoutRef.current) {
      clearTimeout(ideSaveTimeoutRef.current);
    }
    ideSaveTimeoutRef.current = setTimeout(async () => {
      ideSaveTimeoutRef.current = null;
      try {
        await updateIdeMutation({
          sessionId,
          files: payload.files,
          activeFile: payload.activeFile,
        });
        ideLastServerHash.current = hash;
      } catch (err: unknown) {
        appendLog(`ide save error: ${toErrorMessage(err)}`);
      }
    }, 800);
  }, [
    files,
    activeFileId,
    hasCode,
    ideHydrated,
    updateIdeMutation,
    sessionId,
    appendLog,
  ]);

  useEffect(() => {
    if (!hasNotes || !lessonHydrated) return;
    const hash = hashString(notesYaml);
    if (!hash || hash === notesLastServerHash.current) return;
    if (notesSaveTimeoutRef.current) {
      clearTimeout(notesSaveTimeoutRef.current);
    }
    notesSaveTimeoutRef.current = setTimeout(async () => {
      notesSaveTimeoutRef.current = null;
      try {
        await updateLessonMutation({ sessionId, yaml: notesYaml });
        notesLastServerHash.current = hash;
      } catch (err: unknown) {
        appendLog(`lesson save error: ${toErrorMessage(err)}`);
      }
    }, 800);
  }, [
    notesYaml,
    hasNotes,
    lessonHydrated,
    updateLessonMutation,
    sessionId,
    appendLog,
  ]);

  useEffect(() => {
    return () => {
      if (whiteboardSaveTimeoutRef.current) {
        clearTimeout(whiteboardSaveTimeoutRef.current);
      }
      if (ideSaveTimeoutRef.current) {
        clearTimeout(ideSaveTimeoutRef.current);
      }
      if (notesSaveTimeoutRef.current) {
        clearTimeout(notesSaveTimeoutRef.current);
      }
      if (whiteboardUnsubscribeRef.current) {
        try {
          whiteboardUnsubscribeRef.current();
        } catch {}
        whiteboardUnsubscribeRef.current = null;
      }
    };
  }, []);

  return (
    <main className="relative h-full w-full bg-gradient-to-b from-slate-100/70 to-slate-200/70 dark:from-slate-900/80 dark:to-slate-950/80 flex flex-col overflow-hidden">
      {/* Workspace layer */}
      <section className="flex-1 relative">
        {/* Whiteboard tab */}
        {activeTab === "whiteboard" && enabledTools.includes("whiteboard") && (
          <div className="relative w-full h-full">
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <Tldraw
                onMount={(editor) => {
                  editorRef.current = editor;
                  setEditorReady(true);
                }}
              />
            </div>
            {(() => {
              if (editorRef.current && !agentRef.current) {
                try {
                  // Minimal shim for agentRef to satisfy dispatchAction calls
                  agentRef.current = {
                    act: ({ _type, ...rest }: Record<string, unknown>) => {
                      const editor = editorRef.current;
                      const result = { diff: {}, promise: Promise.resolve() };
                      try {
                        if (!editor) return result;
                        const restObj = rest as {
                          shape?: SimpleGeoShape;
                          shapeId?: string;
                          shapeType?: string;
                          x?: number;
                          y?: number;
                          w?: number;
                          h?: number;
                          text?: string;
                        };
                        if (_type === "create") {
                          const shapeType = restObj.shape?._type;
                          const shapeId = restObj.shape?.shapeId
                            ? `shape:${restObj.shape.shapeId}`
                            : undefined;
                          let shapePayload: Record<string, unknown>;

                          if (shapeType === "text") {
                            // Create text shape with proper tldraw v4 props: use richText and w only
                            shapePayload = {
                              id: shapeId,
                              type: "text",
                              x: restObj.shape?.x ?? 0,
                              y: restObj.shape?.y ?? 0,
                              props: {
                                w: restObj.shape?.w ?? 220,
                                richText: toRichText(
                                  String(restObj.shape?.text ?? ""),
                                ),
                                color: restObj.shape?.color,
                              },
                            };
                          } else {
                            // Create geo shape with allowed geo types
                            const geoType = restObj.shape?._type ?? "rectangle";
                            const normalizedGeo = [
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
                              "cloud",
                            ].includes(geoType)
                              ? geoType
                              : "rectangle"; // fallback

                            shapePayload = {
                              id: shapeId,
                              type: "geo",
                              x: restObj.shape?.x ?? 0,
                              y: restObj.shape?.y ?? 0,
                              props: {
                                w: restObj.shape?.w ?? 100,
                                h: restObj.shape?.h ?? 80,
                                geo: normalizedGeo,
                                color: restObj.shape?.color,
                                fill: restObj.shape?.fill,
                              },
                            };
                          }

                          try {
                            console.log("[tldraw:createShape]", shapePayload);
                          } catch {}
                          editor.createShape(
                            shapePayload as Parameters<
                              Editor["createShape"]
                            >[0],
                          );
                        } else if (_type === "delete") {
                          if (restObj.shapeId) {
                            const deleteId =
                              `shape:${restObj.shapeId}` as unknown as Parameters<
                                Editor["deleteShape"]
                              >[0];
                            editor.deleteShape?.(deleteId);
                          }
                        } else if (_type === "move") {
                          if (restObj.shapeId) {
                            const moveId = `shape:${restObj.shapeId}`;
                            const current = editor.getShape(moveId as any);
                            const moveType =
                              restObj.shapeType || current?.type || "geo";
                            editor.updateShapes?.([
                              {
                                id: moveId,
                                type: moveType,
                                x: restObj.x,
                                y: restObj.y,
                              },
                            ] as Parameters<Editor["updateShapes"]>[0]);
                          }
                        } else if (_type === "label") {
                          // For v4.0.2, inline text on geo may be invalid; skip or switch to a dedicated text shape
                          try {
                            console.warn(
                              "[tldraw:label] geo text not supported, skipping label change",
                              { shapeId: restObj.shapeId, text: restObj.text },
                            );
                          } catch {}
                        } else if (_type === "clear") {
                          const ids = Array.from(
                            editor.getCurrentPageShapeIds() ?? [],
                          );
                          editor.deleteShapes?.(
                            ids as unknown as Parameters<
                              Editor["deleteShapes"]
                            >[0],
                          );
                        } else if (_type === "setMyView") {
                          editor.zoomToBounds?.({
                            x: restObj.x ?? 0,
                            y: restObj.y ?? 0,
                            w: restObj.w ?? 0,
                            h: restObj.h ?? 0,
                          });
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
        {activeTab === "code" && enabledTools.includes("code") && (
          <div className="absolute inset-0 flex flex-col">
            {/* Toolbar */}
            <div
              className="h-12 px-3 md:px-4 shrink-0 border-b border-white/20 dark:border-white/10 bg-gradient-to-r from-slate-900/80 via-slate-900/70 to-slate-900/80 text-slate-200 flex items-center justify-between"
              role="toolbar"
              aria-label="IDE controls"
            >
              <div className="flex items-center gap-2 min-w-0">
                <label htmlFor="language-select" className="sr-only">
                  Language
                </label>
                <select
                  id="language-select"
                  aria-label="Select language"
                  className="text-xs px-2 py-1 rounded-md border border-white/10 bg-slate-800 text-slate-100 focus:outline-none"
                  value={activeFile?.language ?? "python"}
                  onChange={(e) => {
                    const nextLang = e.target.value;
                    setFiles((prev) =>
                      prev.map((f) =>
                        f.id === activeFileId
                          ? { ...f, language: nextLang }
                          : f,
                      ),
                    );
                  }}
                >
                  {languageOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`text-xs px-3 py-1.5 rounded-md border border-emerald-400/30 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white transition ${ideRunning ? "opacity-70 cursor-not-allowed" : ""}`}
                  onClick={runActiveFile}
                  disabled={ideRunning}
                  aria-busy={ideRunning}
                  aria-label="Run program"
                >
                  {ideRunning ? "Running…" : "Run ▶"}
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-md border border-white/10 bg-slate-800 hover:bg-slate-700 text-slate-100 transition"
                  onClick={() => setShowConsole((v) => !v)}
                  aria-pressed={showConsole}
                  aria-label={
                    showConsole ? "Hide output panel" : "Show output panel"
                  }
                >
                  {showConsole ? "Hide Output" : "Show Output"}
                </button>
              </div>
            </div>

            {/* Editor + Output area */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0">
                <MonacoEditor
                  key={activeFile?.language}
                  theme="vs-dark"
                  language={activeFile?.language ?? "typescript"}
                  defaultLanguage={activeFile?.language ?? "typescript"}
                  value={activeFile?.content ?? ""}
                  onChange={(v) => updateActiveFileContent(v ?? "")}
                  options={{
                    fontSize: 14,
                    minimap: { enabled: false },
                    automaticLayout: true,
                    wordWrap: "on",
                  }}
                />
              </div>

              {showConsole && (
                <div className="h-[26vh] border-t border-white/10 bg-slate-900/80 text-slate-100">
                  <div className="h-9 px-3 border-b border-white/10 flex items-center justify-between">
                    <div className="text-[11px] font-medium">Output</div>
                    <div className="flex items-center gap-2">
                      <button
                        className="text-[11px] px-2 py-1 rounded border border-white/10 bg-slate-800 hover:bg-slate-700"
                        onClick={clearConsole}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="p-2 h-[calc(26vh-2.25rem)] overflow-auto text-xs">
                    {ideOutputs.length === 0 ? (
                      <div className="text-slate-400">
                        No output yet. Use Run ▶ to execute your Python file.
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {ideOutputs.map((o, i) => (
                          <li
                            key={i}
                            className={
                              o.type === "stderr"
                                ? "text-red-400"
                                : o.type === "info"
                                  ? "text-cyan-300"
                                  : "text-slate-100"
                            }
                          >
                            <span className="text-[10px] text-slate-500 mr-2">
                              {new Date(o.ts).toLocaleTimeString()}
                            </span>
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
        {activeTab === "notes" && enabledTools.includes("notes") && (
          <div
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: showYaml ? "1fr 1fr" : "1fr" }}
          >
            {showYaml && (
              <div className="p-4 bg-white/60 dark:bg-slate-900/40 backdrop-blur flex flex-col min-h-0">
                <NotesEditor value={notesYaml} onChange={setNotesYaml} />
              </div>
            )}
            <div
              className={
                showYaml
                  ? "p-4 border-l bg-white/30 dark:bg-slate-900/30 backdrop-blur overflow-auto"
                  : "p-4 bg-white/30 dark:bg-slate-900/30 backdrop-blur overflow-auto"
              }
            >
              <div className="h-10 flex items-center justify-between mb-2">
                <div className="text-sm font-medium">Lesson</div>
                <button
                  className="text-[11px] px-2 py-1 rounded border border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/40 hover:bg-white/40 dark:hover:bg-slate-800/60"
                  onClick={() => setShowYaml((v) => !v)}
                >
                  {showYaml ? "Hide YAML" : "Show YAML"}
                </button>
              </div>
              <div className="w-full grid place-items-center">
                <NotesRenderer yaml={notesYaml} />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Floating bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between z-40 pointer-events-none">
        <div className="rounded-full p-1 flex gap-1 bg-white/60 border border-black/5 shadow-sm backdrop-blur-sm pointer-events-auto">
          {enabledTools.includes("whiteboard") && (
            <button
              className={`px-4 py-2 text-xs font-medium rounded-full transition-all ${activeTab === "whiteboard" ? "bg-[#1A1A1A] text-[#F2F1EA] shadow-md" : "text-gray-600 hover:bg-black/5"}`}
              onClick={() => setActiveTab("whiteboard")}
            >
              Whiteboard
            </button>
          )}
          {enabledTools.includes("code") && (
            <button
              className={`px-4 py-2 text-xs font-medium rounded-full transition-all ${activeTab === "code" ? "bg-[#1A1A1A] text-[#F2F1EA] shadow-md" : "text-gray-600 hover:bg-black/5"}`}
              onClick={() => setActiveTab("code")}
            >
              Code
            </button>
          )}
          {enabledTools.includes("notes") && (
            <button
              className={`px-4 py-2 text-xs font-medium rounded-full transition-all ${activeTab === "notes" ? "bg-[#1A1A1A] text-[#F2F1EA] shadow-md" : "text-gray-600 hover:bg-black/5"}`}
              onClick={() => setActiveTab("notes")}
            >
              Notes
            </button>
          )}
        </div>
        <div className="pointer-events-auto">
          <AIVoiceAgentPanel
            className="border-0 bg-transparent shadow-none p-0"
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
            setVadEagerness={(v: "low" | "medium" | "high") =>
              applyVadEagerness(v)
            }
          />
        </div>
      </div>

      {/* Logs window (top-right) */}
      {showLogs && (
        <div className="fixed right-4 top-20 z-40 w-80 max-h-[50vh] rounded-xl border border-black/10 bg-[#F2F1EA]/90 backdrop-blur-xl shadow-xl overflow-hidden">
          <div className="h-9 px-3 flex items-center justify-between border-b border-black/5 bg-white/30">
            <div className="text-sm font-semibold">Logs</div>
            <div className="flex items-center gap-2">
              <button
                className="text-[10px] px-2 py-1 rounded border border-black/10 bg-white/60 hover:bg-white/80"
                onClick={() => setShowSaveLog((v) => !v)}
              >
                {showSaveLog ? "Hide save" : "Save"}
              </button>
              <button
                className="text-xs px-2 py-1 rounded border border-black/10 bg-white/60 hover:bg-white/80"
                onClick={() => setShowLogs(false)}
              >
                Close
              </button>
            </div>
          </div>
          <div className="p-2 h-[calc(50vh-2.25rem)] overflow-auto">
            <ul className="text-xs space-y-1 font-mono text-gray-600">
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
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowSaveLog(false)}
          />
          <div className="relative w-[420px] rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl shadow-2xl p-4">
            <div className="text-sm font-medium mb-2">Export session log</div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mb-3">
              Downloads a <code>log.json</code> containing turns with
              transcripts, context sizes, images lengths, and tool calls.
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                className="text-xs px-3 py-1.5 rounded-md border border-white/20 dark:border-white/10 bg-white/20 dark:bg-slate-800/40 hover:bg-white/40 dark:hover:bg-slate-800/60"
                onClick={() => setShowSaveLog(false)}
              >
                Cancel
              </button>
              <button
                className="text-xs px-3 py-1.5 rounded-md text-white bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600"
                onClick={() => {
                  try {
                    const payload = {
                      ts: Date.now(),
                      turns: sessionTurnsRef.current || [],
                      device: {
                        inputId: selectedInputId || "default",
                        outputId: selectedOutputId || "default",
                      },
                      vad: { eagerness: vadEagerness, pushToTalk },
                    };
                    const blob = new Blob([JSON.stringify(payload, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "log.json";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                    setShowSaveLog(false);
                  } catch {}
                }}
              >
                Download log.json
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context window (top-left) */}
      {showContext && (
        <div className="fixed left-4 top-20 z-40 w-[420px] max-h-[60vh] rounded-xl border border-black/10 bg-[#F2F1EA]/90 backdrop-blur-xl shadow-xl overflow-hidden">
          <div className="h-9 px-3 flex items-center justify-between border-b border-black/5 bg-white/30">
            <div className="text-sm font-semibold">Auto Context</div>
            <button
              className="text-xs px-2 py-1 rounded border border-black/10 bg-white/60 hover:bg-white/80"
              onClick={() => setShowContext(false)}
            >
              Close
            </button>
          </div>
          <div
            className="p-3 space-y-2 text-xs overflow-auto"
            style={{ maxHeight: "calc(60vh - 2.25rem)" }}
          >
            <div className="text-[11px] text-gray-500">
              Last sent:{" "}
              {debugContext
                ? new Date(debugContext.ts).toLocaleTimeString()
                : "—"}
            </div>
            <div>
              <div className="font-medium mb-1">view_context (JSON)</div>
              <pre className="whitespace-pre-wrap break-words font-mono bg-white/60 p-1 rounded">
                {debugContext?.text ?? "—"}
              </pre>
            </div>
            <div>
              <div className="font-medium mb-1">viewport image</div>
              {debugContext?.imageUrl ? (
                <div className="relative w-full aspect-video">
                  <Image
                    src={debugContext.imageUrl}
                    alt="viewport"
                    fill
                    sizes="420px"
                    unoptimized
                    className="object-contain border rounded bg-white"
                  />
                </div>
              ) : (
                <div className="text-gray-500">—</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tool calls window (bottom-left) */}
      {showCalls && (
        <div className="fixed left-4 bottom-20 z-40 w-[420px] max-h-[40vh] rounded-xl border border-black/10 bg-[#F2F1EA]/90 backdrop-blur-xl shadow-xl overflow-hidden">
          <div className="h-9 px-3 flex items-center justify-between border-b border-black/5 bg-white/30">
            <div className="text-sm font-semibold">Tool Calls</div>
            <button
              className="text-xs px-2 py-1 rounded border border-black/10 bg-white/60 hover:bg-white/80"
              onClick={() => setShowCalls(false)}
            >
              Close
            </button>
          </div>
          <div className="p-2 h-[calc(40vh-2.25rem)] overflow-auto">
            <ul className="text-xs space-y-1 font-mono">
              {toolEvents.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[10px] text-gray-500">
                    {new Date(e.ts).toLocaleTimeString()}
                  </span>
                  <span
                    className={`text-[10px] ${e.status === "error" ? "text-red-600" : e.status === "done" ? "text-emerald-600" : "text-gray-700"}`}
                  >
                    {e.status}
                  </span>
                  <span className="text-[10px] font-semibold">{e.name}</span>
                  {typeof e.ms === "number" && (
                    <span className="text-[10px] text-gray-500">{e.ms}ms</span>
                  )}
                  <span className="text-[10px] text-gray-500">rid={e.rid}</span>
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

function hashString(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    const chr = input.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return hash.toString(36);
}

function snapshotHash(snapshot: unknown): string | null {
  try {
    return hashString(JSON.stringify(snapshot ?? null));
  } catch {
    return null;
  }
}
