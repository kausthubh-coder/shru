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
  args?: any;
  result?: any;
  err?: string;
};

export interface WhiteboardRuntime {
  dispatchAction: (action: any) => Promise<void>;
  getViewContext: () => any;
  getScreenshot: () => Promise<string | null>;
  getSimpleShape: (shapeId: string) => any | null;
  getVisibleTextItems: () => Array<{ shapeId: string; type: string; text: string; note?: string }>;
}

export interface IdeRuntime {
  createFile: (name: string, language: string, content: string) => void;
  setActiveByName: (name: string) => boolean;
  updateActiveContent: (content: string) => void;
  getContext: () => { files: Array<{ name: string; language: string; size: number }>; active?: string };
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
  sendTransportEvent?: (evt: any) => void;
  appendLog?: (line: string) => void;
  onToolEvent?: (e: ToolEventRecord) => void;
  setToolBusy?: (busy: boolean) => void;
}

export type WrapExecuteFn = (
  name: string,
  fn: (args: any, details?: any) => Promise<any> | any,
) => (args: any, details?: any) => Promise<any>;

function safeJson(value: any, limit = 600): string {
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
    const t0 = (typeof performance !== 'undefined' && (performance as any).now) ? (performance as any).now() : Date.now();
    try {
      runtime.appendLog?.(`[tool:start] ${name} rid=${rid} args=${safeJson(args)}`);
      // developer console visibility
      console.log(`[tool:start] ${name} rid=${rid}`, { args });
    } catch {}
    try { runtime.onToolEvent?.({ ts: Date.now(), rid, name, status: 'start', args }); } catch {}
    try {
      runtime.setToolBusy?.(true);
      const res = await fn(args, details);
      const t1 = (typeof performance !== 'undefined' && (performance as any).now) ? (performance as any).now() : Date.now();
      const ms = Math.round(t1 - t0);
      try {
        runtime.appendLog?.(`[tool:done] ${name} rid=${rid} ${ms}ms result=${typeof res === 'string' ? res : safeJson(res)}`);
        console.log(`[tool:done] ${name} rid=${rid} ${ms}ms`, { result: res });
      } catch {}
      try { runtime.onToolEvent?.({ ts: Date.now(), rid, name, status: 'done', result: res, ms }); } catch {}
      return res;
    } catch (e: any) {
      const t1 = (typeof performance !== 'undefined' && (performance as any).now) ? (performance as any).now() : Date.now();
      const ms = Math.round(t1 - t0);
      const stack = e?.stack ? String(e.stack).slice(0, 600) : '';
      try {
        runtime.appendLog?.(`[tool:error] ${name} rid=${rid} ${ms}ms err=${String(e?.message ?? e)}${stack ? ` stack=${stack}` : ''}`);
        console.error(`[tool:error] ${name} rid=${rid} ${ms}ms`, e);
      } catch {}
      try { runtime.onToolEvent?.({ ts: Date.now(), rid, name, status: 'error', err: String(e?.message ?? e), ms }); } catch {}
      throw e;
    } finally {
      try { runtime.setToolBusy?.(false); } catch {}
    }
  };
}


