# Coding Standards

## Organization
- Group related code by feature or purpose under `app/test-app/`:
  - `components/` UI components
  - `lib/` stateless utilities (formatting, instructions, view context)
  - `services/` side-effectful orchestration (auto-context sending)
- Avoid monolithic files. Extract helpers when a function grows beyond one concern.

## Naming & Style
- JavaScript/TypeScript: camelCase for variables/functions, PascalCase for components/classes, ALL_CAPS for constants.
- Keep functions short and single‑purpose. Prefer pure functions.
- Add spaces around operators and after commas.
- Keep lines to ≤ 100 chars where practical.

## Comments & Docs
- Explain “why” and non‑obvious logic. Avoid restating the code.
- Co-locate small comments above blocks they explain.
- Maintain feature docs in `docs/` (architecture, realtime-agent, ide, notes, context).

## Modules
- `lib/realtimeInstructions.ts` builds the tutor instructions string.
- `lib/viewContext.ts` provides `getViewContext` and `getViewportScreenshot`.
- `services/autoContext.ts` sends compact context and image to the session transport.

## Error handling
- Fail fast with descriptive messages.
- Log lightweight diagnostics to the in‑app Logs panel.

## Linting
- Keep lints clean. Prefer consistent formatting and strict TS where applicable.
