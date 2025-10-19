# Test App (`/test-app`)

The prototype centers on `app/test-app/page.tsx` with extracted components and modular agent files. It brings together:

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

## How the agent “sees” the board

The page periodically sends:

- `view_context` — a compact JSON summary of visible shapes and selections
- `input_image` — a viewport-bounded screenshot as a data URL

- Combined sender: both parts are typically posted together in a single message with basic deduplication and a short debounce (~120ms) before triggering `response.create`.
- Implementation specifics (current):
  - Debounce before `response.create`: ~120ms to ensure the data channel delivers context first.
  - Dedup window: ~300ms to skip resending when both JSON and image are unchanged.
  - Screenshot is omitted when no shapes are visible in the viewport.

Notes on tldraw v4.0.2 compatibility:
- Text shapes must be created with `props.richText` (use `toRichText('...')`). Using `props.text` or `props.label` on `type: 'text'` will fail validation.
- Geo shape text content should also use `props.richText`; avoid `label`. The app avoids inline geo text where unsupported and instead places a nearby text label when needed.
- Unsupported `geo` names are normalized (e.g., `parallelogram → rhombus`, `circle → ellipse`, `square → rectangle`, fallback `rectangle`).

Whiteboard text tools:
- `agent_create_text(x, y, text, w?, h?, color?)` — creates a standalone text shape at the given coordinates. Prefer this for adding text; use `agent_label(shapeId, text)` to place a text label near an existing non‑text shape.

IDE tools (Single-file Python):
- `ide_read_code()` — returns `{ name, language, content }` of active file
- `ide_apply_edits({ edits })` — applies precise edits (char or line ranges)
- `ide_run_active()` — runs current Python file and returns `{ stdout, stderr, info }`
- `ide_get_context()` — returns `{ files, active }` summary

The agent uses these to reason about layout without expensive OCR.

## Tools: registry, approvals, and telemetry

- Tool registry: `agent/registry.ts` bundles tools from whiteboard, IDE, and notes into a single list which is registered with the Realtime agent.
- Telemetry: Every tool execution is wrapped by `createWrapExecute` to emit:
  - start/done/error events with a request id (rid) and duration (ms)
  - a visible busy indicator in the UI (“Running tool…”) via `setToolBusy`
  - structured logs like `[tool:start]`, `[tool:done]`, and `[tool:error]`
- Approvals: Destructive actions require confirmation.
  - `agent_clear` requests approval first and returns `approval_required` until the UI confirms; no clearing occurs by default.
  - The UI can listen for an approval event (with `rid: "approval"`) and display a confirmation dialog before re-dispatching.
- Labels/text:
  - Inline labels on geo shapes are avoided for tldraw v4.0.2 compatibility; `agent_label` creates a nearby text shape instead of mutating the geo.
  - For standalone text, use `agent_create_text(x, y, text, ...)`.

## Caveats

- This is a prototype. Expect rough edges in tool reliability and error handling.
- First response is gated until the session prompt and audio config are applied. If you see unexpected behavior on the very first turn, check the logs for `session.update` before `response.create`.
- Audio playback may require a user gesture in some browsers; the page attempts to auto-play output audio after Start.


