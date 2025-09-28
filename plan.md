# ShruAI Whiteboard Agent Integration Plan (MVP)

This document is for a new developer joining the ShruAI project. It explains the current app, what we want to build, how the tldraw Agent Starter Kit (in `/agent`) works, and a step‑by‑step plan to implement “context gathering” (eyes) and a robust “action system” (hands) in our existing Next.js + OpenAI Realtime app at `app/test-app/page.tsx`.

---

## 0) TL;DR

- We already have: a Next.js demo with a tldraw canvas, custom Python windows, and an OpenAI Realtime voice agent with function tools.
- Problem: the agent is unreliable at canvas manipulation (poor context; tools are ad‑hoc; no validation or offsets).
- Goal: borrow the Agent Starter Kit’s proven patterns: structured context, strict action schemas, coordinate normalization, and sanitization — while keeping our voice UX.
- Deliverable (MVP): a minimal but reliable set of tools and helpers so the agent can see the canvas and perform small, atomic edits accurately.

---

## 1) Current app state (what’s in `app/test-app/page.tsx`)

High-level:
- Renders a `tldraw` canvas and stores the editor in `editorRef`.
- Provides a floating Python editor window (Pyodide) system.
- Starts an OpenAI Realtime agent with tools (function calling) and live audio in/out.
- Basic whiteboard helpers like `addBox(x,y)` and tools such as `whiteboard_create_box` (and python window tools).

Key parts to know:
- Editor mount: we capture the `tldraw` editor instance and use it inside tools.
- Voice agent: constructed in `startAgent()` using `@openai/agents/realtime`, with a few tools declared in-line.
- Tools: defined with `tool({ name, description, parameters, execute })` and call local helpers (e.g., `addBox`).

Current limitations:
- Tools aren’t using structured shape schemas or stable IDs; little/no validation.
- The model doesn’t get structured context about the current viewport or shapes, so it guesses.
- No concept of “session origin” offset → coordinates drift; no rounding or sanitization.

Takeaway: we’ll keep the UX, but refactor tools + add context/offset helpers to match the agent starter’s patterns.

---

## 2) The Agent Starter Kit (in `/agent`) — what we’re borrowing

Concepts to emulate:
- Eyes (PromptPartUtils): Gather context — user message, viewport bounds, screenshot, “blurry” shapes in view, selected shapes, peripheral clusters, history, todo list, etc.
- Hands (AgentActionUtils): Strict, modular actions with Zod schemas, sanitize() before applying, and small, atomic updates via the editor API.
- Offsets & rounding: Normalize coordinates relative to a chat/session origin; round numbers before sending to model; unround when applying.
- Streaming discipline: Prefer small actions; verify with follow‑up context.

Files to skim in `/agent` for reference:
- `client/agent/TldrawAgent.ts`: the streaming loop, action application, and history/diff capture.
- `shared/parts/*`: how context is assembled (screenshot, viewport, blurry shapes, etc.).
- `shared/actions/*`: how actions are validated and applied (create/move/update/delete/etc.).
- `shared/AgentHelpers.ts`: the offset/rounding/id-mapping helpers.

We won’t copy UI or backend; we’ll adopt the principles in our Realtime tool layer.

---

## 3) Target architecture for ShruAI (voice-first)

We’ll keep the voice agent and add two pillars:

1) Context tool (eyes)
   - A function tool `whiteboard_context({ includeScreenshot?: boolean })` that returns:
     - `bounds`: the agent’s current view (page-space box)
     - `shapes`: array of lightweight “blurry” shapes in view (id, type, x, y, w, h, text?)
     - `clusters?`: optional off-screen clusters (later)
     - `screenshot?`: optional JPEG data URL of the agent’s view

2) Action tools (hands)
   - Minimal, reliable set:
     - `wb_create({ shape })`
     - `wb_update({ update })`
     - `wb_move({ shapeId, x, y })`
     - `wb_label({ shapeId, text })`
     - `wb_delete({ shapeId })`
     - `wb_set_view({ x, y, w, h })`
   - Each tool sanitizes inputs, removes offset, applies via editor, returns a short confirmation.

Cross-cutting helpers:
- `sessionOrigin` (captured at Start) and `applyOffset*/removeOffset*` utilities.
- `SimpleShape` schema + converters to/from tldraw shapes.
- `ensureShapeIdExists/IsUnique`, `roundShape/roundProperty`, and a local `shapeIdMap`.

Model instructions:
- Require the model to call `whiteboard_context` at the start of a task and after edits.
- Prefer small, atomic actions.
- Use the provided schemas and return concise tool calls.

---

## 4) Implementation steps (MVP, 1–2 days)

### Step A — Add session origin and helpers

Add a small helper module (can start inline and refactor later):

Functions:
- `captureSessionOrigin(editor)`: returns `{ x, y }` (top-left of current viewport bounds) and stores in `sessionOriginRef`.
- `applyOffsetToVec(vec) / removeOffsetFromVec(vec)`: add/subtract `sessionOriginRef`.
- `applyOffsetToBox(box) / removeOffsetFromBox(box)`.
- `applyOffsetToShape(simpleShape) / removeOffsetFromShape(simpleShape)`.
- `roundNumber(keyed)`, `roundShape(simpleShape)` and reverse `unround*` if needed later.
- `ensureShapeIdExists(id)` and `ensureShapeIdIsUnique(id)` using `editor.getShape` and a `shapeIdMap`.

Data kept in refs:
- `sessionOriginRef`: `{ x, y }` captured on Start.
- `agentViewBoundsRef`: `{ x, y, w, h }` last “camera” requested by the model.
- `shapeIdMapRef`: `Map<string,string>` for id transforms.

### Step B — Define SimpleShape schema (JSON contract)

Start minimal to reduce LLM complexity:

```
type SimpleShape =
  | { _type: 'geo'; shapeId: string; x: number; y: number; w: number; h: number; geo?: 'rectangle'|'ellipse'|'triangle'; color?: string; fill?: 'none'|'semi'|'solid'; note?: string; }
  | { _type: 'text'; shapeId: string; x: number; y: number; w?: number; h?: number; text: string; color?: string; size?: 's'|'m'|'l'; note?: string; }
  | { _type: 'line'; shapeId: string; x1: number; y1: number; x2: number; y2: number; color?: string; dash?: 'draw'|'solid'|'dashed'; note?: string; }
  | { _type: 'arrow'; shapeId: string; x1: number; y1: number; x2: number; y2: number; fromId?: string; toId?: string; color?: string; note?: string; };
```

Notes:
- IDs are bare (no `shape:` prefix); add/remove prefix only when calling editor APIs.
- Keep properties short and lexicographically sorted where possible (LLMs behave better).

### Step C — Converters (tldraw ↔ SimpleShape)

Implement two helpers:
- `convertTldrawShapeToSimpleShape(editor, shape): SimpleShape`
- `convertSimpleShapeToTldrawShape(editor, simple, { defaultShape }): { shape: TLShape; bindings?: TLBindingCreate[] }`

Guidance:
- For `geo`: map bounds to `{ x, y, w, h }`; set defaults for color/fill.
- For `text`: read/update `richText`/`text`; keep `{ x, y }` and optional `w/h`.
- For `line/arrow`: use endpoints in page space; for arrows, optionally create/update bindings if `fromId/toId` exist.
- Provide simple defaults (like the starter’s `SHAPE_DEFAULTS`) so create/update works with partial data.

### Step D — Context tool: `whiteboard_context`

Signature:
```
whiteboard_context({ includeScreenshot?: boolean }): {
  bounds: { x,y,w,h },
  shapes: Array<{ shapeId, type, x, y, w, h, text? }>,
  screenshot?: string
}
```

Behavior:
- Determine `viewBounds`:
  1) If `agentViewBoundsRef` set → use it.
  2) Else use `editor.getViewportPageBounds()`.
- Compute “blurry” shapes: all shapes whose (masked) bounds are inside `viewBounds`; return `{ shapeId, type, x, y, w, h, text? }`.
- Optional `screenshot`: use `editor.toImage(shapesInView, { format: 'jpeg', bounds: viewBounds })` and convert blob to data URL.
- Apply `applyOffsetToBox`/`applyOffsetToVec` before returning (so the model sees normalized numbers).
- Throttle screenshot usage; default `includeScreenshot=false` in instructions to reduce cost.

### Step E — Action tools (execute bodies)

Common validation:
- Parse/validate numbers; reject if missing.
- Map `shapeId` with `ensureShapeIdExists`; if not found, return a short error.
- For create/update with IDs, call `ensureShapeIdIsUnique` when necessary and record in `shapeIdMapRef`.
- Remove offset from incoming coordinates (`removeOffsetFrom*`) before applying.

Tools:
1) `wb_create({ shape: SimpleShape })`
   - `shape = removeOffsetFromShape(shape)`
   - Convert via `convertSimpleShapeToTldrawShape` with defaults; `editor.createShape(result.shape)`; apply `bindings` if any.
   - Return `{ ok: true, shapeId }`.

2) `wb_update({ update: SimpleShape })`
   - Ensure `update.shapeId` exists; `update = removeOffsetFromShape(update)`.
   - Convert to editor shape using current as `defaultShape` (look up by id); `editor.updateShape`.
   - Rebuild arrow bindings if needed.

3) `wb_move({ shapeId, x, y })`
   - Ensure id exists; `({ x, y }) = removeOffsetFromVec({ x, y })`.
   - Compute origin delta like the starter (preserve shape-local origin vs bounds):
     - `bb = editor.getShapePageBounds(shape)`; `newPos = { x: x + (shape.x - bb.minX), y: y + (shape.y - bb.minY) }`.
   - `editor.updateShape({ id, type: shape.type, x: newPos.x, y: newPos.y })`.

4) `wb_label({ shapeId, text })`
   - Ensure id exists; set `richText/text` for `text` or `geo` shapes.

5) `wb_delete({ shapeId })`
   - Ensure id exists; `editor.deleteShape(id)`.

6) `wb_set_view({ x, y, w, h })`
   - Remove offset; store in `agentViewBoundsRef` and call `editor.zoomToBounds(bounds, { animation: { duration: 200 } })`.

Return values:
- Keep small (strings or tiny JSON), e.g. `{ ok: true }` with key data.

### Step F — Model instructions (update when starting the agent)

Add a short instruction block:
- “At the start of any canvas‑related task, call `whiteboard_context({ includeScreenshot:false })` to fetch bounds and shapes. Prefer small, atomic actions (create → move → label). After each edit, call `whiteboard_context` again to verify and plan next. Coordinates you receive are offset; always send coordinates back using the same offset. Use only the provided tools for canvas changes.”

Optional: include a one‑line reminder to avoid large batch updates.

### Step G — Wire into `page.tsx`

On Start (`startAgent`):
1) Capture `sessionOriginRef.current` from `editor.getViewportPageBounds().{ x, y }`.
2) Initialize `agentViewBoundsRef.current = editor.getViewportPageBounds()`.
3) Initialize `shapeIdMapRef.current = new Map()`.
4) Register tools: `whiteboard_context`, `wb_create`, `wb_update`, `wb_move`, `wb_label`, `wb_delete`, `wb_set_view`.
5) Extend `instructions` string with the guidance above.

Keep existing Python tools; they’re independent.

---

## 5) Testing scenarios

Run locally and try these prompts (voice or text):
1) “Draw a rectangle near the top-left and label it ‘A’.”
   - Expect: context fetch → create geo → label → verify context.
2) “Move the rectangle 100px to the right.”
   - Expect: context fetch → move with correct offset; no jumps.
3) “Delete the labeled rectangle.”
   - Expect: id resolution and deletion without errors.
4) “Add two boxes and align them vertically.” (later, after advanced actions)

Debugging tips:
- Log all tool calls/returns via `appendLog`.
- If an id is missing, log the full context right before failing.
- Temporarily disable screenshot if bandwidth is high or results look slow.

---

## 6) Rollout checklist

- [ ] `sessionOriginRef`, `agentViewBoundsRef`, `shapeIdMapRef` added and initialized
- [ ] Helpers implemented: offsets, rounding, id checks, converters
- [ ] Tools implemented: context + minimal actions
- [ ] Instructions updated (tool‑first, small steps)
- [ ] Manual tests pass for create/move/label/delete/set_view
- [ ] Logs show predictable sequences: context → action → context

---

## 7) Next iterations (post‑MVP)

Advanced actions:
- `wb_align`, `wb_distribute`, `wb_stack`, `wb_resize`, `wb_rotate`, `wb_bring_to_front`, `wb_send_to_back`, `wb_pen`.

Enhancements:
- Add `includeScreenshot:true` on demand.
- Add acceptance/reject diffs and a small side panel (mirroring the starter’s diff viewer).
- Persist sessions (Convex) if we move beyond demo.
- Custom shape for Python windows if we want the agent to place/manage them as canvas nodes.

---

## 8) Task breakdown (assignable units)

1) Helpers & refs (offsets, ids, rounding) — 0.5–1 day
   - Done when: refs captured; helpers unit‑tested with a few coordinates.

2) SimpleShape schema + converters — 0.5–1 day
   - Done when: tldraw↔simple for `geo|text|line|arrow` round‑trips simple cases.

3) Context tool — 0.5 day
   - Done when: `whiteboard_context` returns bounds + blurry shapes; optional screenshot behind a flag.

4) Minimal actions — 0.5–1 day
   - Done when: create/update/move/label/delete/set_view work reliably.

5) Instructions & testing — 0.5 day
   - Done when: scripted scenarios work and logs show the expected sequence.

Risks/notes:
- Keep tool payloads tiny and strictly typed to reduce LLM variance.
- Prefer several small calls to one large one.
- If IDs drift, audit `shapeIdMapRef` usage and ensure existence checks precede edits.

---

## 9) Appendix

### A) Minimal tool signatures

```
whiteboard_context: ({ includeScreenshot?: boolean }) => {
  bounds: { x: number; y: number; w: number; h: number },
  shapes: Array<{ shapeId: string; type: string; x: number; y: number; w: number; h: number; text?: string }>,
  screenshot?: string
}

wb_create: ({ shape: SimpleShape }) => { ok: boolean; shapeId: string }
wb_update: ({ update: SimpleShape }) => { ok: boolean }
wb_move: ({ shapeId: string; x: number; y: number }) => { ok: boolean }
wb_label: ({ shapeId: string; text: string }) => { ok: boolean }
wb_delete: ({ shapeId: string }) => { ok: boolean }
wb_set_view: ({ x: number; y: number; w: number; h: number }) => { ok: boolean }
```

### B) Error format (keep it simple)

```
{ ok: false, error: 'message' }
```

### C) References in `/agent` worth emulating

- Offsets/rounding/id checks: `agent/shared/AgentHelpers.ts`
- Action validation and application: `agent/shared/actions/*` (e.g., Move, Create, Update)
- Context building: `agent/shared/parts/*` (Screenshot, ViewportBounds, BlurryShapes)












### Goal
Make the voice agent drive the whiteboard using the same action system, prompt parts, and streaming loop as the tldraw Agent Starter. Add robust session persistence (chat, todos, context, canvas) so stopping/starting voice keeps state, and support multiple sessions.

### Where you are now
- `app/test-app/page.tsx`: A browser-only OpenAI Realtime voice demo with ad‑hoc tools calling `editorRef.current` directly.
- `agent/`: Full tldraw Agent Starter (prompt parts, `AgentActionUtil`s, SSE `/stream` flow).
- `convex/http.ts` + `convex/realtime.ts`: Ephemeral token minting for OpenAI Realtime.

### Target architecture (aligned with tldraw agent)
- Frontend:
  - Render `Tldraw` with `useTldrawAgent` and route user voice transcripts to `agent.prompt(...)` instead of directly mutating the editor.
  - Continue audio I/O with OpenAI Realtime but treat it as transport for mic/TTS, not as the canvas controller.
  - The canvas controller is always the `TldrawAgent` via the existing `AGENT_ACTION_UTILS` and `/stream` SSE.
- Backend:
  - Provide `/stream` endpoint that turns model output into `Streaming<AgentAction>` SSE lines (reuse `agent/worker` DO or add a Next/Edge route).
  - Continue `GET /realtime/token` for voice transport.
- Persistence (Convex):
  - Store agent “atoms” (chat history, todos, context items, model name, chat origin) and canvas snapshots per `sessionId`.
  - On stop/start, rehydrate the agent and canvas by `sessionId`. Support multiple sessions and switching.

### Phased plan

#### Phase 1 — Wire the agent into the voice page (keep voice; move edits to the agent)
- Replace direct `editorRef.current.createShape(...)` calls with the agent pipeline:
  - On ASR transcript (end-of-utterance), call:
    - `agent.prompt({ message: transcript, bounds: editor.getViewportPageBounds(), selectedShapes: [...], contextItems: [...] })`
  - Keep the tldraw chat/todo/history UI optional for now; the agent still builds prompt parts and emits streamed actions.
- Ensure the `/stream` endpoint exists where `agent/client/agent/TldrawAgent.ts` expects it:
  - EITHER deploy the existing Cloudflare Worker in `agent/worker` and proxy `/stream` from Next to it
  - OR add a Next/Edge route that uses the same “buildSystemPrompt + buildMessages + JSON streaming→SSE” flow.
- Keep OpenAI Realtime for mic/TTS only: do not let Realtime tools mutate the editor; they should produce speech only. The real canvas changes come from the agent’s streamed actions.

Deliverables:
- Voice start/stop still works; transcripts go to `agent.prompt`.
- Streaming actions modify the canvas via existing `AgentActionUtil`s.
- `/stream` returns SSE `data: { ...AgentAction, complete, time }`.

#### Phase 2 — Improve whiteboard intent capture and fidelity
- Feed better context into prompts (the agent already supports these):
  - Always pass `bounds` from the agent’s current view (use `editor.getViewportPageBounds()`).
  - Include `selectedShapes` and any user–picked context items from the panel/tools.
  - Keep the screenshot prompt part enabled.
- Tweak the system prompt:
  - Add short voice-first guidance in `SystemPromptPartUtil` to prefer small atomic actions (create→move→label).
- Add any missing actions you need (e.g., a “group” or “window” action) by creating new `AgentActionUtil`s and adding to `AGENT_ACTION_UTILS`.

Deliverables:
- Noticeably better control and fewer model mistakes (thanks to richer prompt parts and sanitization in utils).

#### Phase 3 — Optional: Server bridge for “full Realtime” parity
- If you want the voice model to directly stream actions (tool calls → actions) while speaking:
  - Build a Realtime WebSocket → SSE bridge (server-side), mapping Realtime tool calls to `AgentAction` objects and writing them to `/stream`.
  - This mirrors the Appendix C approach in `tldraw.md`.
- Otherwise, keep the simpler pattern: voice handles ASR/TTS; the agent handles reasoning/actions via `/stream`.

Deliverables:
- (Optional) Single source of truth for streamed actions is still `/stream`, now powered by the Realtime bridge.

#### Phase 4 — Persistence model (Convex)
Add to `convex/schema.ts`:
- `sessions`: { title, userId?, lastActiveAt }
- `agent_atoms`: { sessionId, chatHistoryJson, todoItemsJson, contextItemsJson, modelName, chatOrigin, updatedAt } index by `sessionId`
- `canvas_snapshots`: { sessionId, rev, docJson, createdAt } index by `by_session_and_rev` (latest rev per session)
- `transcripts` (optional): { sessionId, who: 'user'|'agent', text, ts }
- Use Convex validators (`v.object`, `v.record`, `v.id('sessions')`, etc.) per convex_rules.

Functions (new syntax, with validators):
- Mutations:
  - `createSession({ title? }) → { sessionId }`
  - `saveAgentAtoms({ sessionId, atoms })`
  - `saveCanvasSnapshot({ sessionId, rev, docJson })`
  - `appendTranscript({ sessionId, who, text, ts })`
  - `touchSession({ sessionId })`
- Queries:
  - `loadSession({ sessionId }) → { atoms, latestDoc, transcripts? }`
  - `listSessions({ userId? })`
- Actions:
  - Keep `realtime.mintClientSecret` as is; optionally accept `sessionId` for analytics.

Client rehydrate/save hooks:
- On agent creation in the page, after `useTldrawAgent`:
  - Load atoms from Convex and set: `$chatHistory`, `$todoList`, `$contextItems`, `$modelName`, `$chatOrigin`.
  - Load the latest canvas snapshot and apply to editor store.
- Add a debounced saver:
  - When atoms change (same spot we save to localStorage today), also call `saveAgentAtoms`.
  - Periodically/save-on-accept to `saveCanvasSnapshot` with a monotonically increasing `rev`.

Deliverables:
- Stop/start the voice agent with the same `sessionId` and resume exactly where you left off (chat/todos/context/canvas).

#### Phase 5 — Session lifecycle & UX
- Introduce a `sessionId` throughout:
  - In `test-app` add a simple session picker (list/create; default to last active).
  - On “New session,” call `createSession`, clear in-memory agent and canvas, and set the new id.
  - On “Stop,” only disconnect voice transport; don’t reset the agent. The persisted session keeps state.
  - On “Resume,” reconnect voice with the same `sessionId`, restore atoms and canvas, and continue.
- For the production app:
  - Move the session UI into your real pages (`app/…`) and make it auth‑aware (store by user).

Deliverables:
- Multiple sessions supported; easy resume; no accidental context loss.

#### Phase 6 — Production hardening
- Add acceptance gates:
  - Speak only finalized `MessageActionUtil` content; avoid reading half-formed thoughts.
- Rate-limit and batch Convex writes; snapshot canvas on “Accept” or every N seconds.
- Add telemetry hooks and error banners for `/stream` disconnects.
- Security: gate `/realtime/token` by auth if desired; lock down CORS in `convex/http.ts`.

### Data flow (final shape)
- Voice mic → OpenAI Realtime (ASR/TTS) → transcript events
- Transcript → `agent.prompt(...)`
- Agent builds prompt parts (messages, screenshot, shape context, history…) → backend `/stream`
- `/stream` returns streamed `AgentAction` JSON → `agent.act(...)` applies diffs to canvas
- UI shows actions, diffs, todos; voice may speak concise summaries
- Convex persists atoms + canvas snapshots by `sessionId`

### Minimal API inventory (Convex)
- Queries: `loadSession`, `listSessions`
- Mutations: `createSession`, `saveAgentAtoms`, `saveCanvasSnapshot`, `appendTranscript`, `touchSession`
- Action: `realtime.mintClientSecret` (existing)
- Keep to new Convex function syntax with validators and `returns:`.

### Migration path from `test-app` to the real app
- Start by integrating `useTldrawAgent` and `/stream` into `app/test-app/page.tsx`.
- Add `sessionId` state and Convex persistence there first.
- Once stable, move the same component patterns into your real pages under `app/`.
- Reuse the same persistence APIs; only the routing/UX changes.

### Open choices (recommendations)
- Voice control model: Keep ASR/TTS in Realtime, reasoning in standard LLM via `/stream`. It’s simpler and gives you the mature tldraw action system now.
- Canvas persistence: snapshot on accept or every ~10s + before unload; store only latest rev per session unless you need history.

- If you later want Realtime to also drive actions directly: add the server bridge (tool→action→SSE) without changing the frontend agent.

- Ensure you always pass `bounds`, `selectedShapes`, and curated `contextItems` to `agent.prompt` for best control.

- Persist agent atoms server-side and restore them on mount for seamless resumes.

- Use `sessionId` everywhere (voice, agent, persistence) so start/stop cycles return to the same context.