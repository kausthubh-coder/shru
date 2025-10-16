# IDE Overhaul Plan

Goals
- Full-screen IDE experience: editor + bottom output panel
- Multi-file workspace with file tree and active tab (WIP)
- Execute code via Pyodide for Python (present). Judge0 service wrapper (planned) for multi-language execution
- Persist files/results with Convex (planned)

Current state
- Single active file with language selector; Python executes via Pyodide (`app/test-app/lib/pyodide.ts`)
- Output panel shows stdout/stderr/info; Run is Python-only
- Agent tools exist for creating files, setting active, and updating content

UI/UX
- IDE layout under the "Code" tab
- Regions:
  - Editor (fills page)
  - Output panel (dockable bottom pane)
- Toolbar: language dropdown + Run + toggle Output
- Consistent dark theme, accessible controls, subtle borders

State model (client)
- files: Array<{ id, name, language, content }>
- activeFileId: string
- runState: { running: boolean }

Execution
- Python: Pyodide in browser (`loadPyodideOnce` in `app/test-app/lib/pyodide.ts`)
- Future: Judge0 wrapper
  - Submit: POST source + language + stdin → token
  - Poll: GET result by token until done → stdout/stderr/time/memory
  - Map Monaco language to Judge0 languageId; sanitize inputs; cap size/time

Convex schema additions (draft)
- table: ide_files { userId?, name, language, content, folder? }
- table: ide_runs { userId?, fileId, languageId, token, status, stdout, stderr, createdAt }

Agent tools
- ide_create_file(name, language, content)
- ide_set_active(name)
- ide_update_content(content)
- ide_get_context() → summary of files, active, sizes
- (planned) ide_run_active_via_judge0() → enqueues run and streams/polls results

Milestones
1) Full-screen layout and Python-only run (Pyodide)
2) Add file tree and multiple files
3) Integrate Judge0 submit+poll
4) Persist files and runs in Convex; file tree CRUD
5) Extend to multiple languages
