# Notes System (YAML-First)

The notes system lets AI and users author structured lessons as YAML documents that render alongside the whiteboard and IDE. Notes are stored per session in Convex.

**Related docs:**
- [Realtime Agent](realtime-agent.md) — Notes tools reference
- [Architecture](architecture.md) — Session flow

## Vision

- Single YAML document with a `blocks` array
- Blocks render next to the whiteboard/IDE; the agent can set/append YAML via tools

## YAML Document Structure
```yaml
title: "Lesson: Fractions"
version: 1
metadata:
  tags: [math, basics]
blocks:
  - type: text
    md: |
      ## What are fractions?
      Fractions represent parts of a whole.
  - type: quiz
    id: quiz-1
    title: "Quick Check"
    questions:
      - id: q1
        prompt: "What is 2 + 2?"
        options: ["3", "4", "5"]
        answer: "4"
        explanation: "Basic addition"
  - type: input
    id: var-a
    label: "Enter a value"
    inputType: number
  - type: embed
    id: pen-1
    provider: codepen
    ref: abc123
    height: 320
```

## Renderer

- **Text:** Markdown (GFM) with sanitization
- **Quiz:** MCQ UI with feedback/score
- **Input:** Typed inputs stored locally
- **Embed:** Sandboxed iframes for `codepen|stackblitz|jsfiddle`

## Validation and IDs

- Interactive blocks (`quiz`, `input`, `embed`) must have unique `id` (lowercase/nums/hyphens)
- Tools enforce:
  - `notes_set_yaml`: replace full doc after validation
  - `notes_append_block_yaml`: validate single block, reject duplicate IDs

## UI/UX (SessionWorkspace Notes tab)

- Rendered lesson centered; optional “Show YAML” toggles Monaco editor side-by-side
- YAML editor: YAML language, soft wrap, validation errors listed inline
- Apply/save: updates only when YAML is valid

## Implementation

- **Schemas/types:** `types/notesYaml.ts` (zod + js-yaml)
  - `parseNotesYaml`, `parseBlockYaml`, `serializeNotesYaml`
- **Components:** `components/lesson/NotesRenderer`, `components/lesson/NotesEditor`
- **Tools** (see [Realtime Agent](realtime-agent.md)):
  - `notes_set_yaml`, `notes_append_block_yaml`, `notes_read_file(name?)`
  - Legacy: `notes_set_text`, `notes_append` (markdown text)
- **Persistence:** `convex/spaces.ts` (`lesson_sessions` table); updates via `updateLesson`

## Security

- Markdown sanitized via `rehype-sanitize`
- Embeds sandboxed; no `allow-same-origin`
- Provider and ref validated; only allowlisted providers render

## Planned Features

- `codecell` block (Pyodide/Judge0 execution) with input wiring
- Versioned history for notes in Convex