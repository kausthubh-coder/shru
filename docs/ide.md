# IDE Tools and Execution (Monaco + Pyodide)

This document describes the IDE capabilities exposed to the agent and the UI in the session workspace.

**Related docs:**
- [Realtime Agent](realtime-agent.md) — Tool registry and agent setup
- [Architecture](architecture.md) — Session flow

## Overview
- Editor: Monaco under the Code tab in `components/session/SessionWorkspace.tsx`
- Runner: Python-only via Pyodide (in-browser) loaded by `lib/pyodide.ts`
- Output panel: aggregated stdout/stderr/info
- Language selector changes editor language; Run executes only when language is Python

## Available IDE Tools (`components/session/agent/tools/ide.ts`)

**`ide_get_context()`**
- Returns JSON: `{ files: Array<{ name, language, size }>, active?: string }`

**`ide_read_code()`**
- Returns JSON: `{ name, language, content }` for the active file

**`ide_apply_edits({ edits })`**
- Precise edits on active file
  - Char-range: `{ type: "char", range: { start, end }, text }`
  - Line-range: `{ type: "line", range: { startLine, endLine }, text }`
- Returns summary with count

**`ide_run_active()`**
- Runs active file if language is Python
- Returns `{ stdout, stderr, info }` (as JSON in ToolResult.data)
- If not Python, returns info message to switch language

**`ide_create_file({ name, language, content })`**
- Creates a new file in workspace and selects it

**`ide_set_active({ name })`**
- Switches active file by name

**`ide_update_content({ content })`**
- Replaces active file content

## Recommended Agent Workflow

1. `ide_get_context` to see files + active file
2. `ide_set_active` (optional) to pick a file
3. `ide_read_code` to fetch current buffer
4. `ide_apply_edits` (char/line) to change code
5. `ide_run_active` (Python only) to execute

> Files are stored per session in Convex (`ide_sessions`). The agent works against the in-memory buffer shown in the UI; saves propagate via `spaces.updateIde`.

## Python Execution Details

- **Runtime:** Pyodide v0.26 (loaded once by `lib/pyodide.ts`)
- **Output capture:** Stdout/stderr captured and aggregated into tool payload and UI console
- **UI display:** Output panel with timestamped lines; toggled in the Code tab

## UI Quick Reference

- **Language selector:** Choose Python to enable Run
- **Run button (▶):** Executes active Python file; shows progress and updates Output panel
- **Output panel:** Toggle visibility; includes stdout/stderr/info channels

## Limitations

- **Language support:** Only Python execution
- **Multi-file:** Multiple files allowed; active file chosen by name
- **Persistence:** Stored per session in Convex; no cross-session sharing
