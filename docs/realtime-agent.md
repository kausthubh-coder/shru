# Realtime Agent (OpenAI)

This page explains how the test app uses OpenAI's Realtime API to run a voice-based tutor that can observe the whiteboard and act via tools.

## Token minting (server)

- Endpoint: `GET /realtime/token` implemented in `convex/http.ts`.
- The handler calls `internal.realtime.mintClientSecret` (in `convex/realtime.ts`), which POSTs to `https://api.openai.com/v1/realtime/client_secrets` using `OPENAI_API_KEY`.
- Returns `{ value: "ek_..." }` as a short-lived client secret.
- CORS: `convex/http.ts` exposes `OPTIONS` preflight and allows `CLIENT_ORIGIN` (or `*` by default in dev).

## Client session setup

`app/test-app/page.tsx` contains the prototype. Core session wiring is extracted into `app/test-app/agent/session.ts` and tool bridges into `app/test-app/agent/runtime.ts`. The critical flow when the user clicks Start (with UI handled by `AIVoiceAgentPanel`):

1. Fetches the client secret from `/realtime/token` (base URL from `NEXT_PUBLIC_CONVEX_SITE_URL`).
2. Uses `createRealtimeSessionHandle()` to grab microphone stream and build a `OpenAIRealtimeWebRTC` transport.
3. Connects a `RealtimeSession` with the secret via the session handle.
4. Sends a `session.update` to configure model (`gpt-realtime`), audio IO, and persona‑based tutor instructions.
5. Gates first response until the session is updated (avoids early-turn drift).
6. Streams auto-context: a compact `view_context` JSON plus a viewport-bounded JPEG snapshot.

- The instructions string is built in `app/test-app/prompts/tutor.ts` (persona variants) and sent via `session.update`. The legacy `app/test-app/lib/realtimeInstructions.ts` remains for a single‑prompt variant.
 - The auto‑context JSON and screenshot are produced by `app/test-app/lib/viewContext.ts`. A combined sender in `app/test-app/services/context/index.ts` posts both in one message with dedup/throttle; on failure it falls back to the legacy `app/test-app/services/autoContext.ts` two‑message flow.

### Hallucinations and unrelated actions
- Keep auto-context compact and accurate; verify `view_context` JSON and screenshots match the current viewport.
- Limit tool call budget per turn; add concise preambles; re-assert instructions when drift detected.
- Add telemetry for tool start/done/error and detect off-topic calls to trigger a prompt re-assert via `session.update`.
  - Unified logs: Console and in‑app Logs capture `[tool:start|done|error]` with rid and timings. Action mapping logs show `[act:start|map|done|error]` and the final `editor.createShape` payload for debugging.

### Initialization gating

- After connecting, the client injects the operating prompt via `session.update` and sets a `sessionReady` flag. Auto‑context + `response.create` won’t run until sessionReady is true.
- You can also pass an initial session config on construction to reduce races:

```ts
const session = new RealtimeSession(agent, {
  model: 'gpt-realtime',
  config: {
    inputAudioTranscription: { model: 'gpt-4o-mini-transcribe', language: 'en' },
  },
});
```

## Tools

The agent registers tools via a modular registry. Definitions live in `app/test-app/agent/tools/*` and are assembled in `app/test-app/agent/registry.ts`. Runtime bridges are built in `app/test-app/agent/runtime.ts` and shared logging wrappers live in `app/test-app/types/toolContracts.ts`.

### Destructive tool approvals
Some tools (e.g., `agent_clear`) are flagged for approval. The tool emits an approval request via the runtime event stream (`onToolEvent`). By default calls return `approval_required` unless approved; the page can present a confirmation UI (see `app/test-app/components/ToolApprovalDialog.tsx`) and re‑dispatch.

Whiteboard tools (selection):

- `agent_create_shape` / `agent_create` — create geo shapes (rectangles, ellipses, etc.). For tldraw v4.0.2, inline text on geo is disabled and unsupported `geo` names are normalized (e.g., `parallelogram → rhombus`, `circle → ellipse`, `square → rectangle`, fallback → `rectangle`).
- `agent_move`, `agent_resize`, `agent_rotate` — transform existing shapes
- `agent_label`, `agent_update` — change text/appearance
- `agent_align`, `agent_distribute`, `agent_stack`, `agent_place` — layout tools
- `agent_bring_to_front`, `agent_send_to_back` — z-order
- `agent_delete`, `agent_clear` — remove shapes / clear canvas

Camera + context:

- `agent_set_view` — move the viewport camera
- `agent_get_view_context` — returns summarized context JSON
- `agent_get_screenshot` — returns a data URL image
- `agent_send_view_image` — attaches an image to the conversation and triggers a response

IDE and Notes:

- `ide_create_file`, `ide_set_active`, `ide_update_content`, `ide_get_context`
- `notes_set_text`, `notes_append`
- `notes_set_yaml` — replace entire notes YAML after validation
- `notes_append_block_yaml` — append a single validated block (enforces id uniqueness)

Labeling note: `agent_label` creates a separate text shape near the target when inline geo text is unsupported (tldraw v4.0.2).

## Auto‑context strategy

Before most responses, the client:

- Sends a compact `view_context` JSON (bounds, blurry shapes, peripheral clusters, selected shapes)
- Captures and sends a screenshot of the viewport when available
- Uses a combined sender that deduplicates within a short window (skips no‑ops) and debounces before `response.create`

This enables OCR‑free reasoning about structure while using the image for visual grounding.

- Implementation details:
  - The combined sender posts both parts in a single `conversation.item.create` with a `content` array containing an `input_text` (JSON) and, when available, an `input_image` (data URL).
  - Debounce before `response.create`: 120ms (gives the data channel time to deliver context).
  - Dedup window: 300ms (skips sending if both JSON and image are unchanged within the window).
  - Screenshot is only attached when at least one shape is visible in the viewport; otherwise it is omitted.

- Context helpers: `app/test-app/lib/viewContext.ts`
- Sender (preferred): `app/test-app/services/context/index.ts` (combined)
- Sender (legacy fallback): `app/test-app/services/autoContext.ts`

### Debug overlays

- “Show Context” displays the last `view_context` JSON and screenshot sent to the model.
- “Show Calls” displays structured tool start/done/error with rid, timings, and small payload previews.
- Use these to verify the model saw the correct viewport and actually called a tool before you suspect the prompt.

## Audio IO

- Input: microphone stream with a simple VAD to show "user speaking" state
- Output: audio element is analyzed to show "agent speaking" state

### Language guard
- The client monitors audio/text deltas and gently re‑asserts English‑only instructions if non‑ASCII content spikes. This is done via a lightweight `session.update` with the operating prompt.

### Audio/voice defaults and quick reset

For a natural, “normal” voice quality, use these defaults:

- Model: `gpt-realtime`
- Output modalities: `["audio"]`
- Input audio: `{ type: "audio/pcm", rate: 24000 }`
- Output audio: `{ type: "audio/pcm" }` (avoid `audio/pcmu` unless you want a telephony sound)
- Voice: `marin`

You can re-assert these at any time after the session connects:

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

- Require auth on `/realtime/token` and enforce per-user rate limits
- Store minimal audit logs of token mints and agent actions
- Consider keeping a summarized board state server-side for continuity
- Tune prompts and tool error handling for reliability


