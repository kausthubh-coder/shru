# Safe Feature Branch from Dev (checks everything first)

Create a new feature branch **safely** by running a full set of checks first. This is designed to be safe to run from **any starting branch**.

**Behavior contract**
- **Do not** make any mutating git changes (no checkout/switch, pull, merge, rebase, reset, stash) until **all checks pass**.
- If **any check fails**, stop and **only report**: what failed, why it matters, and the exact command(s) to fix it.
- If **all checks pass**, then create the new feature branch from `origin/dev` (preferred) or `dev` if appropriate.

## Workflow

## Inputs

- **Required**: feature name (kebab-case recommended), passed after the command.
  - Example: `/feature-branch user-authentication`

If overrides are omitted, assume `remote=origin`, `base=dev`, `main=main`.

## Checks (read-only)

### Step 0: Confirm we're in a git repo and capture context
```bash
git rev-parse --is-inside-work-tree
git rev-parse --show-toplevel
git branch --show-current
git status --porcelain=v1 -b
git remote -v
```

Fail conditions (stop + report):
- Not inside a git work tree
- Detached HEAD (no branch name)
- No remotes configured
- Working tree not clean (any output besides the branch line in `git status --porcelain=v1 -b`)

### Step 1: Fetch remote refs (safe)
```bash
git fetch --prune origin
```

Fail conditions (stop + report):
- `refs/remotes/origin/main` missing
- `refs/remotes/origin/dev` missing

### Step 3: Ensure `origin/dev` and `origin/main` are fully in sync
```bash
git rev-list --left-right --count origin/main...origin/dev
```

This prints two numbers: `<ahead_of_main> <ahead_of_dev>`.
- If it prints `0 0`, `origin/dev` and `origin/main` point to the same commit (fully in sync).
- Otherwise, **fail** and report the counts. (Per your request: don’t proceed if they differ.)

## Action (only if ALL checks pass)

### Step 4 Create the feature branch from the synced base
Preferred (does not depend on local `dev`):

```bash
git switch -c "feature/<feature-name>" "origin/dev"
```

Replace `<feature-name>` with a descriptive kebab-case name for the feature being built.

## Parameters

The feature name should be provided after the command:
- `/feature-branch user-authentication`
- `/feature-branch payment-integration`
- `/feature-branch dashboard-redesign`
