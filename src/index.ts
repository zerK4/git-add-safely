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

const VERSION = "0.1.0";

// Handle version flag
if (args.includes("--version") || args.includes("-v")) {
  console.log(VERSION);
  process.exit(0);
}

// Handle help flag
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
\x1b[1m\x1b[35mgit-add-safely\x1b[0m v${VERSION}
Git add wrapper with secret scanning and an AI code review UI.

\x1b[1mUsage:\x1b[0m
  git-add-safely <files>              Scan and stage files (CLI mode)
  git-add-safely <files> --ui         Scan and stage with web UI approval
  git-add-safely --watch              Live review UI — stage, diff, AI review

\x1b[1mModes:\x1b[0m
  \x1b[2m(default)\x1b[0m  Run git add, scan for secrets, prompt in terminal if found
  \x1b[33m--ui\x1b[0m       Open web UI for visual diff review and approval before staging
  \x1b[36m--watch\x1b[0m    Long-running UI server — browse all local changes, stage/unstage,
             write inline review notes, trigger AI code review

\x1b[1mOptions:\x1b[0m
  --force       Skip all security checks
  --ui          Open web UI for approval (instead of CLI prompt)
  --watch       Watch mode — live UI at https://project.git.studio
  --no-domain   Use http://127.0.0.1:<port> instead of custom domain
  --http-only   Use http://project.git.studio (skip HTTPS proxy)
  --port <n>    Use specific port (default: random free port)
  -v, --version Show version
  -h, --help    Show this help

\x1b[1mExamples:\x1b[0m
  git-add-safely .                    Scan and stage everything
  git-add-safely src/auth.ts          Scan specific file
  git-add-safely . --force            Skip all checks
  git-add-safely . --ui               Visual approval in browser
  git-add-safely --watch              Open live review UI
  git-add-safely --watch --no-domain  Watch mode on localhost (no /etc/hosts)
  git-add-safely --watch --port 4000  Watch mode on fixed port

\x1b[1mReview notes:\x1b[0m
  In --watch mode, click any diff line to add an inline note.
  Notes are saved to .git-notes/ and automatically included
  as context when you trigger an AI code review.

\x1b[1mConfiguration:\x1b[0m
  .git-safely.json in project root:

  {
    "plugins": {
      "web-ui": {
        "enabled": true,
        "config": { "autoOpen": true, "port": 3450 }
      }
    }
  }

\x1b[1mInstall:\x1b[0m
  bunx git-add-safely --watch          Run without installing
  bun install -g git-add-safely        Install globally
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
  const portArg = args.indexOf("--port");
  const port = portArg !== -1 ? parseInt(args[portArg + 1], 10) : undefined;
  if (port !== undefined && (isNaN(port) || port < 1 || port > 65535)) {
    console.error("\x1b[31m  error  --port must be a valid port number (1-65535)\x1b[0m");
    process.exit(1);
  }
  const server = new WatchModeServer(repoRoot, {
    noDomain: args.includes("--no-domain"),
    httpOnly: args.includes("--http-only"),
    port,
  });

  await server.start();
  process.exit(0);
}

const force = args.includes("--force");
const ui = args.includes("--ui");
const noDomain = args.includes("--no-domain");
const httpOnly = args.includes("--http-only");
const portArgIdx = args.indexOf("--port");
const portFlag = portArgIdx !== -1 ? parseInt(args[portArgIdx + 1], 10) : undefined;
if (portFlag !== undefined && (isNaN(portFlag) || portFlag < 1 || portFlag > 65535)) {
  console.error("\x1b[31m  error  --port must be a valid port number (1-65535)\x1b[0m");
  process.exit(1);
}

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
    const webUiPlugin = new WebUIPlugin();
    // CLI flags passed separately — registerPlugin will merge with .git-safely.json,
    // but CLI must win. We store them and apply after registerPlugin calls init().
    webUiPlugin.setCliOverrides({ noDomain, httpOnly, port: portFlag });
    await pluginLoader.registerPlugin(webUiPlugin);
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

  // Run git add first — strip our own flags (including --port <value>)
  const OWN_FLAGS = new Set(["--force", "--ui", "--no-ui", "--no-domain", "--http-only", "--watch"]);
  const OWN_FLAGS_WITH_VALUE = new Set(["--port"]);
  const gitArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (OWN_FLAGS.has(args[i])) continue;
    if (OWN_FLAGS_WITH_VALUE.has(args[i])) { i++; continue; }
    gitArgs.push(args[i]);
  }
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
