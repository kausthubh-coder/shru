## App Overview

ShruAI is a realtime AI tutor that combines a TLDraw whiteboard with an AI voice agent. Users sign in, open a dashboard to create or resume sessions. Each session opens a canvas with draggable/resizable custom "windows" on the right (initial window kinds: Python IDE, Desmos). The left panel hosts the voice agent. The agent can control windows and the board via function calls. All state is persisted to Convex. Single-user only (no collaboration).

## Tech Stack

- Frontend: Next.js (App Router), TypeScript, Clerk for auth, Tailwind
- Whiteboard: TLDraw (exploded editor to register custom shapes)
- Embeds:
  - Python IDE: Monaco Editor + Pyodide (in a Web Worker)
  - Desmos: iframe first, optional Desmos API for programmatic control
- AI Voice: OpenAI Realtime models via Agents SDK for TypeScript (WebRTC in browser); optional server sideband via WebSocket
- Backend: Convex (queries, mutations, actions, and an httpAction endpoint for ephemeral tokens)
- Persistence: Convex DB tables + Convex storage for large snapshots/exports

## User Flows

### Auth
- Users sign in/up with Clerk.
- Auth guards for `/app` and `/app/[sessionId]`.

### Dashboard (`/app`)
- Lists sessions: title, updatedAt.
- Actions: New session, resume session, rename, delete.

### Session (`/app/[sessionId]`)
- Left Panel (Voice Agent): mic toggle, connection status, last few transcript turns, controls (start/stop, choose voice).
- Center (TLDraw): canvas with tools; supports selection, drag, resize, rotate.
- Right Dock (Windows): list of active windows (Python, Desmos) with add buttons.
- Top bar: session title, save state indicator, end session.

## TLDraw Whiteboard & Modular Windows

### Window Abstraction
- Single custom TLDraw shape type: `WindowShape`.
- Purpose: a resizable/movable container with window chrome (title, controls) and a pluggable content renderer determined by `kind`.
- Shape props (stable):
  - `kind`: 'python' | 'desmos' (extensible later)
  - `title`: string
  - `layout`: { x, y, w, h, rotation }
  - `stateVersion`: number (to help reconcile UI with persisted state)
  - `data`: `WindowData` (see below)

### WindowData (per kind)
- `python`:
  - `code`: string
  - `outputs`: Array<{ type: 'stdout'|'stderr', text: string, ts: number }>
  - `runner`: { runtime: 'pyodide', status: 'idle'|'running'|'error', lastRunTs?: number }
- `desmos`:
  - `expressions`: object (Desmos expressions JSON)
  - `camera`: { center?: { x: number, y: number }, zoom?: number }
  - `version`: number

### Content Renderers
- Python: Monaco editor + Run button; executes via Pyodide in a Web Worker; append outputs; lazy-load heavy assets.
- Desmos: iframe to calculator (fast path); optional Desmos API integration; mirror state to `WindowData`.

### Persistence
- Save the TLDraw document as JSON (single-user):
  - MVP: full snapshot writes on a throttle (500–1000ms) or blur; periodic snapshot to storage when large.
  - Optional later: append-only `board_revisions` with op/diff; periodic full snapshot for recovery.
- `windows` table stores per-window `WindowData` keyed by `shapeId` for fast random access without scanning full board JSON.

### Collaboration
- Not in scope: single-user only. No presence, no multiuser sync.

## OpenAI Realtime Voice Agent

### Connection (WebRTC in Browser)
- Use the Agents SDK for TypeScript to create a `RealtimeAgent` and `RealtimeSession`.
- Client requests a short-lived ephemeral key from our Convex HTTP endpoint and connects via WebRTC.
- Configure voice, VAD, output modalities (audio and text). Show connection status in the UI.

### Ephemeral Token Endpoint (Convex)
- Add an HTTP endpoint in `convex/http.ts` using `httpRouter()` and `httpAction`.
- Path: `/api/realtime/token`
- Behavior: server-side fetch to `POST https://api.openai.com/v1/realtime/client_secrets` using our standard API key (stored in Convex environment). Pass session config (model `gpt-realtime`, voice, etc.). Return the `client_secret.value` to the browser.
- Security: authenticate the caller (Clerk session) before minting; rate limit per user/session; never expose the standard API key to the browser.

### Session Lifecycle & History
- Upon connect, restore a concise conversation history (last N turns) so the agent has context.
- For long sessions (max ~30 minutes per Realtime session), handle seamless reconnect and token refresh.

### Function-call timing and narration
- Goal: the agent narrates while acting. Use Realtime out-of-band responses and short function_call_output items to keep speech flowing during tool execution (see @usage-realtime-models.md and @managing-converstsaions.md).
- Preambles: before tool calls, the agent says a brief line (e.g., “I’m adding a Python pad now”), then we execute the tool and stream status back for narration.
- Long tasks (python_run): stream partial outputs/status to keep the conversation alive; avoid blocking.

### Tool Calling (function calls)
- Scope: only Python and Desmos windows for now. The API is modular to add new kinds later.
- Tools the agent may call (client mediates):
  - Windows (board-level):
    - `create_window(kind: 'python'|'desmos', title?: string, data?: Partial<WindowData>) → { shapeId }`
    - `move_window(shapeId, x, y)`
    - `resize_window(shapeId, w, h)`
    - `rename_window(shapeId, title)`
    - `delete_window(shapeId)`
  - Python:
    - `python_run(shapeId, code, input?) → { stdout, stderr, durationMs }` (updates window outputs)
    - `python_set_code(shapeId, code)`
  - Desmos:
    - `desmos_set_state(shapeId, expressions)`
    - `desmos_set_camera(shapeId, camera)`
- Validation & guardrails: enforce kind-specific schemas, shape ownership, size limits; confirm destructive actions.
- Flow: function_call → client executes → persist to Convex → emit function_call_output → agent narrates.

### Context awareness and focus cues
- Capture: active selection (shape/window ids), cursor position, viewport/camera, recent edits.
- Provide: send short textual summaries as conversation inputs; optionally add user-triggered screenshots later (see image input in @article.md and @usage-realtime-models.md).
- Targeting: default tool targets to focused window/selection; ask confirmation on ambiguity.

### Sideband Server Control (Optional)
- Read `Location` header from SDP response to get `call_id`, attach a server WebSocket to supervise the same call: adjust tools, monitor events, add guardrails.

## Convex Backend Design (single-user)

### Tables
- `users`: { clerkId, name, avatarUrl, createdAt }
- `sessions`: { ownerId, boardId, title, status: 'active'|'archived', settings: { voice, vad }, lastActiveAt }
  - Indexes: by_owner (`ownerId`), by_board (`boardId`)
- `boards`: { currentRevision, schemaVersion, smallSnapshot }
  - Indexes: none (via `_id`)
- `board_revisions` (optional later): { boardId, rev, authorId, kind: 'snapshot'|'ops', data, size, createdAt }
  - Indexes: by_board_and_rev (`boardId`, `rev`)
- `windows`: { boardId, shapeId, kind: 'python'|'desmos', title, data: WindowData, layout: { x, y, w, h, rotation }, stateVersion }
  - Indexes: by_board (`boardId`), by_board_and_shape (`boardId`, `shapeId`)
- `transcripts`: { sessionId, role: 'user'|'assistant', text, timing, partial: boolean, metadata }
  - Indexes: by_session (`sessionId`)
- `assets` (optional): stored in Convex storage, referenced by IDs from revisions when snapshots exceed value limits.

### Functions (API Surface)
- Sessions: `createSession`, `listSessions`, `getSession`, `archiveSession`, `touchSession`
- Boards: `getBoard`, `saveBoardSnapshot(payload)`, `snapshotBoard`
- Windows: `createWindow`, `updateWindowLayout`, `updateWindowData`, `renameWindow`, `deleteWindow`
- Transcripts: `appendTranscript`, `listTranscripts(sessionId, since)`
- HTTP endpoint: `/api/realtime/token` (httpAction) mints ephemeral key; checks auth and rate limits
- Internal actions (optional): export/import boards, maintenance, migrations

### Transport and sideband control
- Client: WebRTC for low-latency audio and data channel (see @webrtc.md, @overview.md).
- Server sideband (optional): attach via call_id from Location header to supervise the same session, adjust tools/policies, and log events (see @Webhooks_and_server-side_controls.md).

### Permissions
- Only owner and shared members can read/write a session and its board/windows.
- Enforce in all mutations; read filters by membership. Rate limit sensitive operations.

## State Management & Persistence

- Whiteboard: TLDraw JSON snapshots (MVP); optional ops-based history later.
- Windows: `WindowData` per row; also duplicated in TLDraw shape props for instant render.
- Voice Agent: last N turns in `transcripts` (text only by default); no audio storage.
- Session settings: voice, VAD in `sessions.settings`.

## Security & Compliance

- Secrets: Standard OpenAI key only on server; ephemeral tokens only to clients.
- CSP & sandbox: strict `frame-src` allowlist; sandbox attrs for iframes (Desmos + approved domains).
- Python sandbox: time/memory limits in worker; disable network & FS; size caps on outputs.
- Validation: strict schemas for tool args; throttling.

## Performance

- Lazy load heavy assets (Pyodide, Monaco) on demand; prefetch on idle.
- Throttled board saves; coalesce changes; snapshots to storage for large boards.
- WebRTC for low-latency audio; handle reconnects; device selection.

## Milestones (Single-user)

- M0: Dashboard + session route; TLDraw base; window abstraction; Desmos window; manual snapshot save.
- M1: Realtime voice (Agents SDK); ephemeral token endpoint; tool call plumbing (create/move/resize/rename/delete window).
- M2: Python window (Monaco + Pyodide in worker); `python_run` updates outputs; transcripts persistence.
- M3: Refine Desmos API control; board snapshots to storage; basic analytics and error UX.

## Open Questions (updated)
- What confirmation rules do we want before destructive ops? Voice-only or UI confirm?
- Do we want screenshots as context, and under what consent/size limits?
- Target latency for narration+tool overlap; what max delay is acceptable before we inject a “working…” line?



