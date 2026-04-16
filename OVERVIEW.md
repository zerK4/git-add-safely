# git-add-safely

A CLI tool that wraps `git add` with secret detection and an interactive web UI for reviewing staged changes before committing.

## What it does

1. Runs `git add` normally
2. Scans staged files for sensitive patterns (API keys, private keys, tokens, dangerous filenames)
3. Opens a web UI for review — or prompts in CLI if no `--ui` flag
4. User approves or cancels; problematic files get unstaged if rejected

## Usage

```bash
git-add-safely .                  # add all, scan, prompt in CLI
git-add-safely . --ui             # add all, scan, open web UI
git-add-safely src/config.ts      # add specific file
git-add-safely . --force          # skip all checks
```

## Build

```bash
bun run build         # build UI (Svelte → dist/ui/) + CLI (src/ → dist/index.js)
bun run build:ui      # UI only
bun run build:cli     # CLI only
bun run dev           # Vite dev server for UI (proxies /api/* to Bun on :3450)
```

## Architecture

```
git-add-safely/
├── src/                          # CLI — TypeScript, runs in Bun
│   ├── index.ts                  # Entry point: arg parsing, orchestration
│   ├── core/
│   │   ├── scanner.ts            # SecretScanner: filename + content pattern matching
│   │   └── plugin-loader.ts      # Plugin lifecycle: beforeScan → afterScan → beforeAdd → afterAdd
│   ├── plugins/
│   │   └── web-ui.ts             # Bun HTTP server: serves dist/ui/ + /api/* endpoints
│   ├── patters/
│   │   ├── content-patterns.ts   # 30+ regex patterns (AWS, GCP, Azure, private keys...)
│   │   └── file-patterns.ts      # 100+ dangerous filename patterns
│   └── types/plugin.ts           # Plugin, FileStatus, ScanResult, PluginContext interfaces
│
├── ui/                           # Web UI — Svelte 5 + Vite + Tailwind + shadcn-svelte
│   └── src/
│       ├── App.svelte            # Root layout, loads context on mount
│       ├── lib/
│       │   ├── types.ts          # Mirrored types + diff types (ParsedDiff, DiffLine, SplitRow)
│       │   ├── api/client.ts     # fetch wrappers: fetchContext, fetchDiff, postApprove, postCancel
│       │   ├── diff/parser.ts    # Unified diff string → hunks/lines; toSplitRows() for split view
│       │   ├── stores/
│       │   │   └── app.svelte.ts # All reactive state (Svelte 5 runes), exported via `store` object
│       │   └── features/
│       │       ├── Header.svelte
│       │       ├── Sidebar.svelte        # Files grouped by directory, A/M/D/R badges
│       │       ├── FileItem.svelte
│       │       ├── MainArea.svelte       # WarningsPanel or DiffView depending on selection
│       │       ├── DiffView.svelte       # Unified/Split toggle, hunk rendering
│       │       ├── DiffLine.svelte       # Unified mode line + inline note button
│       │       ├── SplitDiffLine.svelte  # Split mode row + inline note button
│       │       ├── InlineNote.svelte     # CodeMirror 6 markdown editor, inline below line
│       │       ├── WarningsPanel.svelte  # Scan results display
│       │       └── Footer.svelte         # Approve / Cancel buttons
│
├── dist/
│   ├── index.js                  # Compiled CLI bundle
│   └── ui/                       # Compiled Svelte app (served by Bun)
│
├── .git-safely.json              # Per-repo plugin config (enables web-ui, sets port)
└── CLAUDE.md                     # Codebase guide for Claude Code
```

## API endpoints (Bun server, port 3450)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Serves `dist/ui/index.html` |
| `GET` | `/assets/*` | Static assets |
| `GET` | `/api/context` | Returns `PluginContext` + `repoName` |
| `GET` | `/api/diff?file=<path>` | Raw unified diff for a staged file |
| `POST` | `/api/approve` | Approves and unblocks CLI |
| `POST` | `/api/cancel` | Cancels and unstages flagged files |

## Plugin system

Plugins implement the `Plugin` interface and hook into the scan lifecycle:

```
beforeScan(files[]) → afterScan(context) → beforeAdd(context) → afterAdd(context)
```

Config in `.git-safely.json`:

```json
{
  "plugins": {
    "web-ui": {
      "enabled": true,
      "config": { "autoOpen": true, "port": 3450 }
    }
  }
}
```

## Web UI features

- **Sidebar** — staged files grouped by directory, color-coded status badges (A/M/D/R), warning indicator on sensitive files
- **Diff view** — unified and split modes with toggle, hunk headers, line numbers
- **Inline notes** — hover any diff line → `+` button appears → CodeMirror markdown editor opens inline (GitHub PR style)
- **Warnings panel** — shown when no file selected; lists all detected sensitive patterns with file:line and content

## Roadmap

- [ ] Export inline notes to a `.git-safely-review.md` file in the repo on approve
- [ ] Syntax highlighting in diff view per file extension
- [ ] Note persistence across file switches within a session
- [ ] ZSH plugin integration docs
