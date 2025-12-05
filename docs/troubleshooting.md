# Troubleshooting

## Token fetch fails (401/403/500)

- Ensure `OPENAI_API_KEY` is set in Convex.
- `CONVEX_SITE_URL` / `NEXT_PUBLIC_CONVEX_URL` should point to your Convex deployment (site URL).
- If auth is enabled in `convex/http.ts`, sign in first and confirm Convex sees identity.
- Proxy path: `/api/realtime/token` (Next) → Convex `/realtime/token`; check both network calls.

## CORS errors on `/realtime/token`

- Set `CLIENT_ORIGIN` in Convex env vars to your Next.js origin (e.g., `http://localhost:3000`).
- Preflight `OPTIONS` is routed; confirm request headers match allowed list.

## No audio or microphone issues

- Grant microphone permission and refresh.
- If audio output is silent, click the page after Start (autoplay policies).
- Check console for WebRTC or audio context errors; switch devices in the agent panel.

## Agent isn’t acting on the board/IDE/notes

- Open Logs / Calls / Context from the voice agent panel.
- Ensure visible shapes exist; some tools need ids/selection.
- Use `agent_get_view_context` or `agent_send_view_image` to re-sync context.
- Confirm auto-context JSON + image are updating (Context overlay timestamps).

## tldraw validation errors (Unexpected property/value)

- `geo` values are normalized; unsupported names fall back to allowed list.
- Geo shapes: no inline labels; use separate text shapes (`agent_label` creates one).
- Text shapes must use `props.richText`; do not set `props.text` / `props.label`.
- Check DevTools for `[tldraw:createShape]` and `[geo:coerce]` logs.

## Language drift or unrelated responses

- First response is gated until `session.update` completes; verify log order.
- Language guard re-asserts prompt if non-ASCII spikes; see transcript deltas in logs.

## Context/response race conditions

- Combined sender dedups (~300ms) and debounces (~120ms) before `response.create`.
- Keep Context overlay open to confirm timestamps; if needed, trigger `agent_send_view_image`.

## Pyodide errors

- Pyodide loads from `https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js`; check network.
- Run only executes when language is Python; otherwise returns an info message.
- If Monaco glitches, toggle Output panel or switch tabs to force layout.

## TypeScript or lint errors

- Run `npm run lint` and inspect paths in the output.

## Next.js dev 500 after refactors (Module not found)

- Verify relative imports after moving files (e.g., `components/session/...`).
- Restart `npm run dev` if resolver cached stale paths.
- Follow the first import trace in the overlay.

## YAML paste errors in Notes

- Symptom: “end of the stream or a document separator is expected”.
- Fix: remove code fences/headings; keep a single YAML doc with `title`, `version`, optional `metadata`, `blocks`.
- For tools, pass a single block (no leading `-`) to `notes_append_block_yaml`.

## Voice sounds weird/robotic

- Re-assert defaults after connect:

```ts
session.transport?.sendEvent?.({
  type: 'session.update',
  session: {
    type: 'realtime',
    model: 'gpt-realtime',
    output_modalities: ['audio'],
    audio: {
      input: { format: { type: 'audio/pcm', rate: 24000 }, turn_detection: { type: 'semantic_vad', eagerness: 'medium', create_response: false, interrupt_response: false } },
      output: { format: { type: 'audio/pcm' }, voice: 'marin' },
    },
  },
});
```

- Also check: playbackRate = 1.0; output device set to default; Stop → Start to reset session.
