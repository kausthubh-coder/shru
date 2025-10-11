import { z } from "zod";
import yaml from "js-yaml";

// Discriminated union for note blocks defined in a single YAML document

const id = z
  .string()
  .regex(/^[a-z0-9-]+$/, "id must be lowercase, numbers, and hyphens only");

export const TextBlock = z.object({
  type: z.literal("text"),
  md: z.string().min(1).max(20000),
});

const QuizQuestion = z.object({
  id,
  prompt: z.string().min(1).max(1000),
  options: z.array(z.string()).min(2).max(8),
  answer: z.string(),
  explanation: z.string().optional(),
});

export const QuizBlock = z.object({
  type: z.literal("quiz"),
  id,
  title: z.string().optional(),
  questions: z.array(QuizQuestion).min(1).max(20),
});

export const InputBlock = z.object({
  type: z.literal("input"),
  id,
  label: z.string().min(1).max(200),
  inputType: z.enum(["text", "number"]).default("text"),
  placeholder: z.string().optional(),
});

export const EmbedBlock = z.object({
  type: z.literal("embed"),
  id,
  provider: z.enum(["codepen", "stackblitz", "jsfiddle"]),
  ref: z.string().regex(/^[A-Za-z0-9_-]+$/, "invalid provider reference"),
  height: z.number().min(200).max(1200).default(360),
});

export const Block = z.discriminatedUnion("type", [
  TextBlock,
  QuizBlock,
  InputBlock,
  EmbedBlock,
]);

export const NotesDoc = z
  .object({
    title: z.string().min(1).max(200),
    version: z.number().int().min(1),
    metadata: z
      .object({
        tags: z.array(z.string()).max(12).optional(),
      })
      .optional(),
    blocks: z.array(Block).max(200),
  })
  .superRefine((val, ctx) => {
    try {
      const ids = new Set<string>();
      for (const b of val.blocks) {
        // Require id on interactive blocks only (quiz, input, embed)
        if (b.type === "quiz" || b.type === "input" || b.type === "embed") {
          const blockId = (b as any).id as string;
          if (!blockId) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${b.type} block requires an id`,
              path: ["blocks"],
            });
          } else if (ids.has(blockId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `duplicate id: ${blockId}`,
              path: ["blocks"],
            });
          } else {
            ids.add(blockId);
          }
        }
      }
    } catch {}
  });

export type TextBlockT = z.infer<typeof TextBlock>;
export type QuizBlockT = z.infer<typeof QuizBlock>;
export type InputBlockT = z.infer<typeof InputBlock>;
export type EmbedBlockT = z.infer<typeof EmbedBlock>;
export type BlockT = z.infer<typeof Block>;
export type NotesDocT = z.infer<typeof NotesDoc>;

export type ParseResult = { doc: NotesDocT | null; errors: Array<string> };

export function parseNotesYaml(source: string): ParseResult {
  try {
    const raw = yaml.load(source);
    const result = NotesDoc.safeParse(raw);
    if (!result.success) {
      const errs = result.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`);
      return { doc: null, errors: errs };
    }
    return { doc: result.data, errors: [] };
  } catch (e: any) {
    return { doc: null, errors: [String(e?.message ?? e)] };
  }
}

export function serializeNotesYaml(doc: NotesDocT): string {
  // Defer to js-yaml dump with safe defaults
  try {
    return yaml.dump(doc, { lineWidth: 80, noRefs: true });
  } catch (e: any) {
    return `# YAML serialization error: ${String(e?.message ?? e)}`;
  }
}

export type ParseBlockResult = { block: BlockT | null; errors: Array<string> };

export function parseBlockYaml(blockYaml: string): ParseBlockResult {
  try {
    const raw = yaml.load(blockYaml);
    const res = Block.safeParse(raw);
    if (!res.success) {
      const errs = res.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`);
      return { block: null, errors: errs };
    }
    return { block: res.data, errors: [] };
  } catch (e: any) {
    return { block: null, errors: [String(e?.message ?? e)] };
  }
}


