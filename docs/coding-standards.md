# Coding Standards

## Organization
- Group related code by feature under `components/session/` and `components/spaces/`:
  - `agent/` realtime runtime, registry, tools
  - `services/` auto-context senders
  - `lesson/` shared notes components
- Use `lib/` for stateless utilities (prompts, view context, pyodide loader).
- Avoid monolithic files; extract helpers when a function spans multiple concerns.

## Naming & Style
- JavaScript/TypeScript: camelCase for variables/functions, PascalCase for components/classes, ALL_CAPS for constants.
- Keep functions short and single‑purpose. Prefer pure functions.
- Add spaces around operators and after commas.
- Keep lines to ≤ 100 chars where practical.

## Comments & Docs
- Explain “why” and non‑obvious logic. Avoid restating the code.
- Co-locate small comments above the blocks they explain.
- Maintain feature docs in `docs/` (architecture, realtime-agent, ide, notes, troubleshooting).

## Modules
- `lib/prompts/tutor.ts` builds the tutor instructions string.
- `lib/viewContext.ts` provides `getViewContext` and `getViewportScreenshot`.
- `components/session/services/context` sends combined context+image to the session transport (preferred); `services/autoContext` is fallback.

## Error handling
- Fail fast with descriptive messages.
- Log lightweight diagnostics to the in‑app Logs panel.

## Linting
- Keep lints clean. Prefer consistent formatting and strict TS where applicable.
