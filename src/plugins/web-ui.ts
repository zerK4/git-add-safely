import type { Plugin, PluginContext } from "../types/plugin";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { buildHostname, ensureHostsEntry } from "../core/hosts-manager";
import { findFreePort, registerRoute, unregisterRoute } from "../core/proxy-registry";
import { ensureProxyRunning } from "../proxy/manager";
import { certsExist } from "../core/cert-manager";
import {
  createConversation,
  addMessage,
  getMessages,
  listConversations,
  getConversation,
  deleteConversation,
} from "../core/history-db";
import { getNotesForFile, getAllNotes, setNote } from "../core/notes-db";
import { readSettings, writeSettings, getProviderForFeature } from "../core/settings";
import { streamAIResponse } from "../core/ai-runner";

interface WebUIConfig {
  autoOpen?: boolean;
  port?: number;
  noDomain?: boolean;
  httpOnly?: boolean;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export class WebUIPlugin implements Plugin {
  name = "web-ui";
  version = "2.0.0";
  description = "Interactive web UI for reviewing changes";

  private config: WebUIConfig = {
    autoOpen: true,
    port: undefined,
  };
  private serverProcess: any = null;
  private decisionResolver: ((value: boolean) => void) | null = null;
  private hostname: string = "";
  private cliOverrides: Partial<WebUIConfig> = {};

  setCliOverrides(overrides: Partial<WebUIConfig>) {
    this.cliOverrides = overrides;
  }

  async init(config?: WebUIConfig) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    // CLI flags always win over file config
    this.config = { ...this.config, ...this.cliOverrides };
  }

  hooks = {
    afterScan: async (context: PluginContext): Promise<PluginContext> => {
      if (context.stagedFiles.length === 0) {
        return context;
      }

      if (!this.config.port) {
        this.config.port = await findFreePort();
      }

      let uiUrl: string;
      if (this.config.noDomain) {
        uiUrl = `http://127.0.0.1:${this.config.port}`;
      } else {
        const repoResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
        const projectName = repoResult.stdout.trim().split("/").pop() ?? "project";
        this.hostname = buildHostname(projectName);
        ensureHostsEntry(this.hostname);
        if (!this.config.httpOnly) {
          await ensureProxyRunning();
        }
        registerRoute(this.hostname, this.config.port, process.pid);
        const scheme = !this.config.httpOnly && certsExist() ? "https" : "http";
        uiUrl = `${scheme}://${this.hostname}`;
      }
      console.log(`\x1b[2m  url\x1b[0m    \x1b[36m\x1b[4m${uiUrl}\x1b[0m`);

      await this.startServer(context);

      if (this.config.autoOpen) {
        this.openBrowser(uiUrl);
      }

      const userDecision = await this.waitForUserDecision();

      if (!userDecision) {
        throw new Error("Cancelled");
      }

      return context;
    },
  };

  private async startServer(context: PluginContext) {
    // dist/ui/ is a sibling directory of dist/index.js
    const uiDistPath = join(import.meta.dir, "ui");
    const self = this;

    const server = Bun.serve({
      port: this.config.port,
      idleTimeout: 0, // disable timeout — SSE streams stay open as long as needed
      async fetch(req) {
        const url = new URL(req.url);

        // --- API routes ---

        if (url.pathname === "/api/context") {
          const repoResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
          const repoName = repoResult.stdout.trim().split("/").pop() ?? "unknown";
          const branchResult = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf-8" });
          const branchName = branchResult.stdout.trim() || "HEAD";
          return Response.json({ ...context, repoName, branchName });
        }

        if (url.pathname === "/api/diff") {
          const file = url.searchParams.get("file");
          if (!file) return new Response("Missing file param", { status: 400 });
          const result = spawnSync("git", ["diff", "--cached", "--", file], { encoding: "utf-8" });
          if (result.error) return new Response("Git error", { status: 500 });
          return new Response(result.stdout, {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }

        if (url.pathname === "/api/file-lines") {
          const file = url.searchParams.get("file");
          const lineParam = url.searchParams.get("line");
          if (!file || !lineParam) return new Response("Missing params", { status: 400 });
          const targetLine = parseInt(lineParam, 10);
          const radius = 4; // lines before/after
          // Read from git index (staged version of the file)
          const result = spawnSync("git", ["show", `:${file}`], { encoding: "utf-8" });
          if (result.error || result.status !== 0) return new Response("Git error", { status: 500 });
          const lines = result.stdout.split("\n");
          const start = Math.max(0, targetLine - radius - 1);
          const end = Math.min(lines.length, targetLine + radius);
          const slice = lines.slice(start, end).map((content, i) => ({
            lineNo: start + i + 1,
            content,
            isTarget: start + i + 1 === targetLine,
          }));
          return Response.json({ file, targetLine, lines: slice });
        }

        if (url.pathname === "/api/approve") {
          console.log(`\n  \x1b[32mApproved\x1b[0m\n`);
          if (self.decisionResolver) self.decisionResolver(true);
          server.stop();
          return Response.json({ ok: true });
        }

        if (url.pathname === "/api/cancel") {
          console.log(`\n  \x1b[31mCancelled\x1b[0m\n`);
          if (self.decisionResolver) self.decisionResolver(false);
          server.stop();
          return Response.json({ ok: true });
        }

        // --- Claude review endpoints ---

        if (url.pathname === "/api/review" && req.method === "POST") {
          const body = await req.json() as {
            file: string;
            diff: string;
            warnings: { line: number; pattern: string; content: string }[];
            warningsSummary: string;
          };

          const repoResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
          const repoRoot = repoResult.stdout.trim();

          const warningsSection = body.warnings.length > 0
            ? `\n\nSecurity warnings already detected by the scanner:\n${body.warnings.map(w => `- Line ${w.line}: ${w.pattern} — \`${w.content}\``).join("\n")}`
            : "";

          const prompt = `/code-review Review the following staged diff for file \`${body.file}\` in the context of what is being committed.${warningsSection}\n\nFocus on: bugs, security issues, code quality, and whether the changes are safe to commit.\n\nDiff:\n\`\`\`diff\n${body.diff}\n\`\`\`\n\nProvide a clear, actionable review. Do not write to any files — just respond with your analysis.`;

          const provider = getProviderForFeature("codeReview");
          const stream = new ReadableStream({
            start(controller) {
              const enc = new TextEncoder();
              let closed = false;

              function send(data: object) {
                if (closed) return;
                try { controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
              }

              function finish() {
                if (closed) return;
                closed = true;
                try { controller.enqueue(enc.encode("data: [DONE]\n\n")); } catch {}
                try { controller.close(); } catch {}
              }

              streamAIResponse(prompt, provider, repoRoot, send, finish);
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
          });
        }

        if (url.pathname === "/api/review-all" && req.method === "POST") {
          const body = await req.json() as { files: string[]; userNote: string };
          const repoResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
          const repoRoot = repoResult.stdout.trim();

          // Fetch all diffs
          const diffs = body.files.map((file) => {
            const r = spawnSync("git", ["diff", "--cached", "--", file], { encoding: "utf-8" });
            return { file, diff: r.stdout ?? "" };
          });

          const diffSection = diffs
            .filter((d) => d.diff.trim())
            .map((d) => `### ${d.file}\n\`\`\`diff\n${d.diff}\n\`\`\``)
            .join("\n\n");

          const userNoteSection = body.userNote?.trim()
            ? `\n\nAdditional context from developer:\n${body.userNote}`
            : "";

          const prompt = `/code-review Review the following batch of staged changes across ${body.files.length} file(s).${userNoteSection}\n\nFor each file, identify bugs, security issues, and anything unsafe to commit. Be concise — one section per file, skip files with no issues.\n\n${diffSection}`;

          const provider = getProviderForFeature("codeReview");
          const stream = new ReadableStream({
            start(controller) {
              const enc = new TextEncoder();
              let closed = false;

              function send(data: object) {
                if (closed) return;
                try { controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
              }

              function finish() {
                if (closed) return;
                closed = true;
                try { controller.enqueue(enc.encode("data: [DONE]\n\n")); } catch {}
                try { controller.close(); } catch {}
              }

              streamAIResponse(prompt, provider, repoRoot, send, finish);
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
          });
        }

        if (url.pathname === "/api/review-message" && req.method === "POST") {
          const body = await req.json() as {
            file: string;
            messages: { role: string; content: string }[];
          };

          const repoResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
          const repoRoot = repoResult.stdout.trim();

          // Build conversation context as a single prompt
          const history = body.messages.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
          const prompt = history;

          const provider = getProviderForFeature("codeReview");
          const stream = new ReadableStream({
            start(controller) {
              const enc = new TextEncoder();
              let closed = false;

              function send(data: object) {
                if (closed) return;
                try { controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
              }

              function finish() {
                if (closed) return;
                closed = true;
                try { controller.enqueue(enc.encode("data: [DONE]\n\n")); } catch {}
                try { controller.close(); } catch {}
              }

              streamAIResponse(prompt, provider, repoRoot, send, finish);
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
          });
        }

        if (url.pathname === "/api/review-save" && req.method === "POST") {
          const body = await req.json() as { file: string; content: string };
          const repoResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
          const repoRoot = repoResult.stdout.trim();

          const reviewDir = join(repoRoot, ".reviews");
          mkdirSync(reviewDir, { recursive: true });

          // Ensure .reviews is gitignored
          const gitignorePath = join(repoRoot, ".gitignore");
          let gitignore = "";
          try { gitignore = readFileSync(gitignorePath, "utf-8"); } catch {}
          if (!gitignore.includes(".reviews")) {
            writeFileSync(gitignorePath, gitignore + (gitignore.endsWith("\n") ? "" : "\n") + ".reviews/\n");
          }

          const safeName = body.file.replace(/\//g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
          const outPath = join(reviewDir, `${safeName}.md`);
          writeFileSync(outPath, body.content);

          return Response.json({ ok: true, path: `.reviews/${safeName}.md` });
        }

        // --- Conversation history endpoints ---

        if (url.pathname === "/api/history/conversations" && req.method === "GET") {
          const repoResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
          const repo = repoResult.stdout.trim().split("/").pop() ?? "unknown";
          const all = url.searchParams.get("all") === "1";
          const conversations = listConversations(all ? undefined : repo);
          return Response.json(conversations);
        }

        if (url.pathname === "/api/history/conversations" && req.method === "POST") {
          const body = await req.json() as { file: string; title: string };
          const repoResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
          const repo = repoResult.stdout.trim().split("/").pop() ?? "unknown";
          const id = createConversation(repo, body.file, body.title);
          return Response.json({ id });
        }

        if (url.pathname === "/api/history/conversations" && req.method === "DELETE") {
          const id = parseInt(url.searchParams.get("id") ?? "0");
          if (!id) return new Response("Missing id", { status: 400 });
          deleteConversation(id);
          return Response.json({ ok: true });
        }

        if (url.pathname === "/api/history/messages" && req.method === "GET") {
          const id = parseInt(url.searchParams.get("conversation_id") ?? "0");
          if (!id) return new Response("Missing conversation_id", { status: 400 });
          const messages = getMessages(id);
          return Response.json(messages);
        }

        if (url.pathname === "/api/history/messages" && req.method === "POST") {
          const body = await req.json() as { conversation_id: number; role: "user" | "assistant"; content: string };
          addMessage(body.conversation_id, body.role, body.content);
          return Response.json({ ok: true });
        }

        // --- Commit / push ---

        if (url.pathname === "/api/commit" && req.method === "POST") {
          const body = await req.json() as { message: string };
          if (!body.message?.trim()) return Response.json({ ok: false, error: "Empty message" }, { status: 400 });
          const result = spawnSync("git", ["commit", "-m", body.message], { encoding: "utf-8" });
          if (result.status !== 0) {
            return Response.json({ ok: false, error: result.stderr.trim() || result.stdout.trim() });
          }
          return Response.json({ ok: true, output: result.stdout.trim() });
        }

        if (url.pathname === "/api/push" && req.method === "POST") {
          const branchResult = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf-8" });
          const branch = branchResult.stdout.trim() || "HEAD";
          const result = spawnSync("git", ["push", "origin", branch], { encoding: "utf-8" });
          if (result.status !== 0) {
            return Response.json({ ok: false, error: result.stderr.trim() || result.stdout.trim() });
          }
          return Response.json({ ok: true, output: result.stderr.trim() || result.stdout.trim() });
        }

        // --- Generate commit message ---

        if (url.pathname === "/api/generate-commit" && req.method === "POST") {
          const repoResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
          const repoRoot = repoResult.stdout.trim();

          const stagedFiles = context.stagedFiles.map((f) => f.path);
          const diffs = stagedFiles.map((file) => {
            const r = spawnSync("git", ["diff", "--cached", "--", file], { encoding: "utf-8" });
            return { file, diff: r.stdout ?? "" };
          });

          const diffSection = diffs
            .filter((d) => d.diff.trim())
            .map((d) => `### ${d.file}\n\`\`\`diff\n${d.diff}\n\`\`\``)
            .join("\n\n");

          const prompt = `Generate a concise git commit message for these staged changes. Follow Conventional Commits format (type(scope): description). Use one of: feat, fix, refactor, chore, docs, style, test, perf. Keep the subject line under 72 characters. Output ONLY the commit message — no explanation, no markdown, no quotes.\n\n${diffSection}`;

          const provider = getProviderForFeature("generateCommit");
          const stream = new ReadableStream({
            start(controller) {
              const enc = new TextEncoder();
              let closed = false;

              function send(data: object) {
                if (closed) return;
                try { controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
              }

              function finish() {
                if (closed) return;
                closed = true;
                try { controller.enqueue(enc.encode("data: [DONE]\n\n")); } catch {}
                try { controller.close(); } catch {}
              }

              streamAIResponse(prompt, provider, repoRoot, send, finish);
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
          });
        }

        // --- Diff stats ---

        if (url.pathname === "/api/diff-stats") {
          const parseNumstat = (output: string) => {
            const stats: Record<string, { added: number; removed: number }> = {};
            for (const line of output.trim().split("\n").filter(Boolean)) {
              const [added, removed, ...fileParts] = line.split("\t");
              const file = fileParts.join("\t");
              stats[file] = { added: parseInt(added) || 0, removed: parseInt(removed) || 0 };
            }
            return stats;
          };
          const staged = parseNumstat(spawnSync("git", ["diff", "--cached", "--numstat"], { encoding: "utf-8" }).stdout);
          const unstaged = parseNumstat(spawnSync("git", ["diff", "--numstat"], { encoding: "utf-8" }).stdout);
          return Response.json({ ...unstaged, ...staged });
        }

        // --- Inline notes endpoints ---

        if (url.pathname === "/api/notes/all" && req.method === "GET") {
          const repoResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
          const repoRoot = repoResult.stdout.trim();
          return Response.json(getAllNotes(repoRoot));
        }

        if (url.pathname === "/api/notes" && req.method === "GET") {
          const file = url.searchParams.get("file");
          if (!file) return new Response("Missing file param", { status: 400 });
          const repoResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
          const repoRoot = repoResult.stdout.trim();
          return Response.json(getNotesForFile(repoRoot, file));
        }

        if (url.pathname === "/api/notes" && req.method === "POST") {
          const body = await req.json() as { file: string; lineNo: number; content: string };
          const repoResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
          const repoRoot = repoResult.stdout.trim();

          // Ensure .git-notes is gitignored
          const gitignorePath = join(repoRoot, ".gitignore");
          let gitignore = "";
          try { gitignore = readFileSync(gitignorePath, "utf-8"); } catch {}
          if (!gitignore.includes(".git-notes")) {
            writeFileSync(gitignorePath, gitignore + (gitignore.endsWith("\n") ? "" : "\n") + ".git-notes/\n");
          }

          const authorName = spawnSync("git", ["config", "user.name"], { encoding: "utf-8" }).stdout.trim();
          const authorEmail = spawnSync("git", ["config", "user.email"], { encoding: "utf-8" }).stdout.trim();

          setNote(repoRoot, body.file, body.lineNo, body.content, authorName, authorEmail);
          return Response.json({ ok: true });
        }

        // --- Settings endpoints ---

        if (url.pathname === "/api/settings" && req.method === "GET") {
          return Response.json(readSettings());
        }

        if (url.pathname === "/api/settings" && req.method === "POST") {
          const body = await req.json();
          writeSettings(body);
          return Response.json({ ok: true });
        }

        // --- Static file serving ---

        let filePath: string;
        if (url.pathname === "/" || url.pathname === "/index.html") {
          filePath = join(uiDistPath, "index.html");
        } else {
          filePath = join(uiDistPath, url.pathname);
        }

        if (!existsSync(filePath)) {
          // SPA fallback — serve index.html for unknown routes
          const indexPath = join(uiDistPath, "index.html");
          if (!existsSync(indexPath)) {
            return new Response(
              "UI not built. Run: bun run build",
              { status: 503, headers: { "Content-Type": "text/plain" } }
            );
          }
          filePath = indexPath;
        }

        const ext = extname(filePath);
        const contentType = MIME[ext] ?? "application/octet-stream";
        return new Response(readFileSync(filePath), {
          headers: { "Content-Type": contentType },
        });
      },
    });

    this.serverProcess = server;
  }

  private openBrowser(url?: string) {
    const target = url ?? `http://localhost:${this.config.port}`;
    const platform = process.platform;
    const command = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
    spawn(command, [target], { detached: true, stdio: "ignore" }).unref();
  }

  private async waitForUserDecision(): Promise<boolean> {
    return new Promise((resolve) => {
      this.decisionResolver = resolve;
    });
  }

  async cleanup() {
    if (this.serverProcess) {
      try { this.serverProcess.stop(); } catch {}
    }
    if (this.hostname) {
      unregisterRoute(this.hostname);
    }
  }
}
