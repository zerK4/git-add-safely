#!/usr/bin/env bun
import { contentPatterns } from "./patters/content-patterns";
import { filenamePatterns } from "./patters/file-patterns";
const { spawnSync } = await import("node:child_process");
const fs = await import("node:fs/promises");
const readline = await import("node:readline/promises");

// parse args
const args = process.argv.slice(2);

// Handle help flag
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
git-add-safely - Safe git add with secret detection

Usage:
  git-add-safely <files> [--force]
  git-add-safely .
  git-add-safely file1.js file2.ts

Options:
  --force    Skip all security checks
  --help     Show this help message

Examples:
  git-add-safely .                    # Add all files with safety checks
  git-add-safely src/config.ts        # Add specific file
  git-add-safely . --force            # Skip all checks
`);
  process.exit(0);
}

const force = args.includes("--force");
if (args.length === 0) {
  console.error("⚠️ Please specify what to add (e.g., . or file name)");
  process.exit(1);
}

// run git add first
const gitArgs = args.filter((a) => a !== "--force");
const addResult = spawnSync("git", ["add", ...gitArgs], { stdio: "inherit" });
if (addResult.status !== 0) {
  console.error("❌ git add failed.");
  process.exit(addResult.status ?? 1);
}

if (force) {
  console.log("🚀 --force used. Skipping checks.");
  process.exit(0);
}

// get staged files
const diff = spawnSync("git", ["diff", "--cached", "--name-only"], {
  encoding: "utf-8",
});
const stagedFiles = diff.stdout.trim().split("\n").filter(Boolean);

if (stagedFiles.length === 0) {
  console.log("✅ No files staged.");
  process.exit(0);
}

console.log("\n✨ Staged files:");
console.log(stagedFiles.join("\n"));
console.log("\n🔎 Scanning for sensitive information…");

let foundSomething = false;
const problematicFiles = new Set();
const sensitiveByFilename = new Set();

// First pass: Check filenames
for (const file of stagedFiles) {
  for (const p of filenamePatterns) {
    if (p.regex.test(file)) {
      console.warn(`⚠️  [${p.name}] detected in filename: ${file}`);
      foundSomething = true;
      problematicFiles.add(file);
      sensitiveByFilename.add(file);
    }
  }
}

// Second pass: Check content only for files NOT flagged by filename
for (const file of stagedFiles) {
  // Skip content scanning if file was already flagged as sensitive by filename
  if (sensitiveByFilename.has(file)) {
    continue;
  }

  // Skip test files - they often contain mock data and function names that trigger false positives
  const isTestFile = /\.(test|spec)\.(ts|js|tsx|jsx|php)$/i.test(file) ||
                     /\/(tests?|__tests__|spec)\//i.test(file) ||
                     /Test\.(php|java|cs|py)$/i.test(file);

  try {
    const content = await fs.readFile(file, "utf-8");
    const lines = content.split("\n");

    let fileHasSensitiveContent = false;
    lines.forEach((line, i) => {
      for (const p of contentPatterns) {
        if (p.regex.test(line)) {
          // For test files, be more lenient - only flag if the pattern looks very specific
          if (isTestFile) {
            // Skip generic patterns for test files, only flag highly specific ones
            const highConfidencePatterns = [
              "AWS Access Key", "GitHub Personal Access Token", "Stripe Secret Key",
              "SendGrid API Key", "Slack Token", "Discord Bot Token",
              "RSA Private Key", "DSA Private Key", "EC Private Key", "OpenSSH Private Key"
            ];
            if (!highConfidencePatterns.includes(p.name)) {
              return; // Skip this detection for test files
            }
          }

          console.warn(
            `⚠️  [${p.name}] detected in ${file}:${i + 1}: ${line.trim()}`,
          );
          foundSomething = true;
          problematicFiles.add(file);
          fileHasSensitiveContent = true;
        }
      }
    });
  } catch (err: any) {
    console.error(`❌ Could not read ${file}:`, err.message);
  }
}

if (foundSomething) {
  console.warn("\n🚨 Potential sensitive data detected!");

  // Show summary
  const filenameIssues = Array.from(sensitiveByFilename);
  const contentIssues = Array.from(problematicFiles).filter(
    (f) => !sensitiveByFilename.has(f),
  );

  if (filenameIssues.length > 0) {
    console.warn(`📁 Sensitive files by name: ${filenameIssues.join(", ")}`);
  }
  if (contentIssues.length > 0) {
    console.warn(
      `📄 Files with sensitive content: ${contentIssues.join(", ")}`,
    );
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await rl.question(
    "❓ Do you want to continue anyway? [y/N]: ",
  );
  rl.close();

  if (/^y(es)?$/i.test(answer.trim())) {
    console.log("✅ Proceeding despite warnings.");
  } else {
    // Handle 'no', 'n' or any other response
    console.error("⛔ Unstaging problematic files…");
    spawnSync(
      "git",
      ["reset", "--", ...(Array.from(problematicFiles) as any)],
      {
        stdio: "inherit",
      },
    );
    console.error(
      "🚫 Problematic files have been unstaged. Fix them and try again.",
    );
    process.exit(1);
  }
} else {
  console.log("✅ No sensitive patterns detected.");
}
