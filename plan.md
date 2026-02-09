# Agent + Whiteboard Improvement Plan

## Goals

- Keep voice agent lightweight and conversational.
- Give planner agent rich, structured workspace context.
- Make whiteboard interaction modular and reusable across architectures.
- Prepare for future per-space specialist agents.

## Architecture Modes

### 1) Voice-only (realtime_tools)

- Voice agent receives minimal context:
  - Recent user transcript
  - Short conversation summary (last 1–2 turns)
  - Last planner/tool response (if any)
- Voice agent handles tool calls directly.

### 2) Voice + Planner (split_planner)

- Voice agent receives minimal context (same as above).
- Planner agent receives expanded context:
  - Whiteboard: viewport bounds, blurry shapes, selected shapes, peripheral clusters, screenshot
  - IDE: file list, active file preview
  - Notes: YAML snapshot
- Planner emits tool calls executed locally via runtime.

### 3) Specialists (future)

- Voice agent acts as orchestrator.
- Each space has its own agent (whiteboard / IDE / notes).
- Context partitioning:
  - Whiteboard agent: full canvas context + image
  - IDE agent: active file + file list
  - Notes agent: notes YAML
- Orchestrator passes intent + summary to specialists and composes response.

## Modular Whiteboard Interaction

### Context Providers

- `whiteboardContext.getViewport()` → bounds + center
- `whiteboardContext.getBlurryShapes()` → in-viewport summaries
- `whiteboardContext.getSelectedShapes()` → focused shapes
- `whiteboardContext.getPeripheralClusters()` → out-of-view clusters
- `whiteboardContext.getScreenshot()` → base64 data URL

### Action Surface (tools)

- Create shape/text, move, delete, clear
- Update shape props (size, color, label)
- Create arrows/connectors
- Zoom to bounds / set viewport

### Sanitization & Mapping

- Enforce consistent `shapeId` mapping between model and tldraw IDs.
- Validate shape existence before mutating.
- Round numeric inputs and clamp positions inside viewport.

## Implementation Steps

1. Align `getViewContext` output with planner expectations.
2. Add screenshot capture to planner context.
3. Add shape ID mapping on create/move/delete.
4. Extract whiteboard context + tool execution into a `whiteboardRuntime` module.
5. Add action sanitizers before executing tool calls.
6. Expand tool schemas (resize/update/connectors).
7. Add per-architecture context assembly functions.

## Deliverables

- `lib/whiteboardContext.ts` (context provider)
- `lib/whiteboardActions.ts` (tool execution + validators)
- Updated planner context assembly
- Updated tool schemas for whiteboard operations
