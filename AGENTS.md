# Repo Agent Guide (Studi)

This file guides agentic coding tools working in this repo.

## Source-of-truth notes

- Follow Next.js App Router patterns (see `app/`).
- Convex is the backend; follow Convex rules below.
- Keep changes scoped; avoid unrelated refactors.

## Commands (build/lint/test)

### Install

- `npm install`

### Dev

- `npm run dev` (Next.js + Convex in parallel)
- `npm run dev:frontend` (Next.js only)
- `npm run dev:backend` (Convex only)
- `npm run predev` (Convex dashboard bootstrap)

### Build/Start

- `npm run build` (Next.js production build)
- `npm start` (Next.js production server)

### Lint

- `npm run lint` (eslint for all)
- Single file: `npx eslint path/to/file.tsx`
- Ignore patterns live in `eslint.config.mjs`.

### Typecheck (manual)

- `npx tsc --noEmit` (app-wide)
- `npx tsc -p convex/tsconfig.json --noEmit` (Convex)

### Tests

- No test runner configured in `package.json`.
- If you add tests, document the runner + single-test command here.

## Code style (general)

### Formatting

- Use 2-space indentation.
- Prefer double quotes and semicolons.
- Keep trailing commas where existing style uses them.
- Avoid large formatting-only diffs.

### Imports

- Order: React/Next → third-party → local → styles.
- Use `import type` for type-only imports.
- Prefer named imports; avoid namespace imports unless required.
- Keep imports grouped with a blank line between groups.

### React/Next.js

- Use App Router conventions in `app/`.
- Default to Server Components; add `"use client"` when using hooks.
- Components: PascalCase, functions named with `function` or `const`.
- Hooks: `useX` naming, keep dependencies explicit.
- Avoid `any`; prefer specific types or `unknown` with narrowing.

### Naming

- Variables/functions: `camelCase`.
- Components/types: `PascalCase`.
- Constants: `UPPER_SNAKE_CASE` for globals only.
- File/folder names: match existing structure and casing.

### Error handling

- Use `try/catch` around external I/O.
- Surface actionable messages (`err instanceof Error ? err.message : String(err)`).
- Prefer `NextResponse.json({ error }, { status })` in API routes.

## Convex rules (from Cursor instructions)

### Function definitions

- ALWAYS use the new syntax:
  - `query({ args, returns, handler })`
  - `mutation({ args, returns, handler })`
  - `action({ args, returns, handler })`
- Always include validators for args and returns.
- If no return value, use `returns: v.null()` and return `null`.

### Function visibility

- Public: `query`, `mutation`, `action`.
- Internal: `internalQuery`, `internalMutation`, `internalAction`.
- Use `api` for public and `internal` for private references.

### Calling conventions

- Use `ctx.runQuery`, `ctx.runMutation`, `ctx.runAction`.
- Add a type annotation when calling same-file functions.
- Avoid action→action unless crossing runtimes.

### Queries

- Do NOT use `.filter()`; prefer indexes + `.withIndex()`.
- `.unique()` throws on multiple matches.
- Default order is `_creationTime` ascending; use `.order("desc")` for reverse.
- For deletes: collect then `ctx.db.delete(row._id)`.

### Mutations

- Use `ctx.db.patch` for partial updates.
- Use `ctx.db.replace` for full replacement.

### Actions

- Add `"use node"` if using Node built-ins.
- Actions cannot use `ctx.db`.

### Schema/validators

- Define schema in `convex/schema.ts`.
- Use `v.int64()` instead of `v.bigint()`.
- Index names should include all fields (e.g., `by_a_and_b`).
- `v.null()` for null return types.

### HTTP + Cron

- HTTP endpoints belong in `convex/http.ts` using `httpAction`.
- Cron jobs: use `crons.interval` or `crons.cron` (not hourly/daily helpers).

## btca

When you need up-to-date information about technologies used in this project, use btca to query source repositories directly.

**Available resources**: nextjs, tailwindcss, convex, aiSdk, tldraw, openaiAgents, openaiRealtimeAgents, zod, react, typescript

### Usage

```bash
btca ask -r <resource> -q "<question>"
```

Use multiple `-r` flags to query multiple resources at once:

```bash
btca ask -r nextjs -r react -q "How do I use Server Components with React 19?"
```

### Notes

- Query only about the specified technology; btca has no context about this project's code.
- Resources are cloned to `~/.local/share/btca/resources/` on first use.

## File locations (quick reference)

- `app/` for Next.js App Router pages.
- `components/` for shared UI components.
- `lib/` for shared utilities.
- `convex/` for backend schema, queries, actions.

## Notes for agents

- Keep changes scoped to the requested task.
- Update this file if new tooling or conventions are added.
