# Convex Backend

This app uses Convex for session storage (whiteboard/IDE/lesson), user sync via Clerk webhooks, and the HTTP endpoint that mints OpenAI Realtime client secrets.

See also: [Architecture Overview](architecture.md) for system context.

## Schema

Defined in `convex/schema.ts`:

- `users`: Clerk user data (indexed by `by_clerk_id`)
- `sessions`: session metadata `{ ownerId, title, createdAt, spaceTypes[] }` (index `by_owner`)
- `whiteboard_sessions`: tldraw snapshot + schemaVersion per session (index `by_session`)
- `ide_sessions`: IDE files + active file per session (index `by_session`)
- `lesson_sessions`: YAML + version per session (index `by_session`)

## Functions

- `convex/users.ts`
  - `userLoginStatus`, `currentUser`
  - Internal: `getUser`, `updateOrCreateUser`, `deleteUser`
- `convex/sessions.ts`
  - `create` (mutation): create session and seed per-space defaults
  - `list` (query): list sessions for the current user
  - `get` (query): fetch one session if owned by user
- `convex/spaces.ts`
  - Whiteboard: `getWhiteboard`, `updateWhiteboard`
  - IDE: `getIde`, `updateIde`
  - Lesson: `getLesson`, `updateLesson`

## HTTP Routes

- `convex/http.ts`
  - `POST /clerk-users-webhook` — Clerk webhook handler (Svix)
  - `OPTIONS /realtime/token` — CORS preflight
  - `GET /realtime/token` — Returns `{ value: string }` ephemeral OpenAI client secret
    - Calls `internal.realtime.mintClientSecret`
    - Defaults: `model: "gpt-realtime"`, `voice: "marin"`
    - Auth optional: uncomment identity checks to gate

## Realtime Token Minting

- `convex/realtime.ts`
  - `internalAction mintClientSecret({ model?, voice? })`
  - Reads `OPENAI_API_KEY`; POSTs to `https://api.openai.com/v1/realtime/client_secrets`
  - Returns `{ value: "ek_..." }`

## Environment Variables

Configure in Convex Dashboard → Settings → Environment Variables:

**Required**
- `OPENAI_API_KEY` — for `mintClientSecret`
- `CLERK_WEBHOOK_SECRET` — for `POST /clerk-users-webhook`

**Optional**
- `CLIENT_ORIGIN` — CORS allowlist for `/realtime/token` (default `*` in dev)
- `CLERK_JWT_ISSUER_DOMAIN` — if enabling Clerk auth in Convex functions

**Next.js env** (`.env.local`)
- `CONVEX_SITE_URL` or `NEXT_PUBLIC_CONVEX_SITE_URL` — preferred base for `/realtime/token`
- `NEXT_PUBLIC_CONVEX_URL` — alternative; rewritten to `.site` if provided

## Client Integration

Primary path: the client calls `GET /api/realtime/token` (Next.js) which forwards to Convex `/realtime/token`.

**Endpoint:** `GET /api/realtime/token` → Convex `GET /realtime/token`  
**Base URL:** Derived from `CONVEX_SITE_URL` or `NEXT_PUBLIC_CONVEX_URL`

Example proxy is implemented in `app/api/realtime/token/route.ts`.


