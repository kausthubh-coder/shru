# Troubleshooting

## Token fetch fails (401/403/500)

- Ensure `OPENAI_API_KEY` is set in the Convex dashboard.
- If you enabled auth checks in `convex/http.ts`, verify you are signed in and Convex can read identity.
- Confirm `NEXT_PUBLIC_CONVEX_SITE_URL` is the correct Convex Site URL.

## CORS errors on `/realtime/token`

- Set `CLIENT_ORIGIN` in Convex env vars to your Next.js origin (e.g. `http://localhost:3000`).
- Preflight `OPTIONS` is already routed; check browser console/network panel for details.

## No audio or microphone issues

- Grant microphone permission and refresh.
- If the audio output is silent, try clicking anywhere on the page after Start (autoplay policies).
- Check console logs for WebRTC or audio context errors.

## Agent isn’t acting on the board

- Open the Logs window to inspect events.
- Open “Show Calls” to see whether tools were actually invoked and with what arguments.
- Open “Show Context” to confirm the viewport JSON and screenshot are fresh and correct.
- Ensure there are visible shapes; some tools require existing selection/ids.
- Try `agent_get_view_context` or `agent_send_view_image` to re-sync context.

## tldraw validation errors (Unexpected property / value)

- If you see errors like `At shape(type = geo).props.geo: Expected ... got parallelogram`:
  - The installed version (v4.0.2) only allows certain `geo` values (e.g., rectangle, ellipse, triangle, rhombus, etc.). The app now normalizes unknown values to the nearest supported one (e.g., parallelogram → rhombus; fallback rectangle).
- If you see errors about `props.text` or `props.label` on `geo` shapes:
  - v4.0.2 doesn’t accept inline text for `geo`. The app disables inline labels for `geo` to prevent schema errors. Use a separate text shape if you need labels.
- Check DevTools console:
  - Look for `[tldraw:createShape]` to see the final payload. Look for `[geo:coerce] from=... → ...` to confirm normalization took place.

## Language drift or unrelated responses

- The app gates the first response until `session.update` (prompt/audio config) completes. If you see drift on the very first turn, check that `session.update` appears in logs before `response.create`.
- The session is created with `inputAudioTranscription.language = 'en'`. If your use-case requires multilingual input, remove or change this, but expect more variability.
- If you still experience drift, enable logs and review `response.output_audio_transcript.delta` frames. The client will re-assert the prompt via `session.update` when a non‑ASCII ratio is high.

## Context/response race conditions

- The client sends auto‑context (JSON + screenshot) and then triggers `response.create`. On slow networks you might see the model respond before context is attached.
- Workarounds:
  - Keep “Show Context” open and confirm timestamps precede the response.
  - Add a small debounce (100–150ms) before `response.create` to give the data channel time to deliver context.
  - Provide an initial session config at construction (see `docs/realtime-agent.md`) to avoid early‑turn races.

## Pyodide errors

- The page loads `https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js`. Confirm network access.
- Errors running Python code will appear in the Output panel under the Code tab.
- If the Monaco editor throws an unexpected error during layout, ensure the Code tab is visible and try toggling the Output panel; the editor auto-resizes with `automaticLayout`.

## TypeScript or lint errors

- Run `npm run lint` and inspect file paths in the output.
- Ensure `@types/node` and TypeScript are installed (already in `devDependencies`).

## Next.js dev 500 after refactors (Module not found)
 - Verify relative import paths after moving files (e.g., from `app/test-app/lib/` to `agent/shared`, use `../../../agent/shared/...`).
 - Restart `npm run dev` if the resolver caches stale paths.
 - Check import traces in the error overlay and fix the first failing path.
## YAML paste errors in Notes

- Symptom: errors like "end of the stream or a document separator is expected".
- Cause: Pasted prose/backticks along with YAML; the editor expects only a single YAML document.
- Fix:
  - Remove code fences (```), headings, and explanatory text from the paste.
  - Keep only keys like `title`, `version`, optional `metadata`, and `blocks`.
  - For tools: pass a single block (no leading `-`) to `notes_append_block_yaml`.
- Verify relative import paths when moving files. From `app/test-app/lib/` to `agent/shared`, the correct path is `../../../agent/shared/...`.
- Restart `npm run dev` if the resolver caches stale paths.
- Check import traces in the error overlay to fix the first failing path.

## Voice sounds weird/robotic after changes

- Symptom: output voice sounds tinny/telephony or distorted instead of the usual natural voice.
- Common causes: switching output format to `audio/pcmu`, changing voice to an unintended one, or stale session config.
- Fix (re-assert defaults via `session.update` after connect):

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

- Also check:
  - Audio element playbackRate remains 1.0.
  - Output device selection (switch to Default to clear bad sink).
  - Stop → Start the agent to force a new session; ensure `session.updated` appears before first response.


