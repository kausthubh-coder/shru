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
- Errors running Python code will appear in the window’s stderr panel.

## TypeScript or lint errors

- Run `npm run lint` and inspect file paths in the output.
- Ensure `@types/node` and TypeScript are installed (already in `devDependencies`).


