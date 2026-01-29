#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import readline from "node:readline/promises";
import { PluginLoader } from "./core/plugin-loader";
import { SecretScanner } from "./core/scanner";
import { WebUIPlugin } from "./plugins/web-ui";
import type { PluginContext } from "./types/plugin";

// Parse arguments
const args = process.argv.slice(2);

// Handle help flag
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
git-add-safely - Safe git add with secret detection

Usage:
  git-add-safely <files> [--force] [--no-ui]
  git-add-safely .
  git-add-safely file1.js file2.ts

Options:
  --force     Skip all security checks
  --no-ui     Disable web UI (use CLI only)
  --help      Show this help message

Examples:
  git-add-safely .                    # Add all files with safety checks
  git-add-safely src/config.ts        # Add specific file
  git-add-safely . --force            # Skip all checks
  git-add-safely . --no-ui            # CLI mode only

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

const force = args.includes("--force");
const ui = args.includes("--ui");

if (args.length === 0 || args.every((arg) => arg.startsWith("--"))) {
  console.error("⚠️  Please specify what to add (e.g., . or file name)");
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

  // Run git add first
  const gitArgs = args.filter((a) => !a.startsWith("--"));
  const addResult = spawnSync("git", ["add", ...gitArgs], { stdio: "inherit" });

  if (addResult.status !== 0) {
    console.error("❌ git add failed.");
    process.exit(addResult.status ?? 1);
  }

  if (force) {
    console.log("--force flag used. Skipping all checks.");
    await pluginLoader.cleanup();
    process.exit(0);
  }

  // Get staged files
  const diff = spawnSync("git", ["diff", "--cached", "--name-only"], {
    encoding: "utf-8",
  });
  const stagedFiles = diff.stdout.trim().split("\n").filter(Boolean);

  if (stagedFiles.length === 0) {
    console.log("No files staged.");
    await pluginLoader.cleanup();
    process.exit(0);
  }

  console.log("\nStaged files:");
  console.log(stagedFiles.join("\n"));
  console.log("\nScanning for sensitive information...");

  // Execute beforeScan hooks
  const filesToScan = await pluginLoader.executeBeforeScan(stagedFiles);

  // Scan for secrets
  const { sensitiveFiles, scanResults } =
    await scanner.scanFiles(filesToScan);
  const fileStatuses = scanner.getFileStatuses(stagedFiles);

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
    console.warn("\nWARNING: Potential sensitive data detected!");
    console.warn(
      `Files with sensitive content: ${Array.from(sensitiveFiles).join(", ")}`,
    );

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
        console.error("Unstaging problematic files...");
        spawnSync("git", ["reset", "--", ...Array.from(sensitiveFiles)], {
          stdio: "inherit",
        });
        console.error(
          "Problematic files have been unstaged. Fix them and try again.",
        );
        await pluginLoader.cleanup();
        process.exit(1);
      }
    }
  } else {
    console.log("No sensitive patterns detected.");
  }

  // Execute beforeAdd hooks (can prevent the operation)
  const shouldContinue = await pluginLoader.executeBeforeAdd(updatedContext);

  if (!shouldContinue) {
    console.error("Operation cancelled by plugin.");
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
