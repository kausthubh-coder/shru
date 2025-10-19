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

  const notes_read_file = {
    name: "notes_read_file",
    description: "Read a YAML lesson file from the IDE workspace and return its content as JSON { name, content }.",
    parameters: z.object({ name: z.string().nullable() }),
    execute: wrapExecute("notes_read_file", async ({ name }: any): Promise<string | ToolResult<string>> => {
      try {
        const ctx = runtime.ide.getContext();
        const prevActive = ctx.active;
        let changed = false;
        if (typeof name === 'string' && name) {
          if (name !== prevActive) {
            const ok = runtime.ide.setActiveByName(name);
            if (!ok) return { status: 'error', summary: `file not found: ${name}` };
            changed = true;
          }
        } else if (!prevActive) {
          return { status: 'error', summary: 'no active file to read' };
        }
        const snap = runtime.ide.getActiveContent();
        if (!snap) return { status: 'error', summary: 'failed to read active file' };
        // Restore previous active file if we changed it
        if (changed && prevActive) {
          try { runtime.ide.setActiveByName(prevActive); } catch {}
        }
        return JSON.stringify({ name: snap.name, content: snap.content });
      } catch (e: any) {
        return { status: 'error', summary: `read failed: ${String(e?.message ?? e)}` };
      }
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
      // Normalize whitespace and trim; if user passed a one-item list, unwrap it
      let input = String(yaml ?? "");
      input = input.trim();
      if (input.startsWith("- ")) {
        try {
          const maybe = parseBlockYaml(input);
          if (!maybe.errors.length && maybe.block) {
            const wrapped = { title: "Notes", version: 1, blocks: [maybe.block] } as NotesDocT;
            const nextYaml = serializeNotesYaml(wrapped);
            runtime.notes.setText(nextYaml);
            return { status: 'ok', summary: `notes yaml set (single block)` };
          }
        } catch {}
      }
      const { doc, errors } = parseNotesYaml(input);
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
      const { doc, errors } = parseNotesYaml((existing || "title: Notes\nversion: 1\nblocks: []\n").trim());
      if (errors.length || !doc) return { status: 'error', summary: `existing yaml invalid: ${errors[0] || 'parse error'}` };
      let snippet = String(blockYaml ?? "").trim();
      // If tool mistakenly sends a list with a single item, unwrap it by removing leading dash and space
      if (/^\s*-\s/.test(snippet)) {
        const lines = snippet.split(/\r?\n/);
        if (lines.length) lines[0] = lines[0].replace(/^\s*-\s*/, '');
        snippet = lines.join('\n');
      }
      const parsed = parseBlockYaml(snippet);
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

  return [notes_set_text, notes_append, notes_set_yaml, notes_append_block_yaml, notes_read_file];
}




