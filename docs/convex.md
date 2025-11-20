# Convex Backend

This app uses Convex for storage, queries/mutations, HTTP endpoints, and actions. The backend handles user authentication via Clerk webhooks and provides an endpoint for minting OpenAI Realtime API client secrets.

See also: [Architecture Overview](architecture.md) for system-wide context.

## Schema

`convex/schema.ts` defines the database schema. Currently, it includes:

- `users` table: Stores Clerk user data synced via webhook
  - Indexed by `by_clerk_id` on `clerkUser.id`
  - Used for authentication and user management

The schema is optional—Convex works without it, but it provides better TypeScript types and validation.

## Functions

- `convex/users.ts`
  - `currentUser` (query): Get the current authenticated user
  - `userLoginStatus` (query): Check login status (returns status tuple)
  - `getUser` (internal query): Get user by Clerk ID
  - `updateOrCreateUser` (internal mutation): Create or update user from Clerk webhook
  - `deleteUser` (internal mutation): Delete user by Clerk ID

## HTTP Routes

- `convex/http.ts`
  - `POST /clerk-users-webhook` — Clerk webhook handler for user sync
  - `OPTIONS /realtime/token` — CORS preflight
  - `GET /realtime/token` — Returns `{ value: string }` ephemeral OpenAI client secret
    - Internally calls `internal.realtime.mintClientSecret`
    - Default session params: `model: "gpt-realtime"`, `voice: "marin"`
    - Optional auth gate: uncomment identity checks to require signed-in user

## Realtime Token Minting

- `convex/realtime.ts`
  - `internalAction mintClientSecret({ model?, voice? })`
  - Reads `OPENAI_API_KEY` from Convex environment variables
  - POSTs to `https://api.openai.com/v1/realtime/client_secrets`
  - Returns `{ value: "ek_..." }` ephemeral client secret

## Environment Variables

Configure in the Convex Dashboard → Settings → Environment Variables:

**Required:**
- `OPENAI_API_KEY` — Required for `mintClientSecret` to generate ephemeral client secrets
- `CLERK_WEBHOOK_SECRET` — Required for Clerk webhook verification (`/clerk-users-webhook`)

**Optional:**
- `CLIENT_ORIGIN` — CORS allowlist for `/realtime/token` (defaults to `*` in dev)
- `CLERK_JWT_ISSUER_DOMAIN` — If enabling Clerk auth in Convex functions

**Next.js Environment Variables** (set in `.env.local`):
- `NEXT_PUBLIC_CONVEX_SITE_URL` — Preferred base URL for fetching `/realtime/token` (client-side)
- `NEXT_PUBLIC_CONVEX_URL` — Alternative; client derives Site URL by replacing `convex.cloud` → `convex.site`

## Client Integration

The test page (`app/test-app/page.tsx`) fetches the ephemeral token directly from the Convex site domain. It prefers `NEXT_PUBLIC_CONVEX_SITE_URL`, with a fallback that derives the Site URL from `NEXT_PUBLIC_CONVEX_URL` by swapping the domain.

**Endpoint:** `GET /realtime/token`  
**Base URL:** From `NEXT_PUBLIC_CONVEX_SITE_URL` or derived from `NEXT_PUBLIC_CONVEX_URL`

Example implementation:

```ts
const deriveSiteFromCloud = (cloudUrl?: string) => {
  if (!cloudUrl) return null;
  try {
    const u = new URL(cloudUrl);
    const host = u.host.replace("convex.cloud", "convex.site");
    return `${u.protocol}//${host}`;
  } catch {
    return null;
  }
};

const base = process.env.NEXT_PUBLIC_CONVEX_SITE_URL
  || deriveSiteFromCloud(process.env.NEXT_PUBLIC_CONVEX_URL!);
if (!base) throw new Error("Convex site URL not configured");
const res = await fetch(`${base.replace(/\/$/, '')}/realtime/token`);
const { value } = await res.json();
```


