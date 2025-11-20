# IDE Tools and Execution (Monaco + Pyodide)

This document describes the IDE capabilities exposed to the agent and the UI in the test app.

**Related docs:**
- [Realtime Agent](realtime-agent.md) — Tool registry and agent setup
- [Test App Guide](test-app.md) — UI and controls

## Overview
- Editor: Monaco under the Code tab
- Runner: Python-only via Pyodide (in-browser)
- Output panel: aggregated stdout/stderr/info
- Language selector changes the editor language; Run only executes when language is Python

## Available IDE Tools

Only the following tools are registered by the test app (see `app/test-app/agent/tools/ide.ts`):

**`ide_get_context()`**
- Returns JSON string: `{ files: Array<{ name, language, size }>, active?: string }`
- Lists all files in workspace and identifies the active file

**`ide_read_code()`**
- Returns JSON string: `{ name, language, content }` for the active file
- Use this to read the current buffer before making edits

**`ide_apply_edits({ edits })`**
- Applies precise edits to the active file
- Supports two edit types:
  - **Char-range:** `{ type: "char", range: { start, end }, text }`
  - **Line-range:** `{ type: "line", range: { startLine, endLine }, text }`
- Returns summary with number of edits applied

**`ide_run_active()`**
- Runs the active file if language is Python
- Returns ToolResult with `data` as JSON: `{ stdout, stderr, info }`
- If language is not Python, returns error message: "Run currently supports Python only. Switch language to Python to execute."

> **Note:** Multi-file management helpers (`ide_create_file`, `ide_set_active`, `ide_update_content`) exist internally but are not exposed via the tool registry. The agent works with a single active file buffer.

## Recommended Workflow

For single-file, in-memory editing:

1. **Read** the current buffer with `ide_read_code()`
2. **Edit** by applying precise diffs with `ide_apply_edits({ edits })` using char or line ranges
3. **Run** with `ide_run_active()` when the language is Python

> **Limitation:** The agent edits the in-memory buffer only; there is no file persistence. Do not attempt to create or switch files.

## Python Execution Details

- **Runtime:** Pyodide v0.26 (loaded once by `app/test-app/lib/pyodide.ts`)
- **Output capture:** Stdout/stderr are captured and aggregated into the tool return payload
- **UI display:** Outputs also appear in the bottom Output panel with timestamped lines

## UI Quick Reference

- **Language selector:** Choose Python to enable Run button
- **Run button (▶):** Executes the active Python file; shows progress and displays aggregated output on completion
- **Output panel:** Toggle visibility; includes timestamped lines per channel (stdout/stderr/info)

## Limitations

- **Language support:** Only Python execution is supported
- **Persistence:** Edits operate on the current in-memory buffer; there is no persistence layer
- **Multi-file:** Single active file only; file creation/switching not exposed to agent
