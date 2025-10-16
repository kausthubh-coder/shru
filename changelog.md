## 2025-10-07

- Docs: Realtime Agent — added audio/voice defaults and a quick reset snippet to restore natural voice quality (model `gpt-realtime`, input `audio/pcm@24000`, output `audio/pcm`, voice `marin`, modalities `["audio"]`).
- Docs: Troubleshooting — new section “Voice sounds weird/robotic after changes” with a one-shot `session.update` reset, plus checks for playbackRate, output device sink, and session restart.




## 2025-10-16

- Docs sync (code-accurate): updated `architecture.md`, `convex.md`, `realtime-agent.md`, `ide.md`, `notes.md`, `test-app.md`, and `troubleshooting.md` to match current code.
- Added `docs/docs.mdc` as a verification checklist (code → doc mapping).
- README: linked the checklist and clarified realtime session gating and persona/language guard.