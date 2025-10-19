# AI Realtime Tutor (Next.js + Convex + Clerk)

This project is a Next.js app backed by Convex and authenticated with Clerk. It includes an experimental "Realtime Tutor" that uses OpenAI's Realtime API to converse with the user, draw on a tldraw whiteboard, and interact with a lightweight in-browser IDE (Monaco + Pyodide) — all from a single test page.

Use this repo as a foundation for an AI-first, realtime, multimodal experience. The production app structure is scaffolded; the prototype lives at `app/test-app/page.tsx` while the agent experience is iterated.

Highlights:
- Auto-context per turn: the client attaches a compact JSON `view_context` (bounds + summarized shapes) and, when visible, a viewport-bounded screenshot before each response.
- Unified prompt: a single English‑only, realtime-voice prompt is injected via `session.update` after connect.
- Initialization gating: the agent won’t respond until the session is configured; avoids early-turn drift.
- Debug overlays: “Show Context” (exact JSON + image sent) and “Show Calls” (structured tool call feed) for fast debugging.

## Status (Implemented vs Planned)

- Implemented today
  - Test app at `app/test-app/page.tsx` with Whiteboard, Code IDE, Notes tabs
  - Voice agent over WebRTC with modular toolbelt (whiteboard/IDE/notes)
  - Auto-context combined JSON + screenshot per turn with short debounce; concise tutor instructions
  - IDE runs Python via Pyodide (client-side); output panel; device selectors/test tone
  - Logs, Context, and Tool Calls debug overlays
- Planned next
  - Judge0-based secure code execution for multiple languages (submit/poll); persistence in Convex
  - Interactive Notes renderer with markdown extensions (quizzes/inputs/code cells/custom UI)
  - Telemetry/guardrails for tool usage; context throttling/dedup; topic-aware prompts
  - Production hardening: auth gate + rate limits on `/realtime/token`, session resume, billing/waitlist

See the living overview in `docs/context.txt` for current status, references, and the technical auto‑context notes.

## What’s inside

- Next.js App Router UI in `app/`
- Convex backend in `convex/` (queries, mutations, actions, and HTTP endpoints)
- Clerk auth wired into Next.js (`app/layout.tsx`)
- Realtime tutor prototype at `app/test-app/page.tsx`
  - Auto-context sender (`view_context` + image)
  - English-only realtime prompt
  - Debug overlays (Context/Calls)
- Ephemeral token minting for OpenAI Realtime via `convex/realtime.ts` and `convex/http.ts`

See in-depth docs in `docs/`:

- `docs/test-app.md` — how to use the prototype page
- `docs/ide.md` — IDE tools, Python execution, and output model
- `docs/context.txt` — product context and auto‑context technical notes

## Quick start

Prerequisites:

- Node.js 18+ and npm
- Accounts: Convex, Clerk, and OpenAI

1) Install dependencies

```
npm install
```

2) Configure environment variables

- Next.js (`.env.local`):
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key
  - `CLERK_SECRET_KEY` — Clerk secret (server-side)
  - `NEXT_PUBLIC_CONVEX_SITE_URL` — your Convex Site URL (used by the test app to fetch the realtime token), e.g. `https://YOUR-DEPLOYMENT.convex.site`

- Convex (set in the Convex Dashboard → Settings → Environment Variables):
  - `OPENAI_API_KEY` — used by `convex/realtime.ts` to mint ephemeral client secrets
  - `CLIENT_ORIGIN` — optional, restrict CORS for `/realtime/token` (defaults to `*` in dev)
  - `CLERK_JWT_ISSUER_DOMAIN` — optional, if you wire Clerk auth into Convex functions

3) Start dev servers (Next.js + Convex)

```
npm run dev
```

4) Open the app

- App home: `http://localhost:3000/`
- Realtime tutor prototype: `http://localhost:3000/test-app`
  - Dock → Start → grant mic access
  - Toggle “Show Context” and “Show Calls” to inspect what the agent received and which tools it invoked

## How it works (at a glance)

1. The client fetches an ephemeral OpenAI Realtime client secret from Convex via `GET /realtime/token` (`convex/http.ts`).
2. Convex calls the OpenAI API in `convex/realtime.ts` to mint the secret using `OPENAI_API_KEY` and returns `{ value: "ek_..." }`.
3. The test page (`app/test-app/page.tsx`) initializes a `RealtimeAgent`, sets up a WebRTC transport, and registers a set of safe tools.
4. The agent automatically receives compact whiteboard context and a screenshot, then speaks and acts via tool calls (align/move/create shapes, update labels, capture view, etc.).
5. A single operating prompt is injected via `session.update` (English‑only, voice‑first, layout‑first). The app gates first turn until this completes.

See `docs/test-app.md` for the full flow and tool list.

## Scripts

```
npm run dev       # run Next.js and Convex in parallel
npm run build     # Next.js production build
npm start         # start Next.js in production
npm run lint      # lint the Next.js app
```

## Key files & folders

- `app/layout.tsx` — wraps UI with `ClerkProvider` and `ConvexClientProvider`
- `app/page.tsx` — sample Convex + Clerk usage
- `app/test-app/page.tsx` — realtime tutor prototype (tldraw, Monaco/Pyodide, voice agent)
- `convex/myFunctions.ts` — sample query/mutation (`listNumbers`, `addNumber`)
- `convex/http.ts` — HTTP routes (CORS + `/realtime/token`)
- `convex/realtime.ts` — internal action to mint OpenAI client secrets
- `convex/schema.ts` — Convex schema

## Next steps

- Harden auth on `/realtime/token` by requiring a logged-in user
- Evolve the whiteboard toolset and agent prompts
- If your network is slow, consider a small debounce or initial session config to eliminate context/response races (see `docs/realtime-agent.md`).
- Move prototype logic from `app/test-app/page.tsx` into production features

For deeper details, open the docs in `docs/`.
