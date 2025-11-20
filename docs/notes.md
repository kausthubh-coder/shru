# Notes System (YAML-First)

The notes system allows AI and users to author structured lessons as YAML documents that render alongside the whiteboard and IDE.

**Related docs:**
- [Realtime Agent](realtime-agent.md) — Notes tools reference
- [Test App Guide](test-app.md) — UI and usage

## Vision

- AI and users author notes as a single YAML document with a `blocks` array
- Blocks render alongside whiteboard/IDE; the agent can set/append YAML via tools

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

- **Text blocks:** Render Markdown (GFM) safely with sanitization
- **Quiz blocks:** Provide MCQ UI with feedback and score
- **Input blocks:** Simple typed inputs stored locally
- **Embed blocks:** Render sandboxed iframes for `codepen|stackblitz|jsfiddle`

## Validation and IDs

- Interactive blocks (`quiz`, `input`, `embed`) must include a unique `id` (lowercase letters, numbers, hyphens)
- Duplicate IDs across interactive blocks are rejected by the schema and by the notes tools
- The notes tools enforce:
  - `notes_set_yaml`: Replaces the entire YAML document after validation
  - `notes_append_block_yaml`: Validates a single block and appends it, rejecting duplicates for `quiz|input|embed` IDs

## UI/UX

In the Notes tab:
- Default view is a rendered lesson in a centered container (max width ~5xl)
- Toggle button: "Show YAML" reveals the Monaco editor side-by-side; "Hide YAML" collapses it
- The editor is Monaco with YAML language, tabs, soft wrap, and live validation (zod)
- Apply button updates the render only if YAML is valid; errors list at the bottom of the editor

## Implementation

**Schemas/types:** `app/test-app/types/notesYaml.ts` (zod + js-yaml) with helpers:
- `parseNotesYaml` — Parse full YAML document
- `parseBlockYaml` — Parse single block
- `serializeNotesYaml` — Serialize document to YAML string

**Components:**
- `NotesRenderer` — Renders YAML blocks (text, quiz, input, embed)
- `NotesEditor` — Monaco YAML editor with validation

**Tools** (see [Realtime Agent](realtime-agent.md) for details):
- `notes_set_yaml` — Replace entire YAML document
- `notes_append_block_yaml` — Append single validated block
- `notes_read_file(name?)` — Read YAML from IDE workspace (read-only, doesn't mutate state)
- Legacy: `notes_set_text`, `notes_append` (markdown text)

**Wiring:** Notes tab in `app/test-app/page.tsx` uses the YAML editor + renderer.

## Security

- Markdown sanitized via `rehype-sanitize`
- Embeds sandboxed; no `allow-same-origin`
- Provider and ref are validated; only allowlisted providers render

## Planned Features

- `codecell` block (Pyodide/Judge0 execution) with input wiring
- Persist notes in Convex with version history