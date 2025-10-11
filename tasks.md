## Project Tasks

This document tracks the refactor and improvements for the realtime voice tutor. Each task includes a clear goal, deliverables, and how to test. Check off items as you complete them.

### Conventions
- Keep changes small and test after each step
- Maintain strict types and zero lints
- Prefer modular files and composable helpers

---

### 1) Extract Realtime session setup into `app/test-app/agent/session.ts`
- Goal: Encapsulate all session connect/configure/lifecycle logic out of `page.tsx`.
- Deliverables:
  - `app/test-app/agent/session.ts` with: `createSession()`, `connect()`, `configure()`, `disconnect()`, `onEvent()`
  - Minimal interface consumed by the page (no UI in this module)
- How to test:
  - Start agent; verify `session.updated` appears before first `response.create`
  - Auto-context initial send still occurs; audio in/out still works
  - Stop agent; mic tracks and audio context close without leaks
- Done when:
  - `page.tsx` calls a small session API; no duplicated transport code

### 2) Build agent runtime factory in `app/test-app/agent/runtime.ts`
- Goal: Centralize whiteboard/ide/notes bridges + logging wrapper wiring.
- Deliverables:
  - `buildRuntime({ editorRef, sessionRef, ... })`
  - No UI code; returns the exact runtime used by tools (`AgentRuntime`)
- How to test:
  - Call any tool (e.g., `agent_create`); see structured tool logs
  - Verify errors propagate and busy indicator toggles
- Done when:
  - `page.tsx` no longer directly wires runtime bridges; only passes refs into factory

### 3) Modularize prompts into `app/test-app/prompts/`
- Goal: Persona variants and env-configurable defaults; cleaner authoring.
- Deliverables:
  - `prompts/tutor.ts` with `buildTutorInstructions({ persona, style })`
  - Variants: `default`, `gentle`, `energetic`
- How to test:
  - Toggle persona via a quick UI param or constant and observe style differences in responses
  - Verify `session.update` carries the selected prompt
- Done when:
  - No prompt walls in `page.tsx`; clear structure under `prompts/`

### 4) Refactor auto-context into `app/test-app/services/context/`
- Goal: Dedup + throttle; single conversation item combining JSON + image.
- Deliverables:
  - `services/context/index.ts` with `sendAutoContext({ dedupe, debounce, captureImage })`
  - Hash-based dedup of JSON/image; wait-for-ack (or short backoff) before `response.create`
- How to test:
  - With “Show Context” open, confirm one message item contains both `input_text` and `input_image`
  - Repeated calls without viewport change do not resend context
  - Latency to first word remains low or improves
- Done when:
  - Fewer race conditions and fewer duplicated items in history

### 5) Add tool approval gating for destructive ops
- Goal: Prevent accidental `clear`/`delete` without user confirmation.
- Deliverables:
  - Tools can set `needsApproval: true`
  - Simple approval UI (dialog/toast) to approve/reject the pending call
- How to test:
  - Ask the agent to clear the canvas → approval dialog appears
  - Approve → action happens; Reject → nothing happens
- Done when:
  - Destructive tool calls never execute without approval

### 6) Standardize tool envelopes and schemas
- Goal: One `ToolResult<T>` envelope and zod parameter schemas exported from `types/toolContracts.ts`.
- Deliverables:
  - Shared parameter helpers; all tools updated to use them
- How to test:
  - Typecheck; no any-casts
  - Logs show consistent `{ status, summary, data? }`
- Done when:
  - Tools compile with shared types and consistent result shapes

### 7) Create unified `components/DebugOverlay.tsx`
- Goal: Replace multiple debug windows with one overlay (Logs/Context/Calls) + filters.
- Deliverables:
  - Overlay component; filter by level and category; sampling to reduce noise
- How to test:
  - Toggle overlay; filter to tool errors; export log.json still works
- Done when:
  - One place to debug; observable CPU reduction vs three windows

### 8) Introduce server-side control channel (sideband)
- Goal: Monitor/update session and run sensitive tools on the server via `call_id`.
- Deliverables:
  - Minimal Node/Convex function that connects with `wss://api.openai.com/v1/realtime?call_id=...`
  - Example: log events and send `session.update` from server
- How to test:
  - Start a session in the browser; server receives events; a server-triggered `session.update` is reflected client-side
- Done when:
  - Sideband can observe and lightly control the session

### 9) Harden token fetch
- Goal: Safer defaults and basic rate limiting.
- Deliverables:
  - Require `NEXT_PUBLIC_CONVEX_SITE_URL`; remove public fallback
  - Simple in-client debounce to prevent token spam
- How to test:
  - Missing env → clear error path
  - Rapid clicks do not fire multiple token requests
- Done when:
  - Clean errors and bounded network calls

### 10) Performance pass
- Goal: Reduce CPU and log churn; maintain responsiveness.
- Deliverables:
  - Throttled logs; single AudioContext for meters; smaller screenshots or on-demand capture
  - Smarter `response.create` debounce/backoff
- How to test:
  - Profile in DevTools (CPU/memory); compare before/after
  - Confirm tool latency and audio stability
- Done when:
  - Noticeable CPU reduction with equal or better responsiveness

### 11) Add adapter tests/mocks for tldraw mapping
- Goal: Make action mapping reliable and testable.
- Deliverables:
  - Unit tests for create/move/update/label fallback
- How to test:
  - `npm test` (or `vitest`) passes; mapping validated without DOM
- Done when:
  - CI enforces adapter correctness

### 12) Update docs
- Goal: Keep documentation aligned with the new modules and flows.
- Deliverables:
  - `docs/architecture.md`, `docs/realtime-agent.md`, `docs/troubleshooting.md` updates
- How to test:
  - Follow docs from scratch; no dead paths or outdated file names
- Done when:
  - Docs match code and new structure

---

### 13) Notes (YAML-first in test-app) — Phases 1–4
- Goal: Author and render notes from a single YAML document; agent can write via tools.
- Deliverables:
  - Phase 1: YAML schemas and parsing (`app/test-app/types/notesYaml.ts`) and basic renderer/editor
  - Phase 2: Implement block components (text, quiz, input, embed) with sanitize/sandbox
  - Phase 3: Agent tools `notes_set_yaml`, `notes_append_block_yaml`; legacy text tools retained
  - Phase 4: Basic styling and safe formatting; block templates in editor
- How to test:
  - Phase 1: Paste a minimal YAML doc in Notes tab → Apply → Title and text render; invalid YAML shows errors
  - Phase 2: Add sample quiz/input/embed blocks (see `docs/notes.md`) → quiz evaluates; input updates; embed loads in sandbox
  - Phase 3: Start the agent; ask it to append a text block and an embed block → Logs show tool calls; renderer updates
  - Phase 4: Verify markdown styles render correctly; attributes are constrained; no console CSP/sandbox errors
- Done when:
  - Valid YAML renders all supported blocks; invalid YAML blocks save is prevented (Apply only)
  - Tools can set/append YAML and block ids remain unique
  - Docs updated: `docs/notes.md`, `docs/test-app.md`, `docs/architecture.md`

### Global regression checklist (run after each major change)
- Start/Stop agent works; no console errors
- Auto-context JSON+image appears; one response per turn
- Tools execute; Logs/Context/Calls show expected entries
- Audio input/output levels visible; no analyser errors
- “Save log.json” exports with turns and context sizes

### Dev commands
- `npm run dev` → open `/test-app`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck` (if configured)
- Tests: `npm test` (or `vitest`)


