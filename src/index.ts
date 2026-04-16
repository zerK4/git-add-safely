#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import readline from "node:readline/promises";
import { PluginLoader } from "./core/plugin-loader";
import { SecretScanner } from "./core/scanner";
import { WebUIPlugin } from "./plugins/web-ui";
import type { PluginContext } from "./types/plugin";
import { WatchModeServer } from "./plugins/watch-server";

// Parse arguments
const args = process.argv.slice(2);

// Handle help flag
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
git-add-safely - Safe git add with secret detection

Usage:
  git-add-safely <files> [--force] [--no-ui]
  git-add-safely .
  git-add-safely --watch

Options:
  --force     Skip all security checks
  --no-ui     Disable web UI (use CLI only)
  --watch     Watch mode — live UI for staging/unstaging files
  --help      Show this help message

Examples:
  git-add-safely .                    # Add all files with safety checks
  git-add-safely src/config.ts        # Add specific file
  git-add-safely . --force            # Skip all checks
  git-add-safely . --no-ui            # CLI mode only
  git-add-safely --watch              # Watch mode

Configuration:
  Create a .git-safely.json file in your project root to configure plugins:

  {
    "plugins": {
      "web-ui": {
        "enabled": true,
        "config": { "autoOpen": true, "port": 3450 }
      }
    }
  }
`);
  process.exit(0);
}

// --- Watch mode ---
if (args.includes("--watch")) {
  const repoRootResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
  const repoRoot = repoRootResult.stdout.trim();
  if (!repoRoot) {
    console.error("\x1b[31m  error  Not inside a git repository.\x1b[0m");
    process.exit(1);
  }
  const server = new WatchModeServer(repoRoot);
  await server.start();
  process.exit(0);
}

const force = args.includes("--force");
const ui = args.includes("--ui");

if (args.length === 0 || args.every((arg) => arg.startsWith("--"))) {
  console.error("\x1b[33m  warn   Please specify what to add (e.g., . or file name)\x1b[0m");
  process.exit(1);
}

async function main() {
  // Initialize plugin system
  const pluginLoader = new PluginLoader();
  const scanner = new SecretScanner();

  // Register plugins
  if (ui) {
    await pluginLoader.registerPlugin(new WebUIPlugin());
  }

  // Detect repo root
  const repoRootResult = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf-8",
  });
  const repoRoot = repoRootResult.stdout.trim();

  if (!repoRoot) {
    console.error("\x1b[31m  error  Not inside a git repository.\x1b[0m");
    process.exit(1);
  }

  // Run git add first
  const gitArgs = args.filter((a) => !a.startsWith("--"));
  const addResult = spawnSync("git", ["add", ...gitArgs], { stdio: "inherit" });

  if (addResult.status !== 0) {
    console.error("\x1b[31m  error  git add failed.\x1b[0m");
    process.exit(addResult.status ?? 1);
  }

  if (force) {
    console.log("  \x1b[2m--force: skipping all checks\x1b[0m");
    await pluginLoader.cleanup();
    process.exit(0);
  }

  // Get staged files
  const diff = spawnSync("git", ["diff", "--cached", "--name-only"], {
    encoding: "utf-8",
  });
  const stagedFiles = diff.stdout.trim().split("\n").filter(Boolean);

  if (stagedFiles.length === 0) {
    console.log("\n\x1b[2m  No files staged.\x1b[0m\n");
    await pluginLoader.cleanup();
    process.exit(0);
  }

  // Get file statuses early so we can show them in terminal
  const fileStatuses = scanner.getFileStatuses(stagedFiles);

  const statusSymbol: Record<string, string> = {
    added:    "\x1b[32m  A\x1b[0m",
    modified: "\x1b[33m  M\x1b[0m",
    deleted:  "\x1b[31m  D\x1b[0m",
    renamed:  "\x1b[36m  R\x1b[0m",
  };

  const added    = fileStatuses.filter((f) => f.status === "added").length;
  const modified = fileStatuses.filter((f) => f.status === "modified").length;
  const deleted  = fileStatuses.filter((f) => f.status === "deleted").length;
  const renamed  = fileStatuses.filter((f) => f.status === "renamed").length;

  console.log(`\n\x1b[1m\x1b[35mgit-add-safely\x1b[0m\n`);
  console.log(`\x1b[1m  Staged files\x1b[0m`);
  for (const f of fileStatuses) {
    const sym = statusSymbol[f.status] ?? "  \x1b[2m?\x1b[0m";
    console.log(`${sym}  \x1b[2m${f.path}\x1b[0m`);
  }

  const parts = [];
  if (added)    parts.push(`\x1b[32m${added} added\x1b[0m`);
  if (modified) parts.push(`\x1b[33m${modified} modified\x1b[0m`);
  if (deleted)  parts.push(`\x1b[31m${deleted} deleted\x1b[0m`);
  if (renamed)  parts.push(`\x1b[36m${renamed} renamed\x1b[0m`);
  console.log(`\n  ${parts.join("  \x1b[2m/\x1b[0m  ")}\n`);

  console.log(`\x1b[2m  Scanning for secrets...\x1b[0m`);

  // Execute beforeScan hooks
  const filesToScan = await pluginLoader.executeBeforeScan(stagedFiles);

  // Scan for secrets
  const { sensitiveFiles, scanResults } =
    await scanner.scanFiles(filesToScan, repoRoot);

  // Create plugin context
  const context: PluginContext = {
    stagedFiles: fileStatuses,
    scanResults,
    config: {},
  };

  // Execute afterScan hooks
  const updatedContext = await pluginLoader.executeAfterScan(context);

  // Handle results
  if (sensitiveFiles.size > 0) {
    console.warn(`\n  \x1b[1m\x1b[33mwarn   Sensitive data detected\x1b[0m`);
    for (const f of sensitiveFiles) {
      console.warn(`     \x1b[33m${f}\x1b[0m`);
    }

    // If no UI, ask via CLI
    if (!ui) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await rl.question(
        "Do you want to continue anyway? [y/N]: ",
      );
      rl.close();

      if (!/^y(es)?$/i.test(answer.trim())) {
        console.log(`\n  \x1b[2mUnstaging flagged files...\x1b[0m`);
        spawnSync("git", ["reset", "--", ...Array.from(sensitiveFiles)], {
          stdio: "inherit",
        });
        console.log(`  \x1b[31mUnstaged. Fix secrets and try again.\x1b[0m\n`);
        await pluginLoader.cleanup();
        process.exit(1);
      }
    }
  } else {
    console.log(`  \x1b[32mNo secrets detected\x1b[0m`);
  }

  // Execute beforeAdd hooks (can prevent the operation)
  const shouldContinue = await pluginLoader.executeBeforeAdd(updatedContext);

  if (!shouldContinue) {
    console.log(`\n  \x1b[31mCancelled\x1b[0m\n`);
    await pluginLoader.cleanup();
    process.exit(1);
  }

  // Execute afterAdd hooks
  await pluginLoader.executeAfterAdd(updatedContext);

  // Cleanup
  await pluginLoader.cleanup();

  // Exit successfully
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
