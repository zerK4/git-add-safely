# Plugin System Documentation

git-add-safely v3+ includes a powerful plugin system that allows you to extend functionality.

## Overview

The plugin system uses hooks to intercept different stages of the git add process:

- `beforeScan` - Before scanning files for secrets
- `afterScan` - After scanning completes
- `beforeAdd` - Before proceeding with git add
- `afterAdd` - After git add completes

## Built-in Plugins

### Web UI Plugin

Interactive web interface for reviewing changes before committing.

**Features:**
- File list with status badges (added/modified/deleted)
- Syntax-highlighted warnings
- Approve/Cancel actions
- Auto-opens in browser

**Configuration** (`.git-safely.json`):
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

**Disable temporarily:**
```bash
git-add-safely . --no-ui
```

## Creating Custom Plugins

### Plugin Structure

```typescript
import type { Plugin, PluginContext } from "git-add-safely/types";

export class MyPlugin implements Plugin {
  name = "my-plugin";
  version = "1.0.0";
  description = "My custom plugin";

  async init(config?: Record<string, any>) {
    // Initialize plugin with config
    console.log("Plugin initialized with:", config);
  }

  hooks = {
    beforeScan: async (files: string[]) => {
      // Modify files list
      console.log("Scanning files:", files);
      return files;
    },

    afterScan: async (context: PluginContext) => {
      // Add custom checks or modify results
      console.log("Scan results:", context.scanResults);
      return context;
    },

    beforeAdd: async (context: PluginContext) => {
      // Return false to prevent git add
      if (context.scanResults.length > 10) {
        console.error("Too many warnings!");
        return false;
      }
      return true;
    },

    afterAdd: async (context: PluginContext) => {
      // Post-add actions (notifications, logging, etc.)
      console.log("Files added successfully!");
    },
  };

  async cleanup() {
    // Cleanup resources
    console.log("Plugin cleanup");
  }
}
```

### Plugin Types

```typescript
interface PluginContext {
  stagedFiles: FileStatus[];
  scanResults: ScanResult[];
  config: Record<string, any>;
}

interface FileStatus {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  staged: boolean;
}

interface ScanResult {
  file: string;
  line: number;
  pattern: string;
  content: string;
}
```

### Registering Plugins

In `src/index.ts`:

```typescript
import { PluginLoader } from "./core/plugin-loader";
import { MyPlugin } from "./plugins/my-plugin";

const pluginLoader = new PluginLoader();
await pluginLoader.registerPlugin(new MyPlugin());
```

## Plugin Ideas

### Smart Commit Messages

```typescript
hooks: {
  afterScan: async (context) => {
    // Analyze changes and suggest commit message
    const suggestion = await generateCommitMessage(context);
    console.log("Suggested commit:", suggestion);
    return context;
  }
}
```

### Pre-commit Formatting

```typescript
hooks: {
  beforeAdd: async (context) => {
    // Run prettier/eslint
    await formatFiles(context.stagedFiles);
    return true;
  }
}
```

### AI Code Review

```typescript
hooks: {
  afterScan: async (context) => {
    // Use Claude API to review changes
    const review = await reviewCode(context);
    console.log("AI Review:", review);
    return context;
  }
}
```

### Slack Notifications

```typescript
hooks: {
  afterAdd: async (context) => {
    // Send notification to Slack
    await notifySlack({
      files: context.stagedFiles.length,
      warnings: context.scanResults.length,
    });
  }
}
```

## Configuration

Place `.git-safely.json` in your project root:

```json
{
  "plugins": {
    "web-ui": {
      "enabled": true,
      "config": {
        "autoOpen": true,
        "port": 3450
      }
    },
    "my-plugin": {
      "enabled": true,
      "config": {
        "option1": "value1",
        "option2": true
      }
    }
  },
  "patterns": {
    "sensitive": true,
    "content": true
  }
}
```

## Hooks Execution Order

1. **beforeScan** - Modify file list
2. **Scan files** - Core secret detection
3. **afterScan** - Add custom checks
4. **beforeAdd** - Approve/deny operation
5. **Git add** - Actual git operation
6. **afterAdd** - Post-commit actions

## Best Practices

### 1. Keep plugins focused
Each plugin should do one thing well.

### 2. Handle errors gracefully
```typescript
async init(config) {
  try {
    // Initialize
  } catch (err) {
    console.warn("Plugin init failed:", err.message);
  }
}
```

### 3. Cleanup resources
```typescript
async cleanup() {
  await server.stop();
  await db.close();
}
```

### 4. Use configuration
```typescript
async init(config = {}) {
  this.port = config.port || 3000;
  this.enabled = config.enabled !== false;
}
```

### 5. Provide feedback
```typescript
console.log("✅ Plugin loaded");
console.error("❌ Operation failed");
console.warn("⚠️  Warning");
```

## Plugin Distribution

### NPM Package

```json
{
  "name": "git-add-safely-plugin-myfeature",
  "main": "dist/index.js",
  "peerDependencies": {
    "git-add-safely": "^3.0.0"
  }
}
```

### Local Plugin

```typescript
// src/plugins/local-plugin.ts
export class LocalPlugin implements Plugin {
  // ...
}
```

## Examples

See `/src/plugins/` for built-in plugin implementations:
- `web-ui.ts` - Web UI plugin with Bun server
- More coming soon!

## Contributing

Want to create a plugin? Check the [Plugin Template](./plugin-template/) for a starter.

Open a PR to add your plugin to the [Community Plugins](./COMMUNITY_PLUGINS.md) list!
