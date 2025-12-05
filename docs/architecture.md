# Architecture

This project combines Next.js (App Router), Convex, Clerk, and OpenAI Realtime into a session-centric workspace that persists whiteboard/IDE/lesson data per session. The legacy `/test-app` prototype remains for reference but is no longer the primary flow.

**Related docs:**
- [Convex Backend](convex.md) — Backend schema, functions, and HTTP routes
- [Realtime Agent](realtime-agent.md) — Agent session setup and tools
- [IDE Tools](ide.md) — IDE runtime and agent tools
- [Notes System](notes.md) — YAML lessons and tools
- [Test App Guide](test-app.md) — Legacy prototype (deprecated)

## High-level diagram

Client (Next.js App)
  ├─ Clerk UI + session (via middleware and `app/layout.tsx`)
  ├─ Convex React client (`components/ConvexClientProvider.tsx`)
  ├─ Landing + dashboard (`app/page.tsx`, `components/Dashboard.tsx`)
  │    └─ Create/list sessions with selectable spaces (whiteboard, IDE, lesson)
  ├─ Session workspace (`app/session/[sessionId]/page.tsx`)
  │    └─ `components/session/SessionWorkspace.tsx`
  │         ├─ Tabs: whiteboard (tldraw v4), code (Monaco + Pyodide), notes (YAML)
  │         ├─ Voice agent UI (`components/session/AIVoiceAgentPanel.tsx`)
  │         ├─ Agent session + runtime (`components/session/agent/{session,runtime,registry}.ts`)
  │         ├─ Agent tools (`components/session/agent/tools/*`)
  │         ├─ Auto-context senders (`components/session/services/context/index.ts`, fallback `services/autoContext.ts`)
  │         └─ Shared helpers (`lib/viewContext.ts`, `lib/pyodide.ts`, `lib/prompts/tutor.ts`)
  └─ Legacy prototype (`app/test-app/**`) — kept for comparison only

Convex Backend (`convex/`)
  ├─ `schema.ts` — users, sessions, and per-space tables (whiteboard/ide/lesson)
  ├─ `sessions.ts` — create/list/get sessions and seed default space content
  ├─ `spaces.ts` — get/update whiteboard snapshots, IDE files, lesson YAML
  ├─ `users.ts` — Clerk-backed user storage and helpers
  ├─ `http.ts` — `/realtime/token` + `/clerk-users-webhook`
  └─ `realtime.ts` — internal action to mint OpenAI client secrets

OpenAI
  └─ Realtime API used to mint ephemeral client secrets and run the agent

## Data & control flow

1) Authenticated user creates or opens a session from the dashboard. Convex stores session metadata and per-space content (`sessions`, `whiteboard_sessions`, `ide_sessions`, `lesson_sessions`).

2) The session page mounts `SessionWorkspace`, which loads space data from Convex (`convex/spaces.ts`) and hydrates the whiteboard/IDE/lesson tabs.

3) When the user clicks Connect, the client fetches a token from `GET /api/realtime/token` (Next.js proxy). That route forwards to the Convex HTTP router (`/realtime/token`), which calls `internal.realtime.mintClientSecret` using `OPENAI_API_KEY` and returns `{ value: "ek_..." }`.

4) The client initializes `@openai/agents/realtime` over WebRTC via `createRealtimeSessionHandle`, registers tools from `components/session/agent/tools/*`, and applies tutor instructions from `lib/prompts/tutor.ts`.

5) Before responses, the client streams auto-context: a compact JSON summary of the workspace plus a viewport JPEG. The combined sender (`services/context/index.ts`) deduplicates within ~300ms and debounces ~120ms before triggering `response.create`; fallback splits text/image sends.

6) Structured logs, context viewer, and tool-call viewer are exposed via the voice agent panel for debugging.

## Auth

- Next.js uses Clerk middleware (`middleware.ts`) on protected routes.
- Convex functions can enforce auth (e.g., gate `/realtime/token` inside `convex/http.ts` by checking `ctx.auth.getUserIdentity()`).

## Files of interest

- `app/page.tsx`, `components/Dashboard.tsx` — landing + session creation/list
- `app/session/[sessionId]/page.tsx` — session wrapper
- `components/session/SessionWorkspace.tsx` — workspace + agent wiring
- `components/spaces/{WhiteboardSpace,IDESpace,LessonSpace}.tsx` — embeddable spaces
- `components/session/agent/{session,runtime,registry}.ts` — realtime session handle, runtime bridges, tool registry
- `components/session/agent/tools/*` — tool definitions (whiteboard, IDE, notes)
- `components/session/services/context/index.ts` — combined auto-context sender (preferred)
- `components/session/services/autoContext.ts` — legacy sender (fallback)
- `convex/schema.ts`, `convex/sessions.ts`, `convex/spaces.ts`, `convex/users.ts` — data model and CRUD
- `convex/http.ts`, `convex/realtime.ts` — HTTP router + client-secret minting
- `app/api/realtime/token/route.ts` — Next.js proxy to Convex token endpoint
- Legacy prototype: `app/test-app/**` (see `docs/test-app.md`)

## Performance notes (landing → dashboard)
- `app/page.tsx` dynamically imports `components/Dashboard.tsx` to keep the landing bundle small for unauthenticated users.
- `components/spaces/SpaceRegistry.tsx` dynamically imports each space component (Whiteboard/tldraw, IDE/Monaco, Lesson) so the dashboard checklist does not pull heavy editor/whiteboard bundles until a session is opened.

## Extending

- Add new spaces or tables in `convex/schema.ts`; wire CRUD in `convex/spaces.ts`.
- Tighten `/realtime/token` auth/rate limits in `convex/http.ts`; add logging.
- Extend session metadata (e.g., roles, collaborators) in `convex/sessions.ts`.
- Add new tools via `components/session/agent/tools/*` and register in `registry.ts`.
- Replace or augment tutor prompts in `lib/prompts/tutor.ts`.

## Recent changes

- Session workspace replaces the legacy prototype as the primary flow.
- Agent tools are modular and instrumented (`createWrapExecute`, tool event stream).
- Auto-context sender is combined (JSON + image in one item) with dedup/debounce; legacy split sender retained as fallback.
- tldraw v4.0.2 compatibility: text uses `richText`; geo labels are separate text shapes; geo names are normalized.


