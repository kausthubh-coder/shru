# IDE tools and run (Monaco + Pyodide)

This document describes the IDE capabilities exposed to the agent and the UI in the test app.

## Overview
- Editor: Monaco under the Code tab
- Runner: Python-only via Pyodide (in-browser)
- Output panel: aggregated stdout/stderr/info
- Language selector changes the editor language; Run only executes when language is Python

## Available IDE tools
Only the following tools are registered by the test app:

- ide_get_context()
  - Returns JSON string of `{ files: Array<{ name, language, size }>, active?: string }`.

- ide_read_code()
  - Returns JSON string `{ name, language, content }` for the active file.

- ide_apply_edits({ edits })
  - Applies precise edits to the active file. Two edit forms:
    - Char-range: `{ type: "char", range: { start, end }, text }`
    - Line-range: `{ type: "line", range: { startLine, endLine }, text }`
  - Summary reports the number of edits applied.

- ide_run_active()
  - Runs the active file if its language is Python.
  - Returns a ToolResult with `data` as JSON string `{ stdout, stderr, info }`.
  - When the active language is not Python, it returns `{ stdout: "", stderr: "", info: ["Run currently supports Python only. Switch language to Python to execute."] }`.

Multi-file management helpers exist internally (create/set active/update content) but are not exposed via the tool set above.

## Execution details (Python)
- Runtime: Pyodide v0.26 (loaded once by `app/test-app/lib/pyodide.ts`).
- Stdout/stderr are captured and aggregated into the return payload.
- The UI also mirrors outputs in the bottom Output panel and preserves recent lines.

## UI quick reference
- Language: choose Python to enable Run.
- Run ▶: executes the active Python file; shows progress and streams aggregated output on completion.
- Output panel: toggle visibility; includes timestamped lines per channel.

## Limitations
- Only Python execution is supported at the moment.
- Edits operate on the current in-memory buffer; there is no persistence layer.
