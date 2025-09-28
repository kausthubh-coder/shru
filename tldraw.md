## Tldraw Whiteboard Agent — Complete Guide and Learning Plan

This document helps you understand, run, and extend the `agent/` starter. It adds a concrete step‑by‑step learning plan, a code map, backend streaming details, and hands‑on exercises so that by the end you can comfortably modify prompt parts and actions, or port the agent into your own app.

### TL;DR of what you’ll learn
- How the agent “sees” (prompt parts) and “does” (actions)
- How streaming works (SSE) front ↔ back
- How diffs are produced and accepted/rejected in the UI
- How to add custom shapes and new capabilities

---

### 0) Quickstart (10–15 min)
- Install and run:
  - `cd agent && npm i && npm run dev`
- Add at least one provider key to `.dev.vars` (see `agent/worker/environment.ts`):
  - `OPENAI_API_KEY=...`, `ANTHROPIC_API_KEY=...`, or `GOOGLE_API_KEY=...`
- Try: “Draw a red rectangle” → observe streamed actions and diffs.

Done when: The agent creates/edits shapes and chat history shows grouped steps.

---

### 1) Learning plan (fast path, ~2–3h)
- Phase A — Orientation: `client/App.tsx`, `client/agent/useTldrawAgent.ts`, skim public methods in `client/agent/TldrawAgent.ts`. Exercise: `agent.prompt('Draw a triangle')`.
- Phase B — Eyes (prompt parts): `shared/parts/PromptPartUtil.ts`, `shared/AgentUtils.ts` (registry), then key parts (`MessagesPartUtil`, `SystemPromptPartUtil`, `ModelNamePartUtil`, `ScreenshotPartUtil`, `ViewportBoundsPartUtil`, `BlurryShapesPartUtil`, `PeripheralShapesPartUtil`, `SelectedShapesPartUtil`, `ChatHistoryPartUtil`, `UserActionHistoryPartUtil`, `TodoListPartUtil`, `TimePartUtil`, `DataPartUtil`). Exercise: add a tiny custom part and log it server‑side.
- Phase C — Hands (actions): `shared/actions/AgentActionUtil.ts`, `shared/AgentUtils.ts` (registry), then representative actions (`Create/Update/Delete/Move`, layout ops, `Message/Think/Review/TodoList`). Exercise: implement `ClearSelectionActionUtil` (based on `ClearActionUtil`) and register it.
- Phase D — Streaming + backend: `worker/routes/stream.ts`, `worker/do/AgentDurableObject.ts`, `worker/do/AgentService.ts`, `worker/prompt/*`, `worker/models.ts`. Exercise: log system prompt + first 3 model messages; inspect `/stream` in DevTools.
- Phase E — UI: `client/components/ChatPanel.tsx`, `client/components/chat-history/*`, `client/components/highlights/*`, `client/tools/*`. Exercise: accept/reject a diff group.
- Phase F — Helpers & formats: `shared/AgentHelpers.ts`, `shared/format/*`. Exercise: force a missing ID and confirm `sanitizeAction` cancels it.

---

### 2) Code map (where to look)
- Agent/orchestration: `client/agent/TldrawAgent.ts`, `client/agent/useTldrawAgent.ts`, `client/agent/agentsAtom.ts`
- UI: `client/App.tsx`, `client/components/*`, `client/tools/*`
- Prompt parts: `shared/parts/*` (registered in `shared/AgentUtils.ts`)
- Actions: `shared/actions/*` (registered in `shared/AgentUtils.ts`)
- Helpers & formats: `shared/AgentHelpers.ts`, `shared/format/*`
- Backend + models: `worker/routes/stream.ts`, `worker/do/AgentDurableObject.ts`, `worker/do/AgentService.ts`, `worker/prompt/*`, `worker/models.ts`, `worker/environment.ts`

---

This guide explains how to build an AI whiteboard agent that can see and manipulate the tldraw canvas, and how to integrate it with a voice/WebRTC OpenAI Realtime pipeline (function/tool calls). It’s tailored to the `agent/` starter checked into this repo and shows how to reproduce or adapt the design for your own codebase (e.g., ShruAI voice tutor with custom shapes/windows).

### What you’ll build
- A whiteboard agent that can read visual context and shape data.
- An action system the model uses to perform canvas changes (create/move/update/align/etc.).
- A streaming loop that applies actions in real-time.
- A bridge to OpenAI Realtime: map tool calls → tldraw actions.
- Support for custom shapes and windows (e.g., Python IDE panes).

---

## 1) Architecture at a glance

- "Eyes" (Context builders): Prompt parts gather what the model sees: system prompt, user message(s), a screenshot, viewport bounds, blurry shapes in view, clusters outside the viewport, selected shapes, chat history, user action history, todo list, time.
- "Hands" (Action utils): The agent performs canvas edits via modular actions, each with data validation (sanitization), execution, and history display rules.
- Streaming loop: The frontend streams AI output and applies actions incrementally to the canvas. Partial actions are reverted/updated until complete.
- Backend service: Streams JSON that conforms to a schema of `AgentAction` events (SSE). In the starter, this runs on a Cloudflare Durable Object using the Vercel AI SDK; you can swap in OpenAI Realtime by transforming function calls to the same `AgentAction` shape.

Key registries (what the agent can see/do):
```54:80:agent/shared/AgentUtils.ts
export const PROMPT_PART_UTILS = [
	// Model
	SystemPromptPartUtil,
	ModelNamePartUtil,
	// Request
	MessagesPartUtil,
	DataPartUtil,
	ContextItemsPartUtil,
	// Viewport
	ScreenshotPartUtil,
	ViewportBoundsPartUtil,
	// Shapes
	BlurryShapesPartUtil,
	PeripheralShapesPartUtil,
	SelectedShapesPartUtil,
	// History
	ChatHistoryPartUtil,
	UserActionHistoryPartUtil,
	TodoListPartUtil,
	// Metadata
	TimePartUtil,
]
```

```88:127:agent/shared/AgentUtils.ts
export const AGENT_ACTION_UTILS = [
	// Communication
	MessageActionUtil,
	// Planning
	ThinkActionUtil,
	ReviewActionUtil,
	AddDetailActionUtil,
	TodoListActionUtil,
	SetMyViewActionUtil,
	// Individual shapes
	CreateActionUtil,
	DeleteActionUtil,
	UpdateActionUtil,
	LabelActionUtil,
	MoveActionUtil,
	// Groups of shapes
	PlaceActionUtil,
	BringToFrontActionUtil,
	SendToBackActionUtil,
	RotateActionUtil,
	ResizeActionUtil,
	AlignActionUtil,
	DistributeActionUtil,
	StackActionUtil,
	ClearActionUtil,
	// Drawing
	PenActionUtil,
	// External APIs
	RandomWikipediaArticleActionUtil,
	CountryInfoActionUtil,
	CountShapesActionUtil,
	// Internal (required)
	UnknownActionUtil,
]
```

The frontend agent orchestrates the prompt and streaming loop:
```742:786:agent/client/agent/TldrawAgent.ts
const requestPromise = (async () => {
	const prompt = await agent.preparePrompt(request, helpers)
	let incompleteDiff: RecordsDiff<TLRecord> | null = null
	const actionPromises: Promise<void>[] = []
	try {
		for await (const action of streamAgent({ prompt, signal })) {
			if (cancelled) break
			editor.run(() => {
				const actionUtil = agent.getAgentActionUtil(action._type)
				const transformedAction = actionUtil.sanitizeAction(action, helpers)
				if (!transformedAction) { incompleteDiff = null; return }
				if (incompleteDiff) editor.store.applyDiff(reverseRecordsDiff(incompleteDiff))
				const { diff, promise } = agent.act(transformedAction, helpers)
				if (promise) actionPromises.push(promise)
				incompleteDiff = transformedAction.complete ? null : diff
			},{ ignoreShapeLock: false, history: 'ignore' })
		}
		await Promise.all(actionPromises)
	} catch (e) {
		// error handling elided
	}
})()
```

Backend streaming via SSE:
```35:80:agent/worker/do/AgentDurableObject.ts
private async stream(request: Request): Promise<Response> {
	const encoder = new TextEncoder()
	const { readable, writable } = new TransformStream()
	const writer = writable.getWriter()
	;(async () => {
		try {
			const prompt = (await request.json()) as AgentPrompt
			for await (const change of this.service.stream(prompt)) {
				const data = `data: ${JSON.stringify(change)}\n\n`
				await writer.write(encoder.encode(data))
				await writer.ready
			}
			await writer.close()
		} catch (error: any) {
			const errorData = `data: ${JSON.stringify({ error: error.message })}\n\n`
			await writer.write(encoder.encode(errorData))
			await writer.close()
		}
	})()
	return new Response(readable, { headers: { 'Content-Type': 'text/event-stream', ... } })
}
```

---

## 2) Core concepts and files

- `TldrawAgent`: state, chat/todo history, context items, scheduling, streaming, and action application.
- Prompt parts (prompt builders): `agent/shared/parts/*`. Notable:
  - `ScreenshotPartUtil`: renders a data URL screenshot from the agent’s current `bounds`.
  - `ViewportBoundsPartUtil`: describes relative user vs. agent view.
  - `BlurryShapesPartUtil`, `PeripheralShapesPartUtil`, `SelectedShapesPartUtil`: send structured canvas data.
  - `ChatHistoryPartUtil`, `UserActionHistoryPartUtil`, `TodoListPartUtil`: memory.
- Actions (canvas manipulation): `agent/shared/actions/*` (create, update, delete, move, align, rotate, resize, stack, place, z-order, pen, label, clear; plus planning/message/todo actions).
- Backend (Cloudflare DO): `agent/worker/*` builds system/user messages and streams an Actions JSON envelope; can be swapped with a Realtime bridge.

Screenshot generation:
```17:51:agent/shared/parts/ScreenshotPartUtil.ts
override async getPart(request: AgentRequest): Promise<ScreenshotPart> {
	if (!this.agent) return { type: 'screenshot', screenshot: null }
	const { editor } = this.agent
	const contextBounds = request.bounds
	const shapes = editor.getCurrentPageShapesSorted().filter((shape) => {
		const bounds = editor.getShapeMaskedPageBounds(shape)
		return bounds && Box.From(contextBounds).includes(bounds)
	})
	if (shapes.length === 0) return { type: 'screenshot', screenshot: null }
	const result = await editor.toImage(shapes, { format: 'jpeg', background: true, bounds: Box.From(request.bounds) })
	return { type: 'screenshot', screenshot: await FileHelpers.blobToDataUrl(result.blob) }
}
```

---

## 3) Deep dive — How the Agent Starter Kit implements the architecture

This section walks the exact code paths under `agent/` that implement the six architecture pillars shown in the diagram: user input, visual context, actions, streaming, memory, and model integration.

### 3.1 User input — where every request starts

- UI capture happens in `agent/client/components/ChatPanel.tsx` → `handleSubmit`, which:
  - Reads the textarea (user message)
  - Pulls current selection via `editor.getSelectedShapes()`
  - Pulls any context items you picked with the custom tools (shape/area)
  - Calls `agent.prompt({ message, bounds, selectedShapes, contextItems, modelName, type: 'user' })`

Minimal excerpt:
```tsx
// agent/client/components/ChatPanel.tsx
await agent.prompt({
  message,
  contextItems,
  bounds: editor.getViewportPageBounds(),
  modelName,
  selectedShapes: editor
    .getSelectedShapes()
    .map((shape) => convertTldrawShapeToSimpleShape(editor, shape)),
  type: 'user',
})
```

- The agent normalizes/augments this input in `TldrawAgent.getFullRequestFromInput`:
  - Fills defaults for `bounds`, `modelName`, `messages`, etc.
  - Carries over an active request’s bounds/model if present
```ts
// agent/client/agent/TldrawAgent.ts
getFullRequestFromInput(input: AgentInput): AgentRequest {
  const request = this.getPartialRequestFromInput(input)
  const activeRequest = this.$activeRequest.get()
  return {
    type: request.type ?? 'user',
    messages: request.messages ?? [],
    data: request.data ?? [],
    selectedShapes: request.selectedShapes ?? [],
    contextItems: request.contextItems ?? [],
    bounds: request.bounds ?? activeRequest?.bounds ?? this.editor.getViewportPageBounds(),
    modelName: request.modelName ?? activeRequest?.modelName ?? this.$modelName.get(),
  }
}
```

- For multi‑turn planning, `agent.prompt` uses the `$scheduledRequest` and `$todoList` to schedule follow‑ups (e.g., reviews or additional steps) until work is done.

What the agent gathers before calling the model (from your request and local state):
- User message(s) and additional messages queued in the request
- Current selection (converted to a simplified format)
- Manually provided context items (shape/area/point/groups)
- The agent’s viewport (`bounds`)
- Recent user actions
- Screenshot of the agent’s viewport
- Blurry shapes in viewport and clusters outside viewport
- Chat history + todo list

All of the above become prompt parts (next section).

### 3.2 Visual context system — the agent’s “eyes” (PromptPartUtil)

Every context source is implemented as a `PromptPartUtil` in `agent/shared/parts/*`. The registry is in `PROMPT_PART_UTILS` (see earlier). For each part:
- `getPart(request, helpers)` collects raw data synchronously or asynchronously
- `buildMessages(part)` turns it into `AgentMessage[]` (text and/or images)
- `buildSystemPrompt(part)` optionally contributes system‑level instructions
- `getPriority(part)` decides the merge order (later = higher priority)

Important parts and their roles:
- `MessagesPartUtil`: wraps your `messages` into the final user message(s).
- `ContextItemsPartUtil`: serializes your selected shapes/items/areas/points.
- `ScreenshotPartUtil`: captures a JPEG screenshot (data URL) of what the agent can currently see within `bounds`.
- `ViewportBoundsPartUtil`: describes the relationship between the user’s and agent’s views (e.g., “Reviewing area…”).
- `BlurryShapesPartUtil`: sends a concise representation of visible shapes (bounds, type, optional text) — great for spatial reasoning.
- `PeripheralShapesPartUtil`: summarizes clusters outside the viewport so the model knows about off‑screen regions.
- `SelectedShapesPartUtil`: sends detailed `SimpleShape` for the current selection.
- `ChatHistoryPartUtil`, `UserActionHistoryPartUtil`, `TodoListPartUtil`: persistent memory (history of prompts/actions, user diffs, todos).
- `ModelNamePartUtil`, `SystemPromptPartUtil`, `TimePartUtil`: metadata and system rules.

Example: building a screenshot prompt part:
```ts
// agent/shared/parts/ScreenshotPartUtil.ts (simplified)
override async getPart(request: AgentRequest): Promise<ScreenshotPart> {
  const shapesInView = editor.getCurrentPageShapesSorted().filter((shape) => {
    const bounds = editor.getShapeMaskedPageBounds(shape)
    return bounds && Box.From(request.bounds).includes(bounds)
  })
  if (shapesInView.length === 0) return { type: 'screenshot', screenshot: null }
  const img = await editor.toImage(shapesInView, { format: 'jpeg', bounds: Box.From(request.bounds) })
  return { type: 'screenshot', screenshot: await FileHelpers.blobToDataUrl(img.blob) }
}
```

Shape serialization helpers live under `agent/shared/format/*`, e.g.:
- `convertTldrawShapeToSimpleShape` → detailed format for focused shapes
- `convertTldrawShapeToBlurryShape` → lightweight format for viewport
- `convertTldrawShapesToPeripheralShapes` → off‑screen clusters

### 3.3 Action system — the agent’s “hands” (AgentActionUtil)

Each canvas operation is an `AgentActionUtil` in `agent/shared/actions/*`. The registry is `AGENT_ACTION_UTILS`.

Contract:
- `getSchema()`: Zod schema that the model must follow for that action
- `sanitizeAction(action, helpers)`: fix/validate incoming data, or return null to reject
- `applyAction(action, helpers)`: mutate the editor; may return a promise for async work
- `getInfo(action)`: controls how the action appears in chat history (icon, description, summary, grouping)
- `savesToHistory()`: whether to store the action and show diffs
- `buildSystemPrompt()`: optional system rules for this action type

Examples:
```ts
// Move a shape by id; validate inputs; translate coordinates from chat offset
// agent/shared/actions/MoveActionUtil.ts (simplified)
override sanitizeAction(a, h) {
  if (!a.complete) return a
  const id = h.ensureShapeIdExists(a.shapeId); if (!id) return null
  const x = h.ensureValueIsNumber(a.x), y = h.ensureValueIsNumber(a.y)
  if (x === null || y === null) return null
  a.shapeId = id; a.x = x; a.y = y; return a
}
override applyAction(a, h) {
  if (!a.complete) return
  const { x, y } = h.removeOffsetFromVec({ x: a.x, y: a.y })
  const shapeId = `shape:${a.shapeId}` as TLShapeId
  const shape = this.agent!.editor.getShape(shapeId); if (!shape) return
  const bb = this.agent!.editor.getShapePageBounds(shapeId); if (!bb) return
  const offset = new Vec(x, y).add(new Vec(shape.x, shape.y).sub(new Vec(bb.minX, bb.minY)))
  this.agent!.editor.updateShape({ id: shapeId, type: shape.type, x: offset.x, y: offset.y })
}
```

```ts
// Create a shape from the SimpleShape schema
// agent/shared/actions/CreateActionUtil.ts (simplified)
override sanitizeAction(a, h) {
  if (!a.complete) return a
  a.shape.shapeId = h.ensureShapeIdIsUnique(a.shape.shapeId)
  if (a.shape._type === 'arrow') {
    if (a.shape.fromId) a.shape.fromId = h.ensureShapeIdExists(a.shape.fromId)
    if (a.shape.toId) a.shape.toId = h.ensureShapeIdExists(a.shape.toId)
  }
  return a
}
override applyAction(a, h) {
  if (!this.agent || !a.complete) return
  a.shape = h.removeOffsetFromShape(a.shape)
  const { shape, bindings } = convertSimpleShapeToTldrawShape(this.agent.editor, a.shape, { defaultShape: getDefaultShape(a.shape._type) })
  this.agent.editor.createShape(shape)
  bindings?.forEach((b) => this.agent!.editor.createBinding(b))
}
```

### 3.4 Streaming system — real‑time responses front to back

Frontend stream and backpressure:
- `TldrawAgent.request` calls `streamAgent`, which performs an SSE `fetch('/stream')`
- Reader loop appends to a buffer; each `data:` line is parsed to JSON and yielded as a `Streaming<AgentAction>`
- For each partial action, the agent:
  1) Runs `sanitizeAction`
  2) Reverts any previously incomplete diff
  3) Applies the new partial action via `agent.act(...)` and captures a new diff
  4) Saves the action (and diff) to chat history if configured

Key excerpt:
```ts
// agent/client/agent/TldrawAgent.ts (inside requestAgent)
for await (const action of streamAgent({ prompt, signal })) {
  editor.run(() => {
    const util = agent.getAgentActionUtil(action._type)
    const transformed = util.sanitizeAction(action, helpers)
    if (!transformed) { incompleteDiff = null; return }
    if (incompleteDiff) editor.store.applyDiff(reverseRecordsDiff(incompleteDiff))
    const { diff, promise } = agent.act(transformed, helpers)
    if (promise) actionPromises.push(promise)
    incompleteDiff = transformed.complete ? null : diff
  }, { ignoreShapeLock: false, history: 'ignore' })
}
```

Backend streaming (Durable Object):
- `agent/worker/do/AgentDurableObject.ts` turns the model stream into SSE lines
- `agent/worker/do/AgentService.ts` uses the Vercel AI SDK `streamText` to produce a continuous JSON object of actions; `closeAndParseJson` lets the server parse incomplete JSON safely to yield partial actions

Model parsing loop (simplified):
```ts
// agent/worker/do/AgentService.ts
const { textStream } = streamText({ model, system, messages, ... })
let buffer = canForceResponseStart ? '{"actions": [{"_type":' : ''
let cursor = 0, maybeIncomplete: AgentAction | null = null
for await (const text of textStream) {
  buffer += text
  const partial = closeAndParseJson(buffer)
  if (!partial) continue
  const actions = partial.actions
  if (Array.isArray(actions) && actions.length > cursor) {
    const completed = actions[cursor - 1]
    if (completed) yield { ...completed, complete: true, time }
    cursor++
  }
  const current = actions[cursor - 1]
  if (current) yield { ...current, complete: false, time }
}
if (maybeIncomplete) yield { ...maybeIncomplete, complete: true, time }
```

### 3.5 Memory system — persistent context & diffs

Atoms stored by the agent (`agent/client/agent/TldrawAgent.ts`):
- `$chatHistory`: full list of prompt/action/continuation entries
- `$todoList`: task list used to continue multi‑turn work
- `$userActionHistory`: last N diffs of user operations (create/delete/update)
- `$chatOrigin`: the page‐space position used to normalize/offset coordinates
- `$contextItems`: ad‑hoc context the user added

They are persisted to `localStorage` via a small helper:
```ts
// agent/client/agent/TldrawAgent.ts (persistAtomInLocalStorage)
react(`save ${key} to localStorage`, () => {
  localStorage.setItem(key, JSON.stringify(atom.get()))
})
```

Persistence details and lifecycle:
- Storage keys are namespaced by the agent id you pass when creating it (default in `App.tsx` is `AGENT_ID = 'agent-starter'`). The keys are:
  - `${id}:chat-history`
  - `${id}:chat-origin`
  - `${id}:model-name`
  - `${id}:todo-items`
  - `${id}:context-items`
- On mount, each atom attempts to load its previous value from `localStorage`. This makes chat, todos, model selection, and context items persist across page reloads.
- Starting a “new chat” (`NewChatButton` → `agent.reset()`):
  - Cancels any active request
  - Clears context items, todo list, and user action history
  - Resets `$chatHistory` to `[]`
  - Sets `$chatOrigin` to the current viewport’s top‑left so subsequent coordinates are offset against the new session
- Scheduled follow‑ups (`agent.schedule`) and todo‑driven turns happen within the same session until todos are finished or you call `reset()`.

Multi‑agent / multi‑session:
- The starter supports multiple agents per editor (see `$agentsAtom`). If you create two agents with different ids, each agent will persist to its own set of keys, effectively giving you separate sessions side‑by‑side.
- Disposing an agent removes it from `$agentsAtom`. Re‑creating an agent with the same id will reload its persisted atoms, restoring that session’s state.

Clearing persisted state:
- The error boundary UI (`ChatPanelFallback`) has a “Clear chat history” button that calls `localStorage.clear()` and reloads the page.
- You can also selectively remove only the five keys listed above to clear a single agent’s persisted data without wiping unrelated storage.

Server‑side persistence (optional recipe):
- The starter ships with client‑side persistence only. To persist sessions across browsers/devices, mirror these atoms on your backend:
  1) Listen for atom changes (the same place we call `localStorage.setItem`) and `POST` the updated values to your API with the agent id as a session key.
  2) On agent creation, fetch any existing server snapshot and `atom.set(snapshot)` before registering the `react(...)` saver.
  3) Store chat history items as an append‑only log (prompt/action/continuation) with a small index for latest cursor; store `$chatOrigin`, `$modelName`, `$todoList`, and `$contextItems` as key‑value blobs.
  4) For diff acceptance state, persist `acceptance` on each history item; on load, re‑apply accepted diffs or keep them as recorded and rely on the saved canvas document state.

Notes on privacy & scope:
- Everything in this starter persists locally only unless you implement the optional server sync. Screenshot data URLs are sent to your model provider during requests but are not stored by the agent code.

History UI:
- Action groups with accept/reject controls apply or revert recorded diffs (`TldrawDiffViewer` and ChatHistory components). This lets users curate the agent’s edits.

### 3.6 Integration system — provider/model flexibility

- Provider setup lives in `agent/worker/do/AgentService.ts` and `agent/worker/models.ts`.
- The active model is chosen per‑prompt with `getModelName(prompt)` which defers to the prompt parts (e.g., `ModelNamePartUtil`).
- Swapping providers or IDs requires changing `AGENT_MODEL_DEFINITIONS` and (optionally) any provider‑specific options passed to `streamText`.

Provider selection:
```ts
// agent/worker/models.ts (simplified)
export type AgentModelName = keyof typeof AGENT_MODEL_DEFINITIONS
export function getAgentModelDefinition(name: AgentModelName) { return AGENT_MODEL_DEFINITIONS[name] }
// agent/worker/do/AgentService.ts
getModel(modelName: AgentModelName): LanguageModel {
  const def = getAgentModelDefinition(modelName)
  return this[def.provider](def.id) // openai | anthropic | google
}
```

---
## 4) Custom shapes and windows (e.g., Python IDE)

Two options:

- Add an action so the model can create your custom window: Implement a tool (e.g., `open_python_ide_window`) and map it to an action util that creates a custom tldraw shape (e.g., type `window`) with props like `app: 'python-ide', url, sessionId`.
- Add your custom shape to the SimpleShape schema so the agent can read/edit/create it like any other shape.

Steps (schema route):
1) Define a `SimpleWindowShape` in your Simple shape union with required fields: `_type: 'window'`, `shapeId`, `note`, plus your custom props (`app`, `x`, `y`, `w`, `h`, etc.).
2) Add conversion logic:
   - tldraw → simple (read props and bounds)
   - simple → tldraw (set props, meta, and bounds)
3) Add an action util to create/update window shapes, or reuse `create`/`update` if the schema is included in the union.
4) Provide a Realtime tool `open_python_ide_window` that emits either `create` with `_type: 'window'` or a dedicated `_type` like `'openWindow'` if you prefer a custom action util.

Minimal example action mapping (tool → action):
```ts
// Tool name: open_python_ide_window
// Args: { x, y, w, h, url?: string }
// Map to agent action:
return {
  _type: 'create',
  intent: 'Open Python IDE',
  shape: {
    _type: 'window',
    shapeId: randomId(),
    note: '',
    x, y, w, h,
    app: 'python-ide',
    url,
  }
}
```

Tip: keep custom shape property names short, consistent, and lexically sorted to improve LLM reliability.

---

## 5) Offsets, rounding, and sanitization

- The agent offsets positions relative to the start of the chat so instructions remain relative to where the conversation began. Helpers:
  - `applyOffsetToVec/Box/Shape` before sending to the model
  - `removeOffsetFrom*` for incoming actions
- Rounding: `roundShape`, `roundAndSaveNumber`, `unroundShape`, etc. stabilize numeric content for the model.
- Sanitization: Each action util may fix/validate shape IDs and values. Example: `MoveActionUtil` ensures numeric `x/y` and an existing `shapeId`.

```33:49:agent/shared/actions/MoveActionUtil.ts
override sanitizeAction(action: Streaming<MoveAction>, helpers: AgentHelpers) {
	if (!action.complete) return action
	const shapeId = helpers.ensureShapeIdExists(action.shapeId)
	if (!shapeId) return null
	action.shapeId = shapeId
	const floatX = helpers.ensureValueIsNumber(action.x)
	const floatY = helpers.ensureValueIsNumber(action.y)
	if (floatX === null || floatY === null) return null
	action.x = floatX; action.y = floatY
	return action
}
```

---

## 6) System prompt and message construction

- System prompt is assembled from prompt parts and action utils. You can append content from any part util or action util.
```13:35:agent/worker/prompt/buildSystemPrompt.ts
export function buildSystemPrompt(prompt: AgentPrompt): string {
	const propmtUtils = getPromptPartUtilsRecord()
	const messages: string[] = []
	for (const part of Object.values(prompt)) {
		const propmtUtil = propmtUtils[part.type]
		const systemMessage = propmtUtil.buildSystemPrompt(part)
		if (systemMessage) messages.push(systemMessage)
	}
	const actionUtils = getAgentActionUtilsRecord()
	for (const actionUtil of Object.values(actionUtils)) {
		const systemMessage = actionUtil.buildSystemPrompt()
		if (systemMessage) messages.push(systemMessage)
	}
	return messages.join('')
}
```
- User/assistant messages are built from `AgentMessage[]`:
```6:19:agent/worker/prompt/buildMessages.ts
export function buildMessages(prompt: AgentPrompt): ModelMessage[] {
	const utils = getPromptPartUtilsRecord()
	const allMessages: AgentMessage[] = []
	for (const part of Object.values(prompt)) {
		const util = utils[part.type]
		const messages = util.buildMessages(part)
		allMessages.push(...messages)
	}
	allMessages.sort((a, b) => b.priority - a.priority)
	return toModelMessages(allMessages)
}
```

---

## 7) Minimal integration checklist (app integration)

- Frontend
  - Render tldraw and instantiate the agent (`useTldrawAgent`), wire up your UI events to `agent.prompt`.
  - Keep the agent’s `/stream` endpoint unchanged, or point it at your bridge.
  - Optionally hide the chat panel and control the agent from your own UI.

- Server/Bridge
  - Maintain a Realtime WS connection and surface tool calls.
  - Map tool calls → `AgentAction` and write them as SSE lines to the client.
  - Secure your API keys; don’t expose Realtime creds to the browser in production.

- Model
  - If you proxy to a different LLM/provider, keep payloads aligned with action schemas.
  - Seed the system prompt with short, clear rules (e.g., prefer smaller, atomic edits).

- Custom shapes
  - Add them to the Simple schema and conversions if you want the agent to fully read/update them.
  - Or expose them behind specific tools that map to `create`/`update` actions.

---

## 8) Troubleshooting

- The agent “can’t control the whiteboard well”
  - Ensure your tools produce payloads that match action schemas. Validate IDs and numbers.
  - Provide `bounds` on each `agent.prompt` so the screenshot and viewport data are meaningful.
  - Prefer small, atomic actions (create → move → label) rather than giant combined updates.

- Latency or jitter
  - Send partial actions (`complete:false`) for responsiveness, then finalize.
  - Keep the screenshot scale reasonable (the code auto-caps very large bounds).

- ID mismatches
  - Use `AgentHelpers.ensureShapeIdExists/IsUnique` patterns in your mapping if you pre-assign IDs.

---

## Appendix A — Action payload shapes (high level)

- create: `{ _type:'create', intent?:string, shape: SimpleShape }`
- update: `{ _type:'update', intent?:string, update: SimpleShape }`
- delete: `{ _type:'delete', intent?:string, shapeId: string }`
- move: `{ _type:'move', intent?:string, shapeId:string, x:number, y:number }`
- label: `{ _type:'label', intent?:string, shapeId:string, text:string }`
- align: `{ _type:'align', intent?:string, alignment:'top'|'bottom'|'left'|'right'|'center-horizontal'|'center-vertical', gap:number, shapeIds:string[] }`
- resize: `{ _type:'resize', intent?:string, originX:number, originY:number, scaleX:number, scaleY:number, shapeIds:string[] }`
- rotate: `{ _type:'rotate', intent?:string, degrees:number, originX:number, originY:number, centerY:number, shapeIds:string[] }`
- setMyView: `{ _type:'setMyView', intent?:string, x:number, y:number, w:number, h:number }`
- pen: `{ _type:'pen', intent?:string, style:'smooth'|'straight', color:string, fill:'none'|'semi'|'solid', points:{x:number,y:number}[], closed?:boolean }`

Refer to the Zod definitions in `agent/shared/actions/*` for exact shapes.

---

## Appendix B — Prompt parts included

- messages, data, contextItems, screenshot, viewportBounds, blurryShapes, peripheralShapes, selectedShapes, chatHistory, userActionHistory, todoList, time, modelName, system.

---

## TL;DR quick start

1) Use the `agent/` starter as-is to validate the end-to-end loop.
2) Add a Realtime bridge that outputs SSE `Streaming<AgentAction>` to `/stream`.
3) Map your tools to action payloads (start with create/move/update/delete/label/pen/setMyView).
4) Add custom window shapes to the Simple schema (or a dedicated action) for your Python IDE.
5) Drive the agent with voice transcripts: call `agent.prompt({ message: transcript, bounds })` each turn.

If you follow these steps, you can recreate the project with a voice-first UI and custom windows.

---

## Appendix C — Optional: Voice/WebRTC OpenAI Realtime bridge

If you want a voice agent, keep the whiteboard agent unchanged and add a server bridge that translates Realtime tool calls into the same `AgentAction` stream the frontend already expects.

Outline:
- Maintain a Realtime WebSocket to OpenAI and handle audio in/out
- On tool/function calls, convert `{ name, arguments }` to one of the existing action payloads
- Write them to the browser as SSE lines: `data: { ...AgentAction, complete, time }\n\n`

See the example bridge and tool‑to‑action mapping earlier in this document (previously Sections 3–4). Keep payloads aligned with the Zod schemas in `agent/shared/actions/*` and prefer small, atomic actions for smooth live updates.
