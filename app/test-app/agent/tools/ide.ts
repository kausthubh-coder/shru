import { z } from "zod";
import { AgentRuntime, ToolResult, createWrapExecute } from "../../types/toolContracts";

export function buildIdeTools(runtime: AgentRuntime) {
  const wrapExecute = createWrapExecute(runtime);

  const ide_create_file = {
    name: "ide_create_file",
    description: "Create a new file in the IDE workspace.",
    parameters: z.object({ name: z.string(), language: z.string().default("typescript"), content: z.string().default("") }),
    execute: wrapExecute("ide_create_file", async ({ name, language, content }: any): Promise<ToolResult<string>> => {
      runtime.ide.createFile(name, language, content ?? "");
      return { status: 'ok', summary: `created ${name}` };
    }),
  } as const;

  const ide_set_active = {
    name: "ide_set_active",
    description: "Set the active file by name.",
    parameters: z.object({ name: z.string() }),
    execute: wrapExecute("ide_set_active", async ({ name }: any): Promise<ToolResult<string>> => {
      const ok = runtime.ide.setActiveByName(name);
      return ok ? { status: 'ok', summary: `active ${name}` } : { status: 'error', summary: `not found ${name}` };
    }),
  } as const;

  const ide_update_content = {
    name: "ide_update_content",
    description: "Replace the active file's content.",
    parameters: z.object({ content: z.string() }),
    execute: wrapExecute("ide_update_content", async ({ content }: any): Promise<ToolResult<string>> => {
      runtime.ide.updateActiveContent(String(content ?? ""));
      return { status: 'ok', summary: `updated content (${(content ?? "").length} chars)` };
    }),
  } as const;

  const ide_get_context = {
    name: "ide_get_context",
    description: "Get JSON of files and active file.",
    parameters: z.object({}),
    execute: wrapExecute("ide_get_context", async (): Promise<string> => {
      const ctx = runtime.ide.getContext();
      return JSON.stringify(ctx);
    }),
  } as const;

  return [ide_create_file, ide_set_active, ide_update_content, ide_get_context];
}




