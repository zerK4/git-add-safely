# git-add-safely

Git add wrapper with secret scanning and an AI code review UI.

## Install

```bash
# Run without installing
bunx git-add-safely --watch

# Install globally
bun install -g git-add-safely
```

Requires [Bun](https://bun.sh) — does not run on Node.

## Modes

### Default — scan and stage (CLI)

```bash
git-add-safely .
git-add-safely src/auth.ts
```

Runs `git add`, scans staged files for secrets, prompts in terminal if anything is found.

### `--ui` — visual approval in browser

```bash
git-add-safely . --ui
```

Opens a web UI showing the diff. You approve or cancel staging from the browser.

### `--watch` — live review UI

```bash
git-add-safely --watch
```

Long-running server that opens a full UI at `https://project.git.studio` (or `http://127.0.0.1:<port>` with `--no-domain`).

Features:
- Browse staged and unstaged diffs
- Stage / unstage files
- Write **inline notes** on any diff line — saved to `.git-notes/`
- Trigger **AI code review** per file or across all staged files
- Notes are automatically included as context in AI reviews
- Generate commit messages with AI
- Manage git stashes
- Interact with GitHub PRs (view, comment, reply)

## Options

```
--force         Skip all security checks
--ui            Open web UI for approval
--watch         Live review UI server
--no-domain     Use http://127.0.0.1:<port> (skip /etc/hosts setup)
--http-only     Use http://project.git.studio (skip HTTPS proxy)
--port <n>      Use specific port (default: random free port)
-v, --version   Show version
-h, --help      Show help
```

## Secret scanning

Scans staged files for:
- AWS / GCP / Azure credentials
- Private keys (RSA, DSA, EC)
- API tokens (GitHub, Slack, Discord, Stripe, SendGrid, etc.)
- Dangerous filenames (`.env`, `.pem`, `.key`, `credentials.json`, etc.)

Test files get lighter treatment — only high-confidence patterns trigger.

## AI code review

In `--watch` mode, open any file and click **Review with Claude** (or **Review all**) in the toolbar. Requires an AI provider configured in the settings UI (Anthropic, OpenAI, Google, or any OpenAI-compatible endpoint).

API keys are stored in `~/.git-add-safely/settings.json` — never in the repo.

## Inline review notes

Click any diff line in `--watch` mode to add a markdown note. Notes are:
- Saved to `.git-notes/` (gitignored automatically)
- Shown inline in the diff
- Included as context when you run an AI review

## Configuration

Optional `.git-safely.json` in project root:

```json
{
  "plugins": {
    "web-ui": {
      "enabled": true,
      "config": {
        "autoOpen": true,
        "port": 3450
      }
    }
  }
}
```

## ZSH integration

To intercept `git add` automatically, add to `~/.zshrc`:

```zsh
git() {
  if [[ $1 == "add" ]]; then
    git-add-safely "${@:2}"
  else
    command git "$@"
  fi
}
```

See [SETUP.md](./SETUP.md) for full shell integration instructions.

## Development

```bash
bun install
bun run build       # builds UI + CLI → dist/
bun dist/index.js . # test locally
```
