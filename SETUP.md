# Setup Instructions for git-add-safely

## Installation

### 1. Install the tool globally

```bash
cd /path/to/git-add-safely
bun install
bun run build
npm link  # or: bun link
```

Verify installation:
```bash
which git-add-safely
# Should output: /Users/yourusername/.bun/bin/git-add-safely (or similar)
```

### 2. Configure ZSH plugin

Create the plugin directory:
```bash
mkdir -p ~/.zsh/plugins/git-safety
```

Create the plugin file `~/.zsh/plugins/git-safety/git-safety.plugin.zsh`:

```zsh
#!/bin/zsh
# Git Safety Plugin for ZSH - v2.0
# Uses git-add-safely TypeScript tool for improved secret detection

# Plugin metadata
GIT_SAFETY_VERSION="2.0.0"
GIT_SAFETY_TOOL="git-add-safely"

# Override git function to intercept 'git add'
git() {
    if [[ $1 == "add" ]]; then
        # Call git-add-safely with all arguments except 'add'
        $GIT_SAFETY_TOOL "${@:2}"
    else
        # For all other git commands, use the real git
        command git "$@"
    fi
}

# Alias for force adding without checks
alias gaf='git add . --force'

# Plugin info command
alias git-safety-info='echo "Git Safety Plugin v$GIT_SAFETY_VERSION using $GIT_SAFETY_TOOL"'

# Success message (only if debug mode is on)
if [[ -n "$GIT_SAFETY_DEBUG" ]]; then
    echo "✅ Git Safety Plugin v$GIT_SAFETY_VERSION loaded (using git-add-safely)"
fi
```

### 3. Load the plugin in ~/.zshrc

Add to your `~/.zshrc`:

```zsh
# Git Safety Plugin
GIT_SAFETY_DEBUG=false  # Set to true for debug output
source ~/.zsh/plugins/git-safety/git-safety.plugin.zsh
```

### 4. Reload your shell

```bash
source ~/.zshrc
```

Or restart your terminal.

## Usage

Now `git add` will automatically use `git-add-safely`:

```bash
git add .                    # Scans for secrets
git add src/config.ts        # Scans specific file
git add . --force            # Skip all checks
gaf                          # Alias for git add . --force
```

## Verification

Test that everything works:

```bash
# Check plugin is loaded
git-safety-info

# Test with a file
echo 'const AWS_KEY = "AKIAIOSFODNN7EXAMPLE"' > test.js
git add test.js
# Should detect AWS Access Key

rm test.js
```

## Troubleshooting

### Command not found: git-add-safely

Make sure the tool is in your PATH:
```bash
which git-add-safely
echo $PATH | grep bun  # or grep npm
```

If not found, try:
```bash
cd /path/to/git-add-safely
npm link --force
```

### Plugin not loading

Check if the plugin file exists:
```bash
cat ~/.zsh/plugins/git-safety/git-safety.plugin.zsh
```

Check if it's sourced in ~/.zshrc:
```bash
grep "git-safety" ~/.zshrc
```

### Enable debug mode

Set in ~/.zshrc:
```zsh
GIT_SAFETY_DEBUG=true
```

Then reload:
```bash
source ~/.zshrc
```

## Backup old plugin

The old bash-based plugin is backed up at:
```
~/.zsh/plugins/git-safety/git-safety.plugin.zsh.backup
```

To restore it:
```bash
cp ~/.zsh/plugins/git-safety/git-safety.plugin.zsh.backup \
   ~/.zsh/plugins/git-safety/git-safety.plugin.zsh
source ~/.zshrc
```
