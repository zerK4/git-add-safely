import type { ScanResult, FileStatus } from "../types/plugin";
import { contentPatterns } from "../patters/content-patterns";
import { filenamePatterns } from "../patters/file-patterns";
import { readFile } from "node:fs/promises";

export class SecretScanner {
  async scanFiles(stagedFiles: string[]): Promise<{
    sensitiveFiles: Set<string>;
    scanResults: ScanResult[];
  }> {
    const sensitiveFiles = new Set<string>();
    const scanResults: ScanResult[] = [];
    const sensitiveByFilename = new Set<string>();

    // First pass: Check filenames
    for (const file of stagedFiles) {
      // Skip backup files created by this tool
      if (file.includes(".backup") || file.includes("-old.")) {
        continue;
      }

      for (const p of filenamePatterns) {
        if (p.regex.test(file)) {
          console.warn(`WARNING [${p.name}] detected in filename: ${file}`);
          sensitiveFiles.add(file);
          sensitiveByFilename.add(file);
        }
      }
    }

    // Second pass: Check content
    for (const file of stagedFiles) {
      if (sensitiveByFilename.has(file)) {
        continue;
      }

      // Check if it's a test file or documentation
      const isTestFile =
        /\.(test|spec)\.(ts|js|tsx|jsx|php)$/i.test(file) ||
        /\/(tests?|__tests__|spec)\//i.test(file) ||
        /Test\.(php|java|cs|py)$/i.test(file);

      const isDocumentation =
        /\.(md|txt|rst)$/i.test(file) ||
        /README/i.test(file) ||
        /CHANGELOG/i.test(file) ||
        /LICENSE/i.test(file);

      try {
        const content = await readFile(file, "utf-8");
        const lines = content.split("\n");

        lines.forEach((line, i) => {
          for (const p of contentPatterns) {
            if (p.regex.test(line)) {
              // Skip documentation files entirely
              if (isDocumentation) {
                return;
              }

              // Skip TypeScript/JavaScript function signatures
              if (
                /function\s+\w+\s*\(/.test(line) ||
                /\w+\s*\([^)]*:\s*\w+/.test(line) ||
                /^\s*\w+<.*>\s*\([^)]*\)\s*[:{\{]/.test(line)
              ) {
                return;
              }

              // For test files, only flag high-confidence patterns
              if (isTestFile) {
                const highConfidencePatterns = [
                  "AWS Access Key",
                  "GitHub Personal Access Token",
                  "Stripe Secret Key",
                  "SendGrid API Key",
                  "Slack Token",
                  "Discord Bot Token",
                  "RSA Private Key",
                  "DSA Private Key",
                  "EC Private Key",
                  "OpenSSH Private Key",
                ];
                if (!highConfidencePatterns.includes(p.name)) {
                  return;
                }
              }

              console.warn(
                `WARNING [${p.name}] detected in ${file}:${i + 1}: ${line.trim()}`,
              );
              sensitiveFiles.add(file);
              scanResults.push({
                file,
                line: i + 1,
                pattern: p.name,
                content: line.trim(),
              });
            }
          }
        });
      } catch (err: any) {
        console.error(`❌ Could not read ${file}:`, err.message);
      }
    }

    return { sensitiveFiles, scanResults };
  }

  getFileStatuses(stagedFiles: string[]): FileStatus[] {
    // For now, assume all files are modified
    // TODO: Get actual git status
    return stagedFiles.map((file) => ({
      path: file,
      status: "modified" as const,
      staged: true,
    }));
  }
}
