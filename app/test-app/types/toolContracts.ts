export type ToolResult<T = unknown> = {
  status: 'ok' | 'error';
  summary: string;
  data?: T;
};

import { z } from "zod";

export const schema = {
  id: z.object({ id: z.string() }),
  empty: z.object({}),
  shapeId: z.object({ shapeId: z.string() }),
  position: z.object({ x: z.number(), y: z.number() }),
  rect: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
};

export type ToolEventRecord = {
  ts: number;
  rid: string;
  name: string;
  status: 'start' | 'done' | 'error';
  ms?: number;
  args?: unknown;
  result?: unknown;
  err?: string;
};

export type WhiteboardShape = {
  shapeId?: string;
  type?: string;
  _type?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
  note?: string;
  geo?: string;
};

export interface WhiteboardRuntime {
  dispatchAction: (action: Record<string, unknown>) => Promise<void>;
  getViewContext: () => unknown;
  getScreenshot: () => Promise<string | null>;
  getSimpleShape: (shapeId: string) => WhiteboardShape | null;
  getVisibleTextItems: () => Array<{ shapeId: string; type: string; text: string; note?: string }>;
}

export interface IdeRuntime {
  createFile: (name: string, language: string, content: string) => void;
  setActiveByName: (name: string) => boolean;
  updateActiveContent: (content: string) => void;
  getContext: () => { files: Array<{ name: string; language: string; size: number }>; active?: string };
  getActiveContent: () => { name: string; language: string; content: string } | null;
  runActive: () => Promise<{ stdout: string; stderr: string; info: string[] }>;
}

export interface NotesRuntime {
  getText: () => string;
  setText: (text: string) => void;
  append: (text: string) => void;
}

export interface AgentRuntime {
  whiteboard: WhiteboardRuntime;
  ide: IdeRuntime;
  notes: NotesRuntime;
  sendTransportEvent?: (evt: unknown) => void;
  appendLog?: (line: string) => void;
  onToolEvent?: (e: ToolEventRecord) => void;
  setToolBusy?: (busy: boolean) => void;
}

export type WrapExecuteFn = <TArgs = unknown, TResult = unknown>(
  name: string,
  fn: (args: TArgs, details?: unknown) => Promise<TResult> | TResult,
) => (args: TArgs, details?: unknown) => Promise<TResult>;

function safeJson(value: unknown, limit = 600): string {
  try {
    const s = JSON.stringify(value);
    return s.length > limit ? s.slice(0, limit) + '…' : s;
  } catch {
    return '[unserializable]';
  }
}

export function createWrapExecute(runtime: AgentRuntime): WrapExecuteFn {
  return (name, fn) => async (args, details) => {
    const rid = Math.random().toString(36).slice(2, 8);
    const t0 =
      typeof performance !== 'undefined' && (performance as typeof performance & { now?: () => number }).now
        ? performance.now()
        : Date.now();
    try {
      runtime.appendLog?.(`[tool:start] ${name} rid=${rid} args=${safeJson(args)}`);
      // developer console visibility
      console.log(`[tool:start] ${name} rid=${rid}`, { args });
    } catch {}
    try { runtime.onToolEvent?.({ ts: Date.now(), rid, name, status: 'start', args }); } catch {}
    try {
      runtime.setToolBusy?.(true);
      const res = await fn(args, details);
      const t1 =
        typeof performance !== 'undefined' && (performance as typeof performance & { now?: () => number }).now
          ? performance.now()
          : Date.now();
      const ms = Math.round(t1 - t0);
      try {
        runtime.appendLog?.(`[tool:done] ${name} rid=${rid} ${ms}ms result=${typeof res === 'string' ? res : safeJson(res)}`);
        console.log(`[tool:done] ${name} rid=${rid} ${ms}ms`, { result: res });
      } catch {}
      try { runtime.onToolEvent?.({ ts: Date.now(), rid, name, status: 'done', result: res, ms }); } catch {}
      return res;
    } catch (e: unknown) {
      const t1 =
        typeof performance !== 'undefined' && (performance as typeof performance & { now?: () => number }).now
          ? performance.now()
          : Date.now();
      const ms = Math.round(t1 - t0);
      const stack = e && typeof e === 'object' && 'stack' in e ? String((e as { stack?: unknown }).stack).slice(0, 600) : '';
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message) : String(e);
      try {
        runtime.appendLog?.(`[tool:error] ${name} rid=${rid} ${ms}ms err=${message}${stack ? ` stack=${stack}` : ''}`);
        console.error(`[tool:error] ${name} rid=${rid} ${ms}ms`, e);
      } catch {}
      try { runtime.onToolEvent?.({ ts: Date.now(), rid, name, status: 'error', err: message, ms }); } catch {}
      throw e;
    } finally {
      try { runtime.setToolBusy?.(false); } catch {}
    }
  };
}


