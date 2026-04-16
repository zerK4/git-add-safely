# Setup

## 1. Install

```bash
bun install -g git-add-safely
```

Verify:
```bash
which git-add-safely
git-add-safely --version
```

## 2. ZSH integration (optional)

Intercepts `git add` automatically so you don't have to change your workflow.

Add to `~/.zshrc`:

```zsh
git() {
  if [[ $1 == "add" ]]; then
    git-add-safely "${@:2}"
  else
    command git "$@"
  fi
}
```

Reload:
```bash
source ~/.zshrc
```

Now `git add .` runs through git-add-safely automatically.

## 3. Verify

```bash
# Should detect AWS key
echo 'const AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"' > /tmp/test-secret.js
git add /tmp/test-secret.js
rm /tmp/test-secret.js
```

## Usage

```bash
git add .                        # Scan and stage (CLI prompt if secrets found)
git add . --ui                   # Scan and stage with browser approval UI
git add . --force                # Skip all checks
git-add-safely --watch           # Open live review UI
git-add-safely --watch --no-domain  # Watch mode on http://127.0.0.1:<port>
```

## Troubleshooting

### Command not found

Check Bun's bin directory is in PATH:
```bash
echo $PATH | tr ':' '\n' | grep bun
```

If missing, add to `~/.zshrc`:
```zsh
export PATH="$HOME/.bun/bin:$PATH"
```

Then reinstall:
```bash
bun install -g git-add-safely
```

### ZSH function not intercepting git add

Make sure the function is defined **after** any plugin managers (oh-my-zsh, zinit, etc.) in `~/.zshrc` — plugins can override the `git` function too.

Check it's active:
```bash
type git
# Should show: git is a shell function
```
