<!-- a3f7a1c8-f50b-4b75-a7e9-90899bbcdfea 47ffe27e-df0b-45e9-b988-254132c0e0b7 -->
# Complete Realtime Tutor Demo — Robust Voice Agent Across Whiteboard, IDE, Notes

### Goals

- Robust, human-like voice tutor that speaks and acts across three spaces: whiteboard, code IDE, notes (YAML → rendered lesson).
- Per-space auto-context, resilient whiteboard actions, automatic/manual view switching, approvals, and clean logs.

### What we will change

- Per-space auto-context (JSON + optional image) selected by current tab.
- UI view switching: auto-switch based on tool category, plus a dedicated `ui_switch_view` tool.
- Expand tldraw action adapter so all shipped tools actually work end-to-end.
- Finalize destructive tool approvals with a simple dialog and re-dispatch flow.
- Light performance and observability polish; QA scenarios; docs alignment.

### Key files to update/create

- Update `app/test-app/page.tsx` — expand tldraw action mapping; wire auto-switch toggle; pass `setActiveTab` into runtime; small VAD/response debounce tweaks.
- Update `app/test-app/agent/runtime.ts` — add `ui` bridge with `setTab(view)`; expose `getActiveTab()` if needed.
- Create `app/test-app/agent/tools/ui.ts` — define `ui_switch_view` tool.
- Update `app/test-app/agent/registry.ts` — include UI tools.
- Update `app/test-app/types/toolContracts.ts` — extend `AgentRuntime` with optional `ui` surface; optionally enhance `createWrapExecute` to auto-switch views based on tool name.
- Update `app/test-app/services/context/index.ts` — branch auto-context by active space; keep combined text+image message; retain legacy fallback.
- Update `app/test-app/components/AIVoiceAgentPanel.tsx` — add an "Auto-switch views" toggle in Dev Controls.
- Optional: Add `app/test-app/services/tldrawActions.ts` — extracted adapter helpers for clarity/tests.
- Docs: `docs/realtime-agent.md`, `docs/test-app.md`, `docs/architecture.md`.

### Per-space auto-context (core)

- Whiteboard (existing): `view_context` JSON + viewport JPEG (combined message).
- IDE: send `ide_context` JSON: `{ files:[{name,language,size}], active, preview }` (preview: first N chars of active file). Text-only; no image.
- Notes: send `notes_yaml` JSON: `{ yaml, title, blocksCount }` and optionally an image of the rendered panel later; start with text-only.
- Keep dedupe/throttle; continue 120ms debounce before `response.create`.

Small example (combined message item shape):

```
// conversation.item.create content array
[{ type: 'input_text', text: JSON.stringify({ type: 'ide_context', active, files, preview }) }]
```

### UI view switching

- Auto: In `createWrapExecute`, detect tool categories and call `runtime.ui?.setTab('whiteboard'|'code'|'notes')` before execution.
- Manual: New `ui_switch_view` tool to explicitly switch views.

Example (tool):

```ts
// app/test-app/agent/tools/ui.ts
export function buildUiTools(runtime: AgentRuntime) {
  const wrapExecute = createWrapExecute(runtime);
  const ui_switch_view = {
    name: 'ui_switch_view',
    description: 'Switch the app view (whiteboard|code|notes).',
    parameters: z.object({ view: z.enum(["whiteboard","code","notes"]) }),
    execute: wrapExecute('ui_switch_view', async ({ view }) => {
      runtime.ui?.setTab(view);
      return { status: 'ok', summary: `switched to ${view}` };
    }),
  } as const;
  return [ui_switch_view];
}
```

Example (auto-switch mapping):

```ts
// app/test-app/types/toolContracts.ts (inside createWrapExecute)
const toolToTab: Record<string, 'whiteboard'|'code'|'notes'> = {
  agent_: 'whiteboard',
  ide_: 'code',
  notes_: 'notes',
  ui_switch_view: undefined as any,
};
const prefix = Object.keys(toolToTab).find(p => name.startsWith(p));
if (prefix) runtime.ui?.setTab(toolToTab[prefix]);
```

### Whiteboard action adapter (reliability)

- Expand `agentRef.current.act` mapping in `app/test-app/page.tsx` to support actions used by tools today: `update`, `pen`, `resize`, `rotate`, `align`, `distribute`, `stack`, `bringToFront`, `sendToBack`, `place`.
- Optional extraction to `services/tldrawActions.ts` for clarity + tests.

Example (pen + update stubs):

```
if (_type === 'pen') editor.createShape({ type: 'draw', ...mappedPolylineFrom(points) });
if (_type === 'update') editor.updateShapes([{ id: `shape:${update.shapeId}`, type:'geo', ...propsFrom(update) }]);
```

### Tool approvals

- Keep `agent_clear` behind approval. When tool returns `{ status: 'error', summary: 'approval_required' }`, open `ToolApprovalDialog`, and on Approve re-dispatch the same tool call.
- Surface minimal event via `onToolEvent({ status:'start', rid:'approval', name:'agent_clear', args:{ approval:"..." }})` (already emitted); wire the dialog in `page.tsx`.

### Performance & observability

- Keep combined auto-context, 120ms response debounce; ensure we skip `response.create` while a tool is running.
- Use `DebugOverlay` for Logs/Context/Calls; add simple filters (level/category) if needed.

### Acceptance tests (manual)

- Start agent; confirm `session.updated` before first response and natural voice.
- Whiteboard: "Draw three rectangles", "Align top", "Label left one" → shapes appear, align correctly, text label appears as separate shape.
- IDE: "Create file hello.py", "Set active hello.py", "Replace content with print(1+2)" → Run ▶ shows `3`.
- Notes: "Set notes to YAML with a quiz block" → YAML validated, rendered quiz works.
- View switching: invoking `agent_create` focuses Whiteboard; `ide_*` focuses Code; `ui_switch_view` works.

### Documentation

- Update docs to describe per-space context, new UI tool, and auto-switch behavior; note the approval gating.

### Out of scope (future)

- Server sideband control channel; Judge0 execution; Convex persistence of notes/files; production auth/rate limits.

### To-dos

- [ ] Implement per-space auto-context in services/context/index.ts
- [ ] Add ui.setTab bridge to AgentRuntime and runtime.ts
- [ ] Create ui_switch_view tool and register in registry.ts
- [ ] Auto-switch views in createWrapExecute based on tool prefix
- [ ] Support update/pen/resize/rotate/align/... in page.tsx
- [ ] Wire ToolApprovalDialog to approval_required flow in page.tsx
- [ ] Add Auto-switch toggle to AIVoiceAgentPanel and state
- [ ] Add simple level/category filters to DebugOverlay (optional)
- [ ] Capture manual QA steps and verify acceptance tests
- [ ] Update realtime-agent.md and test-app.md to reflect changes