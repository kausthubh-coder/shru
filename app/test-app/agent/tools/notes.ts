import { z } from "zod";
import { AgentRuntime, ToolResult, createWrapExecute } from "../../types/toolContracts";
import { parseNotesYaml, parseBlockYaml, serializeNotesYaml, NotesDoc, NotesDocT, BlockT } from "../../types/notesYaml";

export function buildNotesTools(runtime: AgentRuntime) {
  const wrapExecute = createWrapExecute(runtime);

  const notes_set_text = {
    name: "notes_set_text",
    description: "Replace the notes markdown text.",
    parameters: z.object({ text: z.string() }),
    execute: wrapExecute("notes_set_text", async ({ text }: any): Promise<ToolResult<string>> => {
      runtime.notes.setText(String(text ?? ""));
      return { status: 'ok', summary: `notes set (${(text ?? "").length} chars)` };
    }),
  } as const;

  const notes_append = {
    name: "notes_append",
    description: "Append markdown to the notes text.",
    parameters: z.object({ text: z.string() }),
    execute: wrapExecute("notes_append", async ({ text }: any): Promise<ToolResult<string>> => {
      runtime.notes.append(String(text ?? ""));
      return { status: 'ok', summary: `notes appended (${(text ?? "").length} chars)` };
    }),
  } as const;

  const notes_set_yaml = {
    name: "notes_set_yaml",
    description: "Replace the entire notes YAML document.",
    parameters: z.object({ yaml: z.string() }),
    execute: wrapExecute("notes_set_yaml", async ({ yaml }: any): Promise<ToolResult<string>> => {
      const { doc, errors } = parseNotesYaml(String(yaml ?? ""));
      if (errors.length || !doc) return { status: 'error', summary: `invalid yaml: ${errors[0] || 'parse error'}` };
      const nextYaml = serializeNotesYaml(doc);
      runtime.notes.setText(nextYaml);
      return { status: 'ok', summary: `notes yaml set: ${doc.blocks.length} blocks` };
    }),
  } as const;

  const notes_append_block_yaml = {
    name: "notes_append_block_yaml",
    description: "Append a single block (YAML snippet) to the notes YAML document.",
    parameters: z.object({ blockYaml: z.string() }),
    execute: wrapExecute("notes_append_block_yaml", async ({ blockYaml }: any): Promise<ToolResult<string>> => {
      const current = (runtime as any).notes?.getText?.() as string | undefined;
      const existing = typeof current === 'string' ? current : '';
      const { doc, errors } = parseNotesYaml(existing || "title: Notes\nversion: 1\nblocks: []\n");
      if (errors.length || !doc) return { status: 'error', summary: `existing yaml invalid: ${errors[0] || 'parse error'}` };
      const parsed = parseBlockYaml(String(blockYaml ?? ""));
      if (parsed.errors.length || !parsed.block) return { status: 'error', summary: `block invalid: ${parsed.errors[0] || 'parse error'}` };
      // Enforce id uniqueness for blocks requiring ids
      if ((parsed.block.type === 'quiz' || parsed.block.type === 'input' || parsed.block.type === 'embed') && doc.blocks.some((b: any) => (b as any).id === (parsed.block as any).id)) {
        return { status: 'error', summary: `duplicate id: ${(parsed.block as any).id}` };
      }
      const nextDoc: NotesDocT = { ...doc, blocks: [...doc.blocks, parsed.block as BlockT] };
      const nextYaml = serializeNotesYaml(nextDoc);
      runtime.notes.setText(nextYaml);
      return { status: 'ok', summary: `block appended: ${parsed.block.type}` };
    }),
  } as const;

  return [notes_set_text, notes_append, notes_set_yaml, notes_append_block_yaml];
}




