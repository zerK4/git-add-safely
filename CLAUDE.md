# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install                 # Install deps
bun run build               # Compile src/ → dist/ (node target)
node dist/index.js .        # Test locally after build
npm link                    # Install globally as `git-add-safely`
```

No test suite configured. Validate by running `node dist/index.js` against a test repo.

## Architecture

**What it is:** CLI tool wrapping `git add`. Stages files, scans for secrets, prompts user to approve or unstage. Optional React web UI for interactive review.

**Execution flow:**
1. `src/index.ts` — parse args → spawn `git add` → get staged files
2. `PluginLoader` runs hooks: `beforeScan` → scan → `afterScan` → `beforeAdd` → `afterAdd`
3. `SecretScanner` — two-pass scan (filename patterns, then content regex)
4. User approves via readline or web UI → unstage rejected files

**Key modules:**

| File | Role |
|------|------|
| `src/index.ts` | Entry point, CLI arg parsing, orchestration |
| `src/core/scanner.ts` | `SecretScanner` — scans staged files, skips test/doc files |
| `src/core/plugin-loader.ts` | `PluginLoader` — loads `.git-safely.json`, manages plugin lifecycle |
| `src/plugins/web-ui.ts` | `WebUIPlugin` — Bun HTTP server + React UI at port 3450 |
| `src/patters/content-patterns.ts` | 30+ regex patterns (AWS, GCP, Azure, private keys, tokens) |
| `src/patters/file-patterns.ts` | 100+ dangerous filename patterns (.env, .pem, .key, etc.) |
| `src/types/plugin.ts` | `Plugin`, `PluginHooks`, `PluginContext`, `ScanResult` interfaces |

**Plugin system:** External plugins implement `Plugin` interface, registered in `.git-safely.json`. Hooks execute in order. `WebUIPlugin` uses `afterScan` hook, serves UI, resolves a Promise on `/api/approve` or `/api/cancel`.

**Config file:** `.git-safely.json` at repo root — enables/configures plugins.

## Plugin Interface

```typescript
interface Plugin {
  name: string;
  version: string;
  hooks: {
    beforeScan?: (files: string[]) => Promise<string[]>;
    afterScan?: (ctx: PluginContext) => Promise<PluginContext>;
    beforeAdd?: (ctx: PluginContext) => Promise<boolean>;
    afterAdd?: (ctx: PluginContext) => Promise<void>;
  };
  init?: (config?: Record<string, any>) => Promise<void>;
  cleanup?: () => Promise<void>;
}
```

## Notes

- Runtime is **Bun**, not Node — use `bun` for dev, but build target is `node` for distribution
- ZSH plugin wraps `git add` command — see `SETUP.md` for shell integration
- `src/patters/` has a typo in dirname (not `patterns`) — match existing spelling when adding files
