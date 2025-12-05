# Test App (`/test-app`) — Legacy

The `/test-app` prototype is kept for reference only. The primary experience is the session workspace described in `architecture.md`.

## What remains
- `app/test-app/page.tsx` + `components/*` showcase a legacy whiteboard/IDE/notes UI with a voice agent.
- Tools/runtime live under `app/test-app/agent/**`; auto-context helpers under `app/test-app/services/**`.
- It still fetches tokens from Convex `/realtime/token` and runs a tutor prompt, but it is not maintained.

## When to use
- Compare behavior against the newer session workspace.
- Reuse snippets from the legacy tool definitions if needed.

## Caveats
- Consider it deprecated; no new fixes are planned.
- Data is not persisted in Convex; it is a prototype sandbox.

