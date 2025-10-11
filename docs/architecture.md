# Architecture

This project combines Next.js (App Router), Convex, Clerk, and OpenAI Realtime into a single experience. The production app scaffolding is in place while the realtime tutor prototype runs in `app/test-app/page.tsx`.

## High-level diagram

Client (Next.js App)
  ├─ Clerk UI + session (in `app/layout.tsx`)
  ├─ Convex React client (in `components/ConvexClientProvider.tsx`)
  ├─ Prototype page `app/test-app/page.tsx`
  │    ├─ tldraw whiteboard
  │    ├─ Full‑page IDE: Monaco editor with language selector; Python runs via Pyodide (loader in `app/test-app/lib/pyodide.ts`)
  │    ├─ OpenAI Realtime Agent (WebRTC)
  │    └─ Extracted components:
  │         ├─ `app/test-app/components/AIVoiceAgentPanel.tsx`
  │         └─ (Python floating windows removed)
  │    └─ Agent modules & helpers:
  │         ├─ `app/test-app/agent/session.ts` — encapsulates connect/configure/lifecycle for the Realtime session
  │         ├─ `app/test-app/agent/runtime.ts` — builds runtime bridges for tools (whiteboard/ide/notes)
  │         ├─ `app/test-app/agent/registry.ts` — central builder for all tools
  │         ├─ `app/test-app/agent/tools/*` — modular tool definitions
  │         └─ Extracted helpers/services:
  │         ├─ `app/test-app/lib/realtimeInstructions.ts`
  │         ├─ `app/test-app/lib/viewContext.ts`
  │         ├─ `app/test-app/services/context/index.ts` — combined auto‑context sender with dedup/throttle
  │         └─ `app/test-app/services/autoContext.ts` — legacy sender (fallback)
  │    └─ Notes (YAML-first in test-app):
  │         ├─ `app/test-app/types/notesYaml.ts` — zod schemas + parse/serialize helpers
  │         ├─ `app/test-app/components/NotesEditor.tsx` — YAML editor with validation
  │         └─ `app/test-app/components/NotesRenderer.tsx` — renders text/quiz/input/embed
  └─ Standard pages (`/`, `/server`, etc.)

Convex Backend (`convex/`)
  ├─ `myFunctions.ts` — example query/mutation
  ├─ `http.ts` — HTTP routes, including `/realtime/token`
  ├─ `realtime.ts` — internal action to mint OpenAI client secrets
  └─ `schema.ts` — database schema

OpenAI
  └─ Realtime API used to create ephemeral client secrets and run the agent

## Data & control flow

1) The browser loads `app/test-app/page.tsx` and, when starting the agent, fetches `GET /realtime/token` from the Convex HTTP router (`convex/http.ts`).

2) That HTTP endpoint calls `internal.realtime.mintClientSecret` (defined in `convex/realtime.ts`) using `OPENAI_API_KEY` set in Convex environment variables. It returns `{ value: "ek_..." }`.

3) The client initializes `@openai/agents/realtime` with WebRTC and the returned secret. It registers a suite of tools that bridge into the whiteboard, IDE workspace, and notes.
   - The voice agent panel UI is encapsulated in `AIVoiceAgentPanel`.
   - Code runs in a full‑page IDE; Python executes client‑side via Pyodide (loader in `app/test-app/lib/pyodide.ts`).

4) The page streams auto‑context to the agent: a compact JSON summary of the viewport + an image snapshot. By default a combined sender dispatches both in a single message with basic dedup/throttling; it falls back to the legacy two‑message flow on failure. The agent reasons over those inputs and calls tools as needed.
5) A debug layer exposes “Show Context” (the last JSON + image sent) and “Show Calls” (structured tool events) for troubleshooting.

5) Regular app pages (`/`, `/server`) demonstrate conventional Convex patterns (queries/mutations, server preloading), independent of the prototype.

## Auth

- Next.js pages are wrapped with `ClerkProvider` in `app/layout.tsx`.
- Convex functions can optionally enforce auth (e.g., gating `/realtime/token` by checking `ctx.auth.getUserIdentity()`), though this prototype leaves it open in dev.

## Files of interest

- `app/test-app/page.tsx` — the prototype UI and agent wiring (now using helpers/services)
- `app/test-app/prompts/tutor.ts` — persona‑based tutor instructions (current)
- `app/test-app/lib/realtimeInstructions.ts` — legacy single prompt
- `app/test-app/lib/viewContext.ts` — view context + screenshot helpers
- `app/test-app/services/context/index.ts` — combined auto‑context sender with dedup/throttle
- `app/test-app/services/autoContext.ts` — legacy auto‑context sender (fallback)
- `app/test-app/agent/tools/*` — modularized tool definitions (whiteboard, IDE, notes)
- `app/test-app/agent/registry.ts` — central builder for all tools
- `app/test-app/types/toolContracts.ts` — shared tool contracts, runtime bridges, and logging wrapper
- `convex/http.ts` — CORS + `/realtime/token` endpoint
- `convex/realtime.ts` — action that POSTs to OpenAI to mint ephemeral client secrets
- `convex/myFunctions.ts` — example functions (`listNumbers`, `addNumber`)
- `components/ConvexClientProvider.tsx` — Convex React provider setup

## Extending

- Add new Convex tables in `convex/schema.ts`
- Create new queries/mutations/actions in `convex/*.ts`
- Tighten `/realtime/token` auth, rate limit by user, and add logging/analytics
- Split the prototype into modular components as functionality stabilizes

## Recent changes (voice agent internals)

- Tools and session are modular:
  - Session encapsulated in `app/test-app/agent/session.ts`
  - Runtime bridges consolidated in `app/test-app/agent/runtime.ts`
  - Tool definitions in `app/test-app/agent/tools/{whiteboard,ide,notes}.ts`
  - Central registry in `app/test-app/agent/registry.ts` builds the tool array
  - Shared contracts in `app/test-app/types/toolContracts.ts`, including `createWrapExecute` for unified telemetry
- Enhanced observability:
  - Console + in‑app Logs for tool start/done/error with timing and rid
  - Action mapping logs from `page.tsx` including the final `editor.createShape` payload
- tldraw v4.0.2 compatibility:
  - `geo` shapes no longer set inline text; labels are treated as a no‑op to avoid schema errors
  - Unsupported `geo` names are normalized (e.g., `parallelogram → rhombus`, `circle → ellipse`, `square → rectangle`, fallback → `rectangle`)
  - Allowed `geo` values include: cloud, rectangle, ellipse, triangle, diamond, pentagon, hexagon, octagon, star, rhombus, rhombus-2, oval, trapezoid, arrow-right, arrow-left, arrow-up, arrow-down, x-box, check-box, heart


