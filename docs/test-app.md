# Test App (`/test-app`)

The prototype centers on `app/test-app/page.tsx` with extracted components and modular agent files. It brings together a realtime voice tutor, interactive whiteboard, IDE workspace, and YAML-driven lesson system.

**Related docs:**
- [Realtime Agent](realtime-agent.md) — Agent session and tools
- [Architecture Overview](architecture.md) — System architecture
- [IDE Tools](ide.md) — IDE capabilities
- [Notes System](notes.md) — YAML lesson system
- [Troubleshooting](troubleshooting.md) — Common issues

- A tldraw whiteboard
- A full-page IDE workspace using Monaco editor with language selection; Python executes via Pyodide
- A voice agent powered by OpenAI Realtime with a toolbelt to operate the board/IDE/notes (panel UI in `components/AIVoiceAgentPanel.tsx`)
  - Session lifecycle encapsulated in `agent/session.ts`
  - Runtime bridges for tools in `agent/runtime.ts`
- A live logs panel
  - Optional unified overlay: `components/DebugOverlay.tsx` combines Logs / Context / Calls with tabs

## Try it

1. Ensure env vars are set (see README) and run `npm run dev`.
2. Open `http://localhost:3000/test-app`.
3. Click "Start" in the AI Voice Agent dock. Grant microphone permission.
4. Speak to the agent: ask it to draw shapes, arrange items, or create a simple diagram.
5. Toggle tabs (Whiteboard / Code / Notes). The Notes tab renders lessons centered; use the “Show YAML” toggle to open the Monaco YAML editor alongside the render and click Apply to update.
6. Open the Logs panel to see unified tool and action logs; see also DevTools console for structured entries.

## Controls

- Start/Stop/Mute the agent from the dock (bottom-right)
- Open logs (top-right) to see events
- Tool logs print as `[tool:start|done|error]` along with a request id (rid) and elapsed time. Action mapping logs print `[act:start|map|done|error]` and the final `editor.createShape` payload.
- Use “Show Context” to inspect the exact JSON `view_context` and the viewport screenshot sent to the model (helpers in `lib/viewContext.ts`, sender prefers `services/context/index.ts` with a fallback to `services/autoContext.ts`)
- In the Notes tab, paste a sample YAML into the YAML editor and click Apply to render. Use “Hide YAML” to focus on the lesson view.
- Use “Show Calls” to see every tool call with name, rid, timing, and errors
- In the Code tab, pick a language from the dropdown and press Run. Output appears in the Output panel below the editor. Currently Run supports Python only.
 - Dev Controls: select microphone/speaker devices, adjust VAD eagerness, toggle push‑to‑talk, and play a test tone.
 - Save: export a `log.json` with per‑turn transcripts, context sizes, image lengths, and tool calls.

## How the Agent "Sees" the Board

The page automatically sends context before each agent response:

1. **`workspace_context` JSON** — Compact summary of:
   - Whiteboard: bounds, visible shapes, selections
   - IDE: active file name, language, content
   - Notes: full YAML document

2. **`input_image`** — Viewport-bounded JPEG screenshot (only when shapes are visible)

**Implementation:**
- Combined sender posts both in a single `conversation.item.create` message
- Deduplication: ~300ms window skips resending if both JSON and image unchanged
- Debounce: ~120ms delay before `response.create` to ensure context is delivered
- Screenshot omitted when no shapes are visible

See [Realtime Agent](realtime-agent.md#auto-context-strategy) for details.

**tldraw v4.0.2 Compatibility Notes:**
- Text shapes require `props.richText` (use `toRichText('...')`). Using `props.text` or `props.label` on `type: 'text'` will fail validation
- Geo shapes: Inline text is disabled; use `agent_label` to create a nearby text shape instead
- Unsupported `geo` names are normalized (e.g., `parallelogram → rhombus`, `circle → ellipse`, `square → rectangle`, fallback → `rectangle`)

See [Troubleshooting](troubleshooting.md#tldraw-validation-errors-unexpected-property--value) for validation error fixes.

Whiteboard text tools:
- `agent_create_text(x, y, text, w?, h?, color?)` — creates a standalone text shape at the given coordinates. Prefer this for adding text; use `agent_label(shapeId, text)` to place a text label near an existing non‑text shape.
 - `agent_get_text_context()` — returns visible texts (and notes) from shapes in the current viewport.

IDE tools (Single-file Python):
- `ide_read_code()` — returns `{ name, language, content }` of active file
- `ide_apply_edits({ edits })` — applies precise edits (char or line ranges)
- `ide_run_active()` — runs current Python file and returns `{ stdout, stderr, info }`
- `ide_get_context()` — returns `{ files, active }` summary

- Workflow: read the active file, apply diffs, optionally run. No file creation/switching; edits modify the in-memory buffer only.

The agent uses these to reason about layout without expensive OCR.

## Tools: Registry, Approvals, and Telemetry

**Tool Registry:** `agent/registry.ts` bundles tools from whiteboard, IDE, and notes into a single list registered with the Realtime agent.

**Telemetry:** Every tool execution is wrapped by `createWrapExecute` to emit:
- Start/done/error events with request ID (rid) and duration (ms)
- Visible busy indicator in UI ("Running tool…") via `setToolBusy`
- Structured logs: `[tool:start]`, `[tool:done]`, `[tool:error]`

**Approvals:** Destructive actions require confirmation:
- `agent_clear` requests approval first and returns `approval_required` until UI confirms
- UI listens for approval event (`rid: "approval"`) and displays confirmation dialog (`ToolApprovalDialog`) before re-dispatching

**Text/Labels:**
- Inline labels on geo shapes are avoided for tldraw v4.0.2 compatibility
- `agent_label` creates a nearby text shape instead of mutating the geo
- For standalone text, use `agent_create_text(x, y, text, ...)`

See [Realtime Agent](realtime-agent.md#tools) for complete tool reference.

## Caveats

- This is a prototype. Expect rough edges in tool reliability and error handling.
- First response is gated until the session prompt and audio config are applied. If you see unexpected behavior on the very first turn, check the logs for `session.update` before `response.create`.
- Audio playback may require a user gesture in some browsers; the page attempts to auto-play output audio after Start.


