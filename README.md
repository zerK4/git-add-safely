# git-add-safely

A Git plugin that scans staged files for sensitive information (API keys, passwords, secrets) before committing.

## Features

- 🔍 Scans for sensitive patterns (AWS keys, API tokens, private keys, passwords, etc.)
- 🎯 Context-aware detection to reduce false positives
- 🧪 Smart test file handling - more lenient with test/mock data
- ⚡ Fast scanning with detailed reporting
- 🛡️ Prevents accidental commits of secrets
- 🌐 **NEW!** Interactive Web UI for reviewing changes
- 🔌 **NEW!** Plugin system - extend with custom functionality

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
- `--no-ui` - Disable web UI (use CLI only)

### Web UI Mode (New in v3!)

By default, git-add-safely opens an interactive web UI:

```bash
git add .
# → Opens http://localhost:3450 with:
#   - File list with status badges
#   - Syntax-highlighted warnings
#   - Approve/Cancel buttons
```

**Configure in `.git-safely.json`:**
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

### Example Output (CLI mode)

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

## Plugin System

git-add-safely v3+ includes a powerful plugin system. See [PLUGINS.md](./PLUGINS.md) for full documentation.

### Creating a Plugin

```typescript
import type { Plugin } from "git-add-safely/types";

export class MyPlugin implements Plugin {
  name = "my-plugin";
  version = "1.0.0";

  hooks = {
    afterScan: async (context) => {
      // Your custom logic here
      console.log("Files:", context.stagedFiles);
      return context;
    },
  };
}
```

### Built-in Plugins

- **web-ui** - Interactive web interface for reviewing changes
- More coming soon! (AI commit messages, auto-format, code review)

See [PLUGINS.md](./PLUGINS.md) for:
- Plugin API documentation
- Hook reference
- Configuration options
- Custom plugin examples

## Development

Built with [Bun](https://bun.sh) - a fast all-in-one JavaScript runtime.

```bash
bun install          # Install dependencies
bun run build        # Build to dist/
node dist/index.js . # Test locally
```

## Changelog

### v3.0.0 (2026-01-29)
- ✨ Added Web UI plugin with interactive interface
- 🔌 Introduced plugin system architecture
- 📦 Modular design - enable only what you need
- 🎨 Modern, dark-themed web interface
- 🚀 Improved performance with async scanning

### v2.0.0 (2026-01-29)
- 🎯 Context-aware pattern matching
- 🧪 Smart test file handling
- ❌ Removed overly broad patterns (phone, CC, IP)
- 🔧 Better error messages

### v1.0.0
- Initial release with basic secret scanning
