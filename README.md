# git-add-safely

A Git plugin that scans staged files for sensitive information (API keys, passwords, secrets) before committing.

## Features

- 🔍 Scans for sensitive patterns (AWS keys, API tokens, private keys, passwords, etc.)
- 🎯 Context-aware detection to reduce false positives
- 🧪 Smart test file handling - more lenient with test/mock data
- ⚡ Fast scanning with detailed reporting
- 🛡️ Prevents accidental commits of secrets

## Quick Start

1. **Install globally**:
   ```bash
   bun install && bun run build && npm link
   ```

2. **Setup ZSH plugin** (auto-runs on `git add`):
   ```bash
   # See SETUP.md for detailed instructions
   source ~/.zsh/plugins/git-safety/git-safety.plugin.zsh
   ```

3. **Use normally**:
   ```bash
   git add .              # Automatically scans
   git add . --force      # Skip checks
   ```

See [SETUP.md](./SETUP.md) for complete installation instructions.

### Options

- `--force` - Skip all security checks

### Example Output

```
✨ Staged files:
src/config.ts
src/api/client.ts

🔎 Scanning for sensitive information…
⚠️  [AWS Secret Key] detected in src/config.ts:12: const AWS_SECRET = "wJalrX..."

🚨 Potential sensitive data detected!
📄 Files with sensitive content: src/config.ts
❓ Do you want to continue anyway? [y/N]:
```

## Improvements (v2)

### Reduced False Positives

- **Context-aware patterns**: Patterns now require assignment operators (`:`, `=`) and variable names
- **Removed overly broad patterns**: Phone numbers, credit cards, and private IPs removed
- **Test file handling**: Test files are treated more leniently (only high-confidence patterns trigger)

### Pattern Improvements

| Pattern | Before | After |
|---------|--------|-------|
| AWS Secret Key | Any 40-char string | Must have `secret_key =` context |
| Azure Client Secret | Any 34-40 char string | Must have `client_secret =` context |
| PayPal IDs | Any 80-char string | Must have `paypal_client_id =` context |

### Test File Detection

Files matching these patterns are treated as test files:
- `*.test.{ts,js,tsx,jsx,php}`
- `*.spec.{ts,js,tsx,jsx,php}`
- Files in `/tests/`, `/__tests__/`, `/spec/` directories
- `*Test.{php,java,cs,py}`

## Development

Built with [Bun](https://bun.sh) - a fast all-in-one JavaScript runtime.

```bash
bun install          # Install dependencies
bun run build        # Build to dist/
node dist/index.js . # Test locally
```
