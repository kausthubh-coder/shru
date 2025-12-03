"use client";

export type VadEagerness = "low" | "medium" | "high";

export type RealtimeConnectParams = {
  token: string;
  selectedInputDeviceId?: string;
  selectedOutputDeviceId?: string;
  audioElement?: HTMLAudioElement | null;
  appendLog?: (line: string) => void;
  tools?: Array<any>;
  agentName?: string;
};

export type RealtimeConfigureParams = {
  model?: string;
  instructions?: string;
  voice?: string;
  outputModalities?: Array<"audio" | "text">;
  vadEagerness?: VadEagerness;
  createResponseFromVad?: boolean;
  interruptResponseFromVad?: boolean;
};

export interface RealtimeSessionHandle {
  connect(params: RealtimeConnectParams): Promise<void>;
  configure(params: RealtimeConfigureParams): Promise<void>;
  disconnect(): Promise<void>;
  sendEvent(evt: unknown): void;
  onAll(handler: (evt: unknown) => void): void;
  getSession(): unknown | null;
  getTransport(): unknown | null;
  getMediaStream(): MediaStream | null;
  getAudioElement(): HTMLAudioElement | null;
  setOutputDevice(deviceId: string): Promise<void>;
}

type RealtimeModules = {
  RealtimeAgent: any;
  RealtimeSession: any;
  OpenAIRealtimeWebRTC: any;
};

function isClient(): boolean {
  return typeof window !== "undefined";
}

export function createRealtimeSessionHandle(): RealtimeSessionHandle {
  let modules: RealtimeModules | null = null;
  let session: any | null = null;
  let transport: any | null = null;
  let mediaStream: MediaStream | null = null;
  let audioEl: HTMLAudioElement | null = null;
  let onAnyHandler: ((evt: unknown) => void) | null = null;

  const log = (s: string) => {
    try { console.log("[session]", s); } catch {}
  };

  async function loadModules(): Promise<RealtimeModules> {
    if (modules) return modules;
    if (!isClient()) throw new Error("Realtime modules must be loaded on client");
    const mod = await import("@openai/agents/realtime");
    modules = {
      RealtimeAgent: (mod as any).RealtimeAgent,
      RealtimeSession: (mod as any).RealtimeSession,
      OpenAIRealtimeWebRTC: (mod as any).OpenAIRealtimeWebRTC,
    };
    return modules;
  }

  async function getUserMedia(selectedInputDeviceId?: string): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = selectedInputDeviceId
      ? { audio: { deviceId: { exact: selectedInputDeviceId } as any } }
      : { audio: true };
    return await navigator.mediaDevices.getUserMedia(constraints);
  }

  async function setSinkIdIfSupported(el: HTMLAudioElement, deviceId?: string) {
    try {
      if (!deviceId) return;
      const anyEl: any = el as any;
      if (typeof anyEl.setSinkId === "function") {
        await anyEl.setSinkId(deviceId);
      }
    } catch (e) {
      try { console.warn("[session] setSinkId failed", e); } catch {}
    }
  }

  async function connect(params: RealtimeConnectParams): Promise<void> {
    const { token, selectedInputDeviceId, selectedOutputDeviceId, audioElement, appendLog, tools, agentName } = params;
    const logFn = appendLog || log;
    const { RealtimeAgent, RealtimeSession, OpenAIRealtimeWebRTC } = await loadModules();

    // Media
    mediaStream = await getUserMedia(selectedInputDeviceId);
    audioEl = audioElement ?? document.createElement("audio");
    try { audioEl.autoplay = true; (audioEl as any).playsInline = true; } catch {}

    // Transport
    transport = new OpenAIRealtimeWebRTC({ mediaStream, audioElement: audioEl });

    // Agent + Session
    const agent = new RealtimeAgent({ name: agentName ?? "Studi", instructions: "You are a helpful tutor.", tools: Array.isArray(tools) ? tools : undefined });
    session = new RealtimeSession(agent, { model: "gpt-realtime", transport });
    await session.connect({ apiKey: token });
    logFn("connected");

    // Wire wildcard events to external handler if provided later via onAll
    try {
      const off = session.transport?.on?.("*", (evt: unknown) => {
        if (onAnyHandler) {
          try { onAnyHandler(evt); } catch {}
        }
      });
      // Store unsubscribe if needed in future (not exposed yet)
      void off;
    } catch {}

    // Apply output device if requested
    if (audioEl && selectedOutputDeviceId) {
      await setSinkIdIfSupported(audioEl, selectedOutputDeviceId);
    }
  }

  async function configure(params: RealtimeConfigureParams): Promise<void> {
    if (!session) throw new Error("Session not connected");
    const model = params.model ?? "gpt-realtime";
    const output = Array.isArray(params.outputModalities) && params.outputModalities.length
      ? params.outputModalities
      : ["audio"];
    const voice = params.voice ?? "marin";
    const eagerness: VadEagerness = params.vadEagerness ?? "medium";
    const create_response = params.createResponseFromVad ?? false;
    const interrupt_response = params.interruptResponseFromVad ?? false;

    session.transport?.sendEvent?.({
      type: "session.update",
      session: {
        type: "realtime",
        model,
        output_modalities: output,
        audio: {
          input: {
            format: { type: "audio/pcm", rate: 24000 },
            turn_detection: { type: "semantic_vad", eagerness, create_response, interrupt_response },
          },
          output: { format: { type: "audio/pcm" }, voice },
        },
        instructions: params.instructions ?? undefined,
      },
    } as any);
  }

  async function disconnect(): Promise<void> {
    try { await session?.disconnect?.(); } catch {}
    try { (session as any)?.transport?.close?.(); } catch {}
    session = null;
    transport = null;
    // Stop mic tracks
    try { mediaStream?.getTracks().forEach((t) => { try { t.stop(); } catch {} }); } catch {}
    mediaStream = null;
    // Pause audio
    try { if (audioEl) { await audioEl.pause?.(); audioEl.muted = true; (audioEl as any).srcObject = null; } } catch {}
  }

  function sendEvent(evt: unknown) {
    try { session?.transport?.sendEvent?.(evt); } catch {}
  }

  function onAll(handler: (evt: unknown) => void) {
    onAnyHandler = handler;
  }

  async function setOutputDevice(deviceId: string): Promise<void> {
    if (!audioEl) return;
    await setSinkIdIfSupported(audioEl, deviceId);
  }

  return {
    connect,
    configure,
    disconnect,
    sendEvent,
    onAll,
    getSession: () => session,
    getTransport: () => transport,
    getMediaStream: () => mediaStream,
    getAudioElement: () => audioEl,
    setOutputDevice,
  };
}


