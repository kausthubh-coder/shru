# Realtime Agent (OpenAI)

This page explains how the session workspace uses OpenAI's Realtime API to run a voice-based tutor that can observe the whiteboard and act via tools. The legacy `/test-app` prototype is deprecated.

**Related docs:**
- [Architecture Overview](architecture.md) — System architecture and data flow
- [Convex Backend](convex.md) — Token minting endpoint
- [IDE Tools](ide.md) — IDE tool details
- [Notes System](notes.md) — Notes/YAML tools

## Token minting (server)

- Primary path: `GET /api/realtime/token` (Next.js) → forwards to Convex `GET /realtime/token`.
- Convex handler (`convex/http.ts`) calls `internal.realtime.mintClientSecret` (`convex/realtime.ts`), which POSTs to `https://api.openai.com/v1/realtime/client_secrets` using `OPENAI_API_KEY`.
- Returns `{ value: "ek_..." }` as a short-lived client secret.
- CORS: `convex/http.ts` exposes `OPTIONS /realtime/token` and allows `CLIENT_ORIGIN` (or `*` in dev).

## Client session setup (SessionWorkspace)

`components/session/SessionWorkspace.tsx` owns the flow when the user clicks Connect (UI: `AIVoiceAgentPanel`):

1. Fetch the client secret from `/api/realtime/token` (uses `CONVEX_SITE_URL` or `NEXT_PUBLIC_CONVEX_URL` to reach Convex).
2. Use `createRealtimeSessionHandle()` to grab microphone stream and build an `OpenAIRealtimeWebRTC` transport.
3. Connect a `RealtimeSession` with the secret via the handle.
4. Send `session.update` to configure model (`gpt-realtime`), audio IO, and tutor instructions (`lib/prompts/tutor.ts`). Gate the first response until `session.updated` arrives.
5. Register tools from `components/session/agent/registry.ts` (definitions in `components/session/agent/tools/*`; runtime bridges in `components/session/agent/runtime.ts`).
6. Stream auto-context: unified `workspace_context` JSON (whiteboard + IDE + notes) plus a viewport JPEG via the combined sender (`components/session/services/context/index.ts`).

### Preventing drift

- Gate on `session.updated` before first response.
- Keep auto-context compact; verify JSON + screenshot match the viewport.
- Re-assert instructions if transcripts drift (language guard in `SessionWorkspace` monitors deltas).
- Telemetry: Logs + Calls overlays show `[tool:start|done|error]`, `[act:start|map|done|error]`, and payload previews.

## Tools

Tools are registered via the modular registry (`components/session/agent/registry.ts`) and wrapped with `createWrapExecute` for consistent logging and approval hooks.

### Destructive tool approvals
- `agent_clear` is approval-gated. It emits an approval request via `onToolEvent` and returns `approval_required` until UI confirms.

### Whiteboard tools (tldraw v4.0.2)
- Create: `agent_create_shape`, `agent_create`, `agent_create_text`, `agent_pen`
- Transform: `agent_move`, `agent_resize`, `agent_rotate`, `agent_update`
- Layout: `agent_align`, `agent_distribute`, `agent_stack`, `agent_place`
- Z-order: `agent_bring_to_front`, `agent_send_to_back`
- Context/camera: `agent_get_view_context`, `agent_get_screenshot`, `agent_capture_view_image`, `agent_send_view_image`, `agent_set_view`, `agent_get_text_context`
- Delete/clear: `agent_delete`, `agent_clear` (requires approval)
- Notes: `agent_label` creates a separate text shape near the target (geo labels are not inline)

### IDE tools
- `ide_create_file`, `ide_set_active`, `ide_update_content`
- `ide_apply_edits` (line/char), `ide_read_code`, `ide_get_context`
- `ide_run_active` (Python only; Pyodide)

### Notes tools
- `notes_set_text`, `notes_append`
- `notes_set_yaml`, `notes_append_block_yaml`
- `notes_read_file(name?)` — read a lesson YAML from IDE workspace without mutating state

### Shape/text notes
- Text shapes must use `props.richText`. Do not set `props.text` or `props.label` on `type = 'text'` shapes.
- Geo shapes avoid inline labels; `agent_label` creates a nearby text shape.

## Auto‑context strategy

Before most responses, the client:

- Sends unified `workspace_context` JSON:
  - Whiteboard: bounds, blurry shapes, peripheral clusters, selected shapes
  - IDE: name, language, full active buffer
  - Notes: full YAML document
- Captures a viewport JPEG when shapes are visible
- Uses combined sender (`services/context/index.ts`):
  - Dedup window: ~300ms (skip if unchanged)
  - Debounce: ~120ms before `response.create`
  - Content: single `conversation.item.create` with `input_text` (+ `input_image` when available)
- Fallback sender (`services/autoContext.ts`) sends text then image separately.

### Debug overlays

- “Show Context” displays the last JSON + screenshot.
- “Show Calls” shows tool events with rid/timing.
- Logs overlay shows transport, tool, and action mapping events.

## Audio IO

- Input: microphone stream + analyser for “user speaking” meter.
- Output: audio element analysed for “agent speaking” meter.

### Language guard
- Monitors audio/text deltas; re-asserts English-only instructions via `session.update` if non-ASCII spikes.

### Audio/voice defaults and quick reset

- Model: `gpt-realtime`
- Output modalities: `["audio"]`
- Input audio: `{ type: "audio/pcm", rate: 24000, turn_detection: { type: "semantic_vad", eagerness: "medium", create_response: false, interrupt_response: false } }`
- Output audio: `{ type: "audio/pcm" }, voice: "marin"`

You can re-assert after connect:

```ts
session.transport?.sendEvent?.({
  type: "session.update",
  session: {
    type: "realtime",
    model: "gpt-realtime",
    output_modalities: ["audio"],
    audio: {
      input: { format: { type: "audio/pcm", rate: 24000 }, turn_detection: { type: "semantic_vad", eagerness: "medium", create_response: false, interrupt_response: false } },
      output: { format: { type: "audio/pcm" }, voice: "marin" },
    },
  },
});
```

## Hardening & productionization

- Require auth + rate limits on `/realtime/token`.
- Persist minimal audit logs of token mints and agent actions.
- Add retry/backoff around auto-context sends.
- Consider collaborative sessions (multi-user) by expanding schema and access checks.
- Add analytics for tool latency and context sizes.


