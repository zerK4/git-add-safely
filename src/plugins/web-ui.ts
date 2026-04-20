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

// Group raw GitHub API review comments by file → root thread line.
// Replies (have in_reply_to_id) are attached to the same line as their root parent.
function groupReviewComments(rawComments: any[]): Record<string, Record<number, any[]>> {
  // Build id → comment map first
  const byId = new Map<number, any>();
  for (const c of rawComments) byId.set(c.id, c);

  // Find root line for any comment (follow in_reply_to_id chain)
  function rootLine(c: any): number {
    if (!c.in_reply_to_id) return c.line ?? c.original_line ?? c.position ?? 0;
    const parent = byId.get(c.in_reply_to_id);
    if (!parent) return c.line ?? c.original_line ?? c.position ?? 0;
    return rootLine(parent);
  }

  const grouped: Record<string, Record<number, any[]>> = {};
  for (const c of rawComments) {
    const path = c.path;
    const line = rootLine(c);
    if (!grouped[path]) grouped[path] = {};
    if (!grouped[path][line]) grouped[path][line] = [];
    grouped[path][line].push({
      id: c.id,
      inReplyToId: c.in_reply_to_id ?? null,
      author: c.user?.login ?? "unknown",
      body: c.body ?? "",
      createdAt: c.created_at ?? "",
      path: c.path ?? "",
      line: c.line ?? c.original_line ?? null,
      diffHunk: c.diff_hunk ?? "",
      reviewId: c.pull_request_review_id ?? null,
    });
  }
  return grouped;
}

// Extract nameWithOwner from gh CLI or git remote as fallback
function getNameWithOwner(): string {
  const ghResult = spawnSync("gh", ["repo", "view", "--json", "nameWithOwner"], { encoding: "utf-8" });
  try {
    const parsed = JSON.parse(ghResult.stdout);
    if (parsed.nameWithOwner) return parsed.nameWithOwner;
  } catch {}
  // Fallback: parse from git remote URL
  const remoteResult = spawnSync("git", ["remote", "get-url", "origin"], { encoding: "utf-8" });
  const remoteUrl = remoteResult.stdout.trim();
  const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return match ? match[1] : "";
}

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

          const fileNotes = getNotesForFile(repoRoot, body.file);
          const notesEntries = Object.entries(fileNotes);
          const notesSection = notesEntries.length > 0
            ? `\n\nInline review notes left by the developer on specific lines:\n${notesEntries.map(([lineNo, n]) => `- Line ${lineNo}: ${n.content}`).join("\n")}`
            : "";

          const prompt = `/code-review Review the following staged diff for file \`${body.file}\` in the context of what is being committed.${warningsSection}${notesSection}\n\nFocus on: bugs, security issues, code quality, and whether the changes are safe to commit. Pay special attention to lines with developer notes above.\n\nDiff:\n\`\`\`diff\n${body.diff}\n\`\`\`\n\nProvide a clear, actionable review. Do not write to any files — just respond with your analysis.`;

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
            .map((d) => {
              const fileNotes = getNotesForFile(repoRoot, d.file);
              const notesEntries = Object.entries(fileNotes);
              const notesBlock = notesEntries.length > 0
                ? `\nDeveloper notes for this file:\n${notesEntries.map(([lineNo, n]) => `  - Line ${lineNo}: ${n.content}`).join("\n")}\n`
                : "";
              return `### ${d.file}\n${notesBlock}\`\`\`diff\n${d.diff}\n\`\`\``;
            })
            .join("\n\n");

          const userNoteSection = body.userNote?.trim()
            ? `\n\nAdditional context from developer:\n${body.userNote}`
            : "";

          const prompt = `/code-review Review the following batch of staged changes across ${body.files.length} file(s).${userNoteSection}\n\nFor each file, identify bugs, security issues, and anything unsafe to commit. Pay special attention to lines with developer notes. Be concise — one section per file, skip files with no issues.\n\n${diffSection}`;

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
          if (stagedFiles.length === 0) {
            const errStream = new ReadableStream({
              start(controller) {
                const enc = new TextEncoder();
                controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "error", error: "No staged files. Run git add first." })}\n\n`));
                controller.enqueue(enc.encode("data: [DONE]\n\n"));
                controller.close();
              },
            });
            return new Response(errStream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
          }
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

        // --- PR comment (general, not inline) ---

        if (url.pathname === "/api/pr-comment" && req.method === "POST") {
          const body = await req.json() as { pr: number; body: string };
          const result = spawnSync("gh", ["pr", "comment", String(body.pr), "--body", body.body], { encoding: "utf-8" });
          return Response.json({ ok: result.status === 0, error: result.stderr?.trim() });
        }

        // --- PR info endpoint ---

        if (url.pathname === "/api/pr-info" && req.method === "GET") {
          // Check gh is installed
          const ghCheck = spawnSync("gh", ["--version"], { encoding: "utf-8" });
          if (ghCheck.error || ghCheck.status !== 0) {
            return Response.json({ ghMissing: true });
          }

          const branchResult = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf-8" });
          const branch = branchResult.stdout.trim() || "HEAD";

          // Find open PRs for this branch
          const prListResult = spawnSync(
            "gh", ["pr", "list", "--head", branch, "--json", "number,title,body,state,url,author,createdAt,updatedAt,baseRefName,headRefName"],
            { encoding: "utf-8" }
          );

          if (prListResult.status !== 0 || !prListResult.stdout.trim()) {
            return Response.json({ prs: [] });
          }

          let prs: any[] = [];
          try { prs = JSON.parse(prListResult.stdout); } catch { return Response.json({ prs: [] }); }

          if (prs.length === 0) return Response.json({ prs: [] });

          // Get repo nameWithOwner for API calls
          const nameWithOwner = getNameWithOwner();

          // Enrich each PR with comments, reviews, and review threads
          const enriched = prs.map((pr: any) => {
            const commentsResult = spawnSync(
              "gh", ["pr", "view", String(pr.number), "--json", "comments,reviews,reviewRequests"],
              { encoding: "utf-8" }
            );
            let comments: any[] = [];
            let reviews: any[] = [];
            let reviewRequests: any[] = [];
            if (commentsResult.status === 0) {
              try {
                const data = JSON.parse(commentsResult.stdout);
                comments = data.comments ?? [];
                reviews = data.reviews ?? [];
                reviewRequests = data.reviewRequests ?? [];
              } catch {}
            }

            // Fetch inline review comments (code comments + replies)
            let reviewComments: any[] = [];
            if (nameWithOwner) {
              const rcResult = spawnSync(
                "gh", ["api", `repos/${nameWithOwner}/pulls/${pr.number}/comments`, "--paginate"],
                { encoding: "utf-8" }
              );
              if (rcResult.status === 0 && rcResult.stdout.trim()) {
                try {
                  const raw = rcResult.stdout.trim();
                  const flat: any[] = JSON.parse(raw.replace(/\]\s*\[/g, ","));
                  reviewComments = flat.map((c: any) => ({
                    id: c.id,
                    inReplyToId: c.in_reply_to_id ?? null,
                    author: c.user?.login ?? "unknown",
                    body: c.body ?? "",
                    createdAt: c.created_at ?? "",
                    path: c.path ?? "",
                    line: c.line ?? c.original_line ?? null,
                    diffHunk: c.diff_hunk ?? "",
                    reviewId: c.pull_request_review_id ?? null,
                  }));
                } catch {}
              }
            }

            let timelineEvents: any[] = [];
            if (nameWithOwner) {
              const tlResult = spawnSync(
                "gh", ["api", `repos/${nameWithOwner}/issues/${pr.number}/timeline`, "--paginate"],
                { encoding: "utf-8" }
              );
              if (tlResult.status === 0 && tlResult.stdout.trim()) {
                try {
                  const raw = tlResult.stdout.trim();
                  const all: any[] = JSON.parse(raw.replace(/\]\s*\[/g, ","));
                  timelineEvents = all
                    .filter((e: any) => ["committed", "review_requested", "review_request_removed"].includes(e.event))
                    .map((e: any) => ({
                      event: e.event,
                      actor: e.actor?.login ?? e.author?.login ?? "unknown",
                      actorName: e.actor?.login ?? e.author?.name ?? e.committer?.name ?? "unknown",
                      createdAt: e.created_at ?? e.committer?.date ?? "",
                      sha: e.sha?.slice(0, 7) ?? "",
                      message: e.message?.split("\n")[0] ?? "",
                      requestedReviewer: e.requested_reviewer?.login ?? null,
                    }));
                } catch {}
              }
            }

            // Get PR diff
            const diffResult = spawnSync("gh", ["pr", "diff", String(pr.number)], { encoding: "utf-8" });
            const diff = diffResult.status === 0 ? diffResult.stdout : "";

            return { ...pr, comments, reviews, reviewRequests, reviewComments, timelineEvents, diff };
          });

          return Response.json({ prs: enriched });
        }

        // --- PR reply endpoint ---

        if (url.pathname === "/api/pr-reply" && req.method === "POST") {
          const body = await req.json() as { pr: number; commentId: number; body: string };
          const nameWithOwner = getNameWithOwner();
          if (!nameWithOwner) return Response.json({ ok: false, error: "Could not get repo" }, { status: 500 });

          const result = spawnSync("gh", [
            "api", `repos/${nameWithOwner}/pulls/${body.pr}/comments`,
            "--method", "POST",
            "--field", `body=${body.body}`,
            "--field", `in_reply_to=${body.commentId}`,
          ], { encoding: "utf-8" });

          return Response.json({ ok: result.status === 0 });
        }

        if (url.pathname === "/api/pr-review-threads" && req.method === "GET") {
          const prNum = url.searchParams.get("pr");
          if (!prNum) return Response.json({}, { status: 400 });

          const repoResult = spawnSync("gh", ["repo", "view", "--json", "nameWithOwner"], { encoding: "utf-8" });
          let nameWithOwner = "";
          try { nameWithOwner = JSON.parse(repoResult.stdout).nameWithOwner; } catch {}
          if (!nameWithOwner) return Response.json({});

          const commentsResult = spawnSync("gh", [
            "api", `repos/${nameWithOwner}/pulls/${prNum}/comments`,
            "--paginate",
          ], { encoding: "utf-8" });

          let rawComments: any[] = [];
          try {
            const raw = commentsResult.stdout.trim();
            if (raw.startsWith("[")) {
              rawComments = JSON.parse(raw.replace(/\]\s*\[/g, ","));
            }
          } catch {}

          return Response.json(groupReviewComments(rawComments));
        }

        if (url.pathname === "/api/pr-file-diff" && req.method === "GET") {
          const prNum = url.searchParams.get("pr");
          const file = url.searchParams.get("file");
          if (!prNum || !file) return new Response("Missing params", { status: 400 });

          const result = spawnSync("gh", ["pr", "diff", prNum], { encoding: "utf-8" });
          if (result.status !== 0) return new Response("", { headers: { "Content-Type": "text/plain" } });

          const sections = result.stdout.split(/^(?=diff --git )/m);
          const section = sections.find(s => s.includes(`b/${file}`) || s.includes(` b/${file}\n`));

          return new Response(section ?? "", {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
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
