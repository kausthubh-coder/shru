# Convex backend

This app uses Convex for storage, queries/mutations, HTTP endpoints, and actions.

## Schema

`convex/schema.ts` defines a simple `numbers` table for the starter UI. Extend this file as your app grows.

## Functions

- `convex/myFunctions.ts`
  - `listNumbers` (query): returns the most recent numbers and the current viewer name
  - `addNumber` (mutation): inserts a new number
  - `myAction` (action): example of calling queries/mutations from an action

## Realtime token minting

- `convex/http.ts`
  - `OPTIONS /realtime/token` — preflight with CORS
  - `GET /realtime/token` — returns `{ value: string }` ephemeral secret
    - Internally calls `internal.realtime.mintClientSecret`
    - Optional auth gate: uncomment identity checks if you want to require a signed-in user

- `convex/realtime.ts`
  - `internalAction mintClientSecret({ model?, voice? })`
  - Reads `OPENAI_API_KEY` from Convex env vars
  - POSTs to `https://api.openai.com/v1/realtime/client_secrets`

## Environment variables

Configure in the Convex Dashboard → Settings → Environment Variables:

- `OPENAI_API_KEY` — required for `mintClientSecret`
- `CLIENT_ORIGIN` — optional CORS allowlist for `/realtime/token`
- `CLERK_JWT_ISSUER_DOMAIN` — optional, if enabling Clerk auth in Convex
- `NEXT_PUBLIC_CONVEX_SITE_URL` — preferred in the Next.js app to fetch `/realtime/token` (client-side)
- `NEXT_PUBLIC_CONVEX_URL` — optional; if set, the client derives the Site URL by replacing `convex.cloud` → `convex.site`

## Calling from the client

The test page fetches the token directly from the Convex site domain. It prefers `NEXT_PUBLIC_CONVEX_SITE_URL`, with a fallback that derives the Site URL from `NEXT_PUBLIC_CONVEX_URL` by swapping the domain.

- Base URL taken from `NEXT_PUBLIC_CONVEX_SITE_URL`
- Path: `/realtime/token`

Example (simplified):

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


