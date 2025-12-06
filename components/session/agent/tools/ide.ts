import { z } from "zod";
import { AgentRuntime, ToolResult, createWrapExecute } from "@/types/toolContracts";

export function buildIdeTools(runtime: AgentRuntime) {
  const wrapExecute = createWrapExecute(runtime);

  const ide_get_context = {
    name: "ide_get_context",
    description: "Get JSON of files and active file.",
    parameters: z.object({}),
    execute: wrapExecute("ide_get_context", async (): Promise<string> => {
      const ctx = runtime.ide.getContext();
      return JSON.stringify(ctx);
    }),
  } as const;

  const ide_read_code = {
    name: "ide_read_code",
    description: "Return the active file name, language, and full content.",
    parameters: z.object({}),
    execute: wrapExecute("ide_read_code", async (): Promise<string> => {
      const snap = runtime.ide.getActiveContent();
      if (!snap) return JSON.stringify({ error: "no-active-file" });
      return JSON.stringify(snap);
    }),
  } as const;

  const LineEdit = z.object({
    type: z.literal("line"),
    range: z.object({ startLine: z.number(), endLine: z.number() }),
    text: z.string().default(""),
  });
  const CharEdit = z.object({
    type: z.literal("char"),
    range: z.object({ start: z.number(), end: z.number() }),
    text: z.string().default("")
  });
  const Edit = z.discriminatedUnion("type", [LineEdit, CharEdit]);

  const ide_apply_edits = {
    name: "ide_apply_edits",
    description: "Apply precise edits to the active file. Supports line or char ranges.",
    parameters: z.object({ edits: z.array(Edit) }),
    execute: wrapExecute("ide_apply_edits", async ({ edits }: { edits: Array<{ type: string; range: { start?: number; end?: number; startLine?: number; endLine?: number }; text?: string }> }): Promise<ToolResult<string>> => {
      const snap = runtime.ide.getActiveContent();
      if (!snap) return { status: 'error', summary: 'no-active-file' };
      let content = String(snap.content ?? "");
      try {
        for (const e of edits) {
          if (e.type === 'char') {
            const start = Math.max(0, Math.min(content.length, Number(e.range?.start ?? 0)));
            const end = Math.max(start, Math.min(content.length, Number(e.range?.end ?? start)));
            content = content.slice(0, start) + String(e.text ?? '') + content.slice(end);
          } else if (e.type === 'line') {
            const lines = content.split(/\r?\n/);
            const startL = Math.max(1, Math.min(lines.length + 1, Number(e.range?.startLine ?? 1)));
            const endL = Math.max(startL, Math.min(lines.length + 1, Number(e.range?.endLine ?? startL)));
            const before = lines.slice(0, startL - 1);
            const after = lines.slice(endL - 1);
            const insert = String(e.text ?? '').replace(/\r\n/g, "\n").split("\n");
            const next = before.concat(insert).concat(after);
            content = next.join("\n");
          }
        }
        runtime.ide.updateActiveContent(content);
        return { status: 'ok', summary: `applied ${edits.length} edits`, data: String(content.length) };
      } catch (err: unknown) {
        return { status: 'error', summary: err instanceof Error ? err.message : String(err) };
      }
    }),
  } as const;

  const ide_run_active = {
    name: "ide_run_active",
    description: "Run the active Python file and return aggregated outputs (stdout, stderr, info).",
    parameters: z.object({}),
    execute: wrapExecute("ide_run_active", async (): Promise<ToolResult<string>> => {
      try {
        const result = await runtime.ide.runActive();
        const summary = `stdout: ${result.stdout.length} chars, stderr: ${result.stderr.length} chars, info: ${result.info.length} items`;
        return { 
          status: 'ok', 
          summary, 
          data: JSON.stringify(result) 
        };
      } catch (err: unknown) {
        return { status: 'error', summary: err instanceof Error ? err.message : String(err) };
      }
    }),
  } as const;

  return [ide_read_code, ide_apply_edits, ide_run_active, ide_get_context];
}




