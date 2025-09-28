# Architecture

This project combines Next.js (App Router), Convex, Clerk, and OpenAI Realtime into a single experience. The production app scaffolding is in place while the realtime tutor prototype runs in `app/test-app/page.tsx`.

## High-level diagram

Client (Next.js App)
  ├─ Clerk UI + session (in `app/layout.tsx`)
  ├─ Convex React client (in `components/ConvexClientProvider.tsx`)
  ├─ Prototype page `app/test-app/page.tsx`
  │    ├─ tldraw whiteboard
  │    ├─ Monaco editor + Pyodide Python windows
  │    └─ OpenAI Realtime Agent (WebRTC)
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

3) The client initializes `@openai/agents/realtime` with WebRTC and the returned secret. It registers a suite of tools that bridge into the whiteboard (via a local `TldrawAgent`), IDE workspace, and notes.

4) The page streams auto-context to the agent: a compact JSON summary of the viewport + an image snapshot. The agent reasons over those inputs and calls tools as needed.
5) A debug layer exposes “Show Context” (the last JSON + image sent) and “Show Calls” (structured tool events) for troubleshooting.

5) Regular app pages (`/`, `/server`) demonstrate conventional Convex patterns (queries/mutations, server preloading), independent of the prototype.

## Auth

- Next.js pages are wrapped with `ClerkProvider` in `app/layout.tsx`.
- Convex functions can optionally enforce auth (e.g., gating `/realtime/token` by checking `ctx.auth.getUserIdentity()`), though this prototype leaves it open in dev.

## Files of interest

- `app/test-app/page.tsx` — the entire prototype UI and agent wiring
- `convex/http.ts` — CORS + `/realtime/token` endpoint
- `convex/realtime.ts` — action that POSTs to OpenAI to mint ephemeral client secrets
- `convex/myFunctions.ts` — example functions (`listNumbers`, `addNumber`)
- `components/ConvexClientProvider.tsx` — Convex React provider setup

## Extending

- Add new Convex tables in `convex/schema.ts`
- Create new queries/mutations/actions in `convex/*.ts`
- Tighten `/realtime/token` auth, rate limit by user, and add logging/analytics
- Split the prototype into modular components as functionality stabilizes


