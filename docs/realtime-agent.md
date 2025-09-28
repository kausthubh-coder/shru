# Realtime Agent (OpenAI)

This page explains how the test app uses OpenAI's Realtime API to run a voice-based tutor that can observe the whiteboard and act via tools.

## Token minting (server)

- Endpoint: `GET /realtime/token` implemented in `convex/http.ts`.
- The handler calls `internal.realtime.mintClientSecret` (in `convex/realtime.ts`), which POSTs to `https://api.openai.com/v1/realtime/client_secrets` using `OPENAI_API_KEY`.
- Returns `{ value: "ek_..." }` as a short-lived client secret.
- CORS: `convex/http.ts` exposes `OPTIONS` preflight and allows `CLIENT_ORIGIN` (or `*` by default in dev).

## Client session setup

`app/test-app/page.tsx` contains the prototype. The critical flow when the user clicks Start:

1. Fetches the client secret from `/realtime/token` (base URL from `NEXT_PUBLIC_CONVEX_SITE_URL`).
2. Grabs a microphone stream and builds a `OpenAIRealtimeWebRTC` transport.
3. Creates a `RealtimeAgent` and `RealtimeSession`, then connects with the secret.
4. Sends a `session.update` to configure model (`gpt-realtime`), audio IO, and the unified English‑only tutor instructions.
5. Gates first response until the session is updated (avoids early-turn drift).
6. Streams auto-context: a compact `view_context` JSON plus a viewport-bounded JPEG snapshot.

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

The agent registers many tools using `tool(...)` from `@openai/agents/realtime`. They wrap local operations and call into an in-page `TldrawAgent` via a `dispatchAction` bridge.

Whiteboard tools (selection):

- `agent_create_shape` / `agent_create` — create geo shapes (rectangles, ellipses, etc.)
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

Python windows:

- `create_python_window`, `python_set_code`, `python_run`

## Auto-context strategy

Before most responses, the client:

- Sends a compact `view_context` JSON (bounds, blurry shapes, peripheral clusters, selected shapes)
- Captures and sends a screenshot of the viewport when available

This enables OCR‑free reasoning about structure while using the image for visual grounding.

### Debug overlays

- “Show Context” displays the last `view_context` JSON and screenshot sent to the model.
- “Show Calls” displays structured tool start/done/error with rid, timings, and small payload previews.
- Use these to verify the model saw the correct viewport and actually called a tool before you suspect the prompt.

## Audio IO

- Input: microphone stream with a simple VAD to show "user speaking" state
- Output: audio element is analyzed to show "agent speaking" state

## Hardening & productionization

- Require auth on `/realtime/token` and enforce per-user rate limits
- Store minimal audit logs of token mints and agent actions
- Consider keeping a summarized board state server-side for continuity
- Tune prompts and tool error handling for reliability


