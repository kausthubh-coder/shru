# Notes System Design (YAML-first in test-app)

Vision
- AI and users author notes as a single YAML document with a `blocks` array.
- Blocks render alongside whiteboard/IDE; the agent can set/append YAML via tools.

YAML document shape
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

Renderer
- Text blocks render Markdown (GFM) safely with sanitize.
- Quiz blocks provide MCQ UI with feedback and score.
- Input blocks provide simple typed inputs stored locally.
- Embed blocks render sandboxed iframes for `codepen|stackblitz|jsfiddle`.

Validation and IDs (current):
- Interactive blocks (quiz, input, embed) must include a unique `id` (lowercase letters, numbers, hyphens).
- Duplicate ids across interactive blocks are rejected by the schema and by the notes tools.
- The notes tools enforce:
  - `notes_set_yaml`: replaces the entire YAML document after validation
  - `notes_append_block_yaml`: validates a single block and appends it, rejecting duplicates for `quiz|input|embed` ids

UI/UX in the Notes tab
- Default view is a rendered lesson in a centered container (max width ~5xl).
- Toggle button: “Show YAML” reveals the Monaco editor side‑by‑side; “Hide YAML” collapses it.
- The editor is Monaco with YAML language, tabs, soft wrap, and live validation (zod).
- Apply button updates the render only if YAML is valid; errors list at the bottom of the editor.

Implementation (test-app)
- Schemas/types: `app/test-app/types/notesYaml.ts` (zod + js-yaml) with helpers `parseNotesYaml`, `parseBlockYaml`, `serializeNotesYaml`.
- Components: `NotesRenderer` and `NotesEditor` under `app/test-app/components/`.
- Tools: `notes_set_yaml`, `notes_append_block_yaml` plus legacy `notes_set_text`, `notes_append` in `app/test-app/agent/tools/notes.ts`.
- Wiring: Notes tab in `app/test-app/page.tsx` uses the YAML editor + renderer.

Security
- Markdown sanitized via `rehype-sanitize`.
- Embeds sandboxed; no `allow-same-origin`.
- Provider and ref are validated; only allowlisted providers render.

Planned (later phases)
- Add `codecell` block (Pyodide/Judge0 execution) with input wiring.
- Persist notes in Convex with version history.