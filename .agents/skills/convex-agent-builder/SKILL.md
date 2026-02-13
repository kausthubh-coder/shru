---
name: convex-agent-builder
description: Build, refactor, and debug AI features using the Convex Agent component in Next.js + Convex projects. Use when requests involve Agent setup, thread/message lifecycle, tool calling, streaming responses, RAG context retrieval, workflow orchestration, usage tracking, file/image handling, or Playground-based debugging with @convex-dev/agent.
---

# Convex Agent Builder

## Overview

Implement Convex Agent features with reliable, production-safe patterns.
Use bundled references to select the smallest correct pattern for the current task.

## Workflow

1. Classify the request and open only the matching references.
2. Choose the minimal architecture that satisfies the request.
3. Implement with Convex-safe patterns and explicit validation.
4. Verify behavior through queries, streaming surfaces, and error paths.
5. Summarize what changed and any operational follow-ups.

## Reference Routing

Open these files from `references/` based on task type:

- Setup and first integration: `getting-started.md`
- Agent options and generation patterns: `agent-usage.md`
- Thread lifecycle and prompt/response flow: `threads.md`, `messages.md`
- Context control and search behavior: `llm-context.md`
- Tool definitions and tool-context patterns: `tools.md`
- Streaming via deltas and UI hooks: `streaming.md`
- RAG with prompt-based or tool-based retrieval: `rag.md`
- File and image attachment flows: `files.md`
- Durable multi-step execution: `workflows.md`
- Usage accounting and billing hooks: `usage-tracking.md`
- Playground setup and debugging loops: `playground.md`, `debugging.md`

## Implementation Rules

- Use `@convex-dev/agent` primitives directly (`Agent`, `createThread`, `saveMessage`, `generateText`, `streamText`, `createTool`, `listUIMessages`, `syncStreams`).
- Prefer mutation-first prompt persistence and asynchronous action generation for retry safety.
- Use `promptMessageId` when regenerating or resuming partial generations.
- Keep thread authorization explicit before listing or generating messages.
- For tools, provide strict Zod args with `.describe(...)` and explicit handler return types.
- Use `stopWhen`/`maxSteps` greater than 1 when tool calls should auto-continue.
- For streaming UIs, save stream deltas and read through `useUIMessages(..., { stream: true })`.
- For RAG, start with prompt-injected context for deterministic behavior; switch to tool-based retrieval when dynamic exploration is needed.
- Track usage through `usageHandler` and persist records for cost reporting where required.
- Prefer IDs over large payloads in workflow steps to stay within workflow bandwidth limits.

## Delivery Checklist

- Confirm component installation and generated `components.agent` bindings are present.
- Confirm message retrieval query supports the UI mode (plain or streaming).
- Confirm failures in tool calls and actions are surfaced with actionable errors.
- Confirm changed code follows project-level Convex function conventions.
- Confirm docs/comments point to the reference file used for non-obvious decisions.
