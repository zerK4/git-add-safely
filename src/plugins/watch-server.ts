import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { buildHostname, ensureHostsEntry } from "../core/hosts-manager";
import { findFreePort, registerRoute, unregisterRoute } from "../core/proxy-registry";
import { ensureProxyRunning } from "../proxy/manager";
import { certsExist } from "../core/cert-manager";
import { readSettings, writeSettings } from "../core/settings";
import { streamAIResponse } from "../core/ai-runner";
import { getProviderForFeature } from "../core/settings";
import { GitWatcher, getWatchStatus } from "../core/watcher";
import { SecretScanner } from "../core/scanner";
import {
  createConversation,
  addMessage,
  getMessages,
  listConversations,
  deleteConversation,
} from "../core/history-db";
import { getNotesForFile, getAllNotes, setNote } from "../core/notes-db";

// Group raw GitHub API review comments by file → root thread line.
function groupReviewComments(rawComments: any[]): Record<string, Record<number, any[]>> {
  const byId = new Map<number, any>();
  for (const c of rawComments) byId.set(c.id, c);

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

function getNameWithOwner(): string {
  const ghResult = spawnSync("gh", ["repo", "view", "--json", "nameWithOwner"], { encoding: "utf-8" });
  try {
    const parsed = JSON.parse(ghResult.stdout);
    if (parsed.nameWithOwner) return parsed.nameWithOwner;
  } catch {}
  const remoteResult = spawnSync("git", ["remote", "get-url", "origin"], { encoding: "utf-8" });
  const remoteUrl = remoteResult.stdout.trim();
  const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return match ? match[1] : "";
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

export interface WatchModeOptions {
  noDomain?: boolean;
  httpOnly?: boolean;
  port?: number;
}

export class WatchModeServer {
  private repoRoot: string;
  private watcher: GitWatcher;
  private scanner: SecretScanner;
  private sseClients = new Set<ReadableStreamDefaultController>();
  private hostname: string = "";
  private port: number = 0;
  private options: WatchModeOptions;

  constructor(repoRoot: string, options: WatchModeOptions = {}) {
    this.repoRoot = repoRoot;
    this.watcher = new GitWatcher();
    this.scanner = new SecretScanner();
    this.options = options;
  }

  async start() {
    const repoName = this.repoRoot.split("/").pop() ?? "unknown";
    this.port = this.options.port ?? await findFreePort();

    let uiUrl: string;
    if (this.options.noDomain) {
      uiUrl = `http://127.0.0.1:${this.port}`;
    } else {
      this.hostname = buildHostname(repoName);
      ensureHostsEntry(this.hostname);
      if (!this.options.httpOnly) {
        await ensureProxyRunning();
      }
      registerRoute(this.hostname, this.port, process.pid);
      const scheme = !this.options.httpOnly && certsExist() ? "https" : "http";
      uiUrl = `${scheme}://${this.hostname}`;
    }
    console.log(`\n\x1b[1m\x1b[35mgit-add-safely\x1b[0m  \x1b[2mwatch mode\x1b[0m`);
    console.log(`\x1b[2m  repo\x1b[0m   ${repoName}`);

    // Start file watcher — broadcast changes to all SSE clients
    this.watcher.onChange((status) => {
      this.broadcast(JSON.stringify({ type: "status", ...status }));
    });
    this.watcher.start(2000);

    const self = this;
    const uiDistPath = join(import.meta.dir, "ui");

    const server = Bun.serve({
      port: this.port,
      idleTimeout: 0,
      async fetch(req) {
        const url = new URL(req.url);

        // CORS for dev
        const headers = { "Access-Control-Allow-Origin": "*" };

        // --- SSE: live git status stream ---
        if (url.pathname === "/api/watch-events") {
          const stream = new ReadableStream({
            start(controller) {
              self.sseClients.add(controller);
              // Send current status immediately
              const current = getWatchStatus();
              const data = `data: ${JSON.stringify({ type: "status", ...current })}\n\n`;
              controller.enqueue(new TextEncoder().encode(data));
            },
            cancel(controller) {
              self.sseClients.delete(controller as any);
            },
          });
          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
              ...headers,
            },
          });
        }

        // --- Context (watch mode) ---
        if (url.pathname === "/api/context") {
          const status = getWatchStatus();
          const branchResult = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf-8" });
          const branchName = branchResult.stdout.trim() || "HEAD";

          // Scan staged files for secrets
          const stagedPaths = status.staged.map(f => f.path);
          let scanResults: any[] = [];
          if (stagedPaths.length > 0) {
            const { scanResults: sr } = await self.scanner.scanFiles(stagedPaths, self.repoRoot);
            scanResults = sr;
          }

          return Response.json({
            stagedFiles: status.staged,
            unstagedFiles: [...status.unstaged, ...status.untracked],
            scanResults,
            config: {},
            repoName: self.repoRoot.split("/").pop() ?? "unknown",
            branchName,
            watchMode: true,
          }, { headers });
        }

        // --- Diff for staged file ---
        if (url.pathname === "/api/diff") {
          const file = url.searchParams.get("file");
          if (!file) return new Response("Missing file param", { status: 400 });
          const result = spawnSync("git", ["diff", "--cached", "--", file], { encoding: "utf-8" });
          return new Response(result.stdout, {
            headers: { "Content-Type": "text/plain; charset=utf-8", ...headers },
          });
        }

        // --- Diff for unstaged/untracked file ---
        if (url.pathname === "/api/diff-unstaged") {
          const file = url.searchParams.get("file");
          if (!file) return new Response("Missing file param", { status: 400 });
          // Untracked: diff against /dev/null
          const isUntracked = spawnSync("git", ["ls-files", "--error-unmatch", file], { encoding: "utf-8" }).status !== 0;
          let result;
          if (isUntracked) {
            result = spawnSync("git", ["diff", "--no-index", "/dev/null", file], { encoding: "utf-8" });
          } else {
            result = spawnSync("git", ["diff", "--", file], { encoding: "utf-8" });
          }
          return new Response(result.stdout, {
            headers: { "Content-Type": "text/plain; charset=utf-8", ...headers },
          });
        }

        // --- Stage a file ---
        if (url.pathname === "/api/stage" && req.method === "POST") {
          const body = await req.json() as { file: string };
          const result = spawnSync("git", ["add", "--", body.file], { encoding: "utf-8" });
          if (result.status !== 0) return Response.json({ ok: false, error: result.stderr }, { status: 500 });
          return Response.json({ ok: true }, { headers });
        }

        // --- Unstage a file ---
        if (url.pathname === "/api/unstage" && req.method === "POST") {
          const body = await req.json() as { file: string };
          const result = spawnSync("git", ["restore", "--staged", "--", body.file], { encoding: "utf-8" });
          if (result.status !== 0) return Response.json({ ok: false, error: result.stderr }, { status: 500 });
          return Response.json({ ok: true }, { headers });
        }

        // --- Diff stats (staged + unstaged) ---
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
          return Response.json({ ...unstaged, ...staged }, { headers });
        }

        // --- Commit ---
        if (url.pathname === "/api/commit" && req.method === "POST") {
          const body = await req.json() as { message: string };
          const result = spawnSync("git", ["commit", "-m", body.message], { encoding: "utf-8" });
          return Response.json({
            ok: result.status === 0,
            output: result.stdout + result.stderr,
          }, { headers });
        }

        // --- Push ---
        if (url.pathname === "/api/push" && req.method === "POST") {
          const branchResult = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf-8" });
          const branch = branchResult.stdout.trim();
          const result = spawnSync("git", ["push", "origin", branch], { encoding: "utf-8" });
          return Response.json({
            ok: result.status === 0,
            output: result.stdout + result.stderr,
          }, { headers });
        }

        // --- Generate commit message ---
        if (url.pathname === "/api/generate-commit" && req.method === "POST") {
          const diffResult = spawnSync("git", ["diff", "--cached"], { encoding: "utf-8" });
          const diff = diffResult.stdout;
          if (!diff.trim()) return Response.json({ error: "No staged changes" }, { status: 400 });

          const prompt = `Generate a concise conventional commit message for this diff. Output ONLY the commit message, nothing else.\n\nDiff:\n${diff.slice(0, 8000)}`;
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

              streamAIResponse(prompt, provider, self.repoRoot, send, finish);
            },
          });
          return new Response(stream, {
            headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...headers },
          });
        }

        // --- Notes ---
        if (url.pathname === "/api/notes/all" && req.method === "GET") {
          return Response.json(getAllNotes(self.repoRoot), { headers });
        }

        if (url.pathname === "/api/notes" && req.method === "GET") {
          const file = url.searchParams.get("file");
          if (!file) return new Response("Missing file param", { status: 400 });
          return Response.json(getNotesForFile(self.repoRoot, file), { headers });
        }

        if (url.pathname === "/api/notes" && req.method === "POST") {
          const body = await req.json() as { file: string; lineNo: number; content: string };
          const gitignorePath = join(self.repoRoot, ".gitignore");
          let gitignore = "";
          try { gitignore = readFileSync(gitignorePath, "utf-8"); } catch {}
          if (!gitignore.includes(".git-notes")) {
            writeFileSync(gitignorePath, gitignore + (gitignore.endsWith("\n") ? "" : "\n") + ".git-notes/\n");
          }
          const authorName = spawnSync("git", ["config", "user.name"], { encoding: "utf-8" }).stdout.trim();
          const authorEmail = spawnSync("git", ["config", "user.email"], { encoding: "utf-8" }).stdout.trim();
          setNote(self.repoRoot, body.file, body.lineNo, body.content, authorName, authorEmail);
          return Response.json({ ok: true }, { headers });
        }

        // --- History ---
        if (url.pathname === "/api/history/conversations" && req.method === "GET") {
          const all = url.searchParams.get("all") === "1";
          const repo = all ? undefined : self.repoRoot.split("/").pop();
          return Response.json(listConversations(repo), { headers });
        }

        if (url.pathname === "/api/history/conversations" && req.method === "POST") {
          const body = await req.json() as { file: string; title: string };
          const repo = self.repoRoot.split("/").pop() ?? "unknown";
          const id = createConversation(repo, body.file, body.title);
          return Response.json({ id }, { headers });
        }

        if (url.pathname === "/api/history/conversations" && req.method === "DELETE") {
          const id = parseInt(url.searchParams.get("id") ?? "0");
          if (id) deleteConversation(id);
          return Response.json({ ok: true }, { headers });
        }

        if (url.pathname === "/api/history/messages" && req.method === "GET") {
          const id = parseInt(url.searchParams.get("conversation_id") ?? "0");
          return Response.json(getMessages(id), { headers });
        }

        if (url.pathname === "/api/history/messages" && req.method === "POST") {
          const body = await req.json() as { conversation_id: number; role: string; content: string };
          addMessage(body.conversation_id, body.role as any, body.content);
          return Response.json({ ok: true }, { headers });
        }

        // --- PR comment (general) ---
        if (url.pathname === "/api/pr-comment" && req.method === "POST") {
          const body = await req.json() as { pr: number; body: string };
          const result = spawnSync("gh", ["pr", "comment", String(body.pr), "--body", body.body], { encoding: "utf-8" });
          return Response.json({ ok: result.status === 0, error: result.stderr?.trim() }, { headers });
        }

        // --- PR info ---
        if (url.pathname === "/api/pr-info" && req.method === "GET") {
          const ghCheck = spawnSync("gh", ["--version"], { encoding: "utf-8" });
          if (ghCheck.error || ghCheck.status !== 0) {
            return Response.json({ ghMissing: true }, { headers });
          }

          const branchResult = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf-8" });
          const branch = branchResult.stdout.trim() || "HEAD";

          const prListResult = spawnSync(
            "gh", ["pr", "list", "--head", branch, "--json", "number,title,body,state,url,author,createdAt,updatedAt,baseRefName,headRefName"],
            { encoding: "utf-8" }
          );

          if (prListResult.status !== 0 || !prListResult.stdout.trim()) {
            return Response.json({ prs: [] }, { headers });
          }

          let prs: any[] = [];
          try { prs = JSON.parse(prListResult.stdout); } catch { return Response.json({ prs: [] }, { headers }); }

          if (prs.length === 0) return Response.json({ prs: [] }, { headers });

          const nameWithOwner = getNameWithOwner();

          const enriched = prs.map((pr: any) => {
            const commentsResult = spawnSync(
              "gh", ["pr", "view", String(pr.number), "--json", "comments,reviews,reviewRequests"],
              { encoding: "utf-8" }
            );
            let comments: any[] = [], reviews: any[] = [], reviewRequests: any[] = [];
            if (commentsResult.status === 0) {
              try {
                const data = JSON.parse(commentsResult.stdout);
                comments = data.comments ?? [];
                reviews = data.reviews ?? [];
                reviewRequests = data.reviewRequests ?? [];
              } catch {}
            }

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

            const diffResult = spawnSync("gh", ["pr", "diff", String(pr.number)], { encoding: "utf-8" });
            const diff = diffResult.status === 0 ? diffResult.stdout : "";
            return { ...pr, comments, reviews, reviewRequests, reviewComments, timelineEvents, diff };
          });

          return Response.json({ prs: enriched }, { headers });
        }

        // --- PR reply ---
        if (url.pathname === "/api/pr-reply" && req.method === "POST") {
          const body = await req.json() as { pr: number; commentId: number; body: string };
          const nameWithOwner = getNameWithOwner();
          if (!nameWithOwner) return Response.json({ ok: false, error: "Could not get repo" }, { status: 500, headers });

          const result = spawnSync("gh", [
            "api", `repos/${nameWithOwner}/pulls/${body.pr}/comments`,
            "--method", "POST",
            "--field", `body=${body.body}`,
            "--field", `in_reply_to=${body.commentId}`,
          ], { encoding: "utf-8" });

          return Response.json({ ok: result.status === 0 }, { headers });
        }

        if (url.pathname === "/api/pr-review-threads" && req.method === "GET") {
          const prNum = url.searchParams.get("pr");
          if (!prNum) return Response.json({}, { status: 400, headers });

          const nameWithOwner = getNameWithOwner();
          if (!nameWithOwner) return Response.json({}, { headers });

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

          return Response.json(groupReviewComments(rawComments), { headers });
        }

        if (url.pathname === "/api/pr-file-diff" && req.method === "GET") {
          const prNum = url.searchParams.get("pr");
          const file = url.searchParams.get("file");
          if (!prNum || !file) return new Response("Missing params", { status: 400, headers });

          const result = spawnSync("gh", ["pr", "diff", prNum], { encoding: "utf-8" });
          if (result.status !== 0) return new Response("", { headers: { "Content-Type": "text/plain", ...headers } });

          const sections = result.stdout.split(/^(?=diff --git )/m);
          const section = sections.find(s => s.includes(`b/${file}`) || s.includes(` b/${file}\n`));

          return new Response(section ?? "", {
            headers: { "Content-Type": "text/plain; charset=utf-8", ...headers },
          });
        }

        // --- Stashes ---
        if (url.pathname === "/api/stashes" && req.method === "GET") {
          const result = spawnSync("git", ["stash", "list", "--format=%gd|%s|%ci"], { encoding: "utf-8" });
          if (result.status !== 0) return Response.json({ stashes: [] }, { headers });
          const stashes = result.stdout.trim().split("\n").filter(Boolean).map((line) => {
            const [ref, ...rest] = line.split("|");
            const date = rest.pop() ?? "";
            const message = rest.join("|");
            return { ref, message, date };
          });
          return Response.json({ stashes }, { headers });
        }

        if (url.pathname === "/api/stash" && req.method === "POST") {
          const body = await req.json() as { message?: string; includeUntracked?: boolean };
          const args = ["stash", "push"];
          if (body.includeUntracked) args.push("-u");
          if (body.message) args.push("-m", body.message);
          const result = spawnSync("git", args, { encoding: "utf-8" });
          return Response.json({
            ok: result.status === 0,
            output: result.stdout + result.stderr,
          }, { headers });
        }

        if (url.pathname === "/api/stash/apply" && req.method === "POST") {
          const body = await req.json() as { ref: string };
          const result = spawnSync("git", ["stash", "apply", body.ref], { encoding: "utf-8" });
          return Response.json({
            ok: result.status === 0,
            output: result.stdout + result.stderr,
          }, { headers });
        }

        if (url.pathname === "/api/stash/pop" && req.method === "POST") {
          const body = await req.json() as { ref: string };
          const result = spawnSync("git", ["stash", "pop", body.ref], { encoding: "utf-8" });
          return Response.json({
            ok: result.status === 0,
            output: result.stdout + result.stderr,
          }, { headers });
        }

        if (url.pathname === "/api/stash/drop" && req.method === "POST") {
          const body = await req.json() as { ref: string };
          const result = spawnSync("git", ["stash", "drop", body.ref], { encoding: "utf-8" });
          return Response.json({
            ok: result.status === 0,
            output: result.stdout + result.stderr,
          }, { headers });
        }

        if (url.pathname === "/api/stash/diff" && req.method === "GET") {
          const ref = url.searchParams.get("ref");
          if (!ref) return new Response("Missing ref", { status: 400 });
          const result = spawnSync("git", ["stash", "show", "-p", ref], { encoding: "utf-8" });
          return new Response(result.stdout, {
            headers: { "Content-Type": "text/plain; charset=utf-8", ...headers },
          });
        }

        // --- Claude review endpoints ---

        if (url.pathname === "/api/review" && req.method === "POST") {
          const body = await req.json() as {
            file: string;
            diff: string;
            warnings: { line: number; pattern: string; content: string }[];
            warningsSummary: string;
          };

          const warningsSection = body.warnings.length > 0
            ? `\n\nSecurity warnings already detected by the scanner:\n${body.warnings.map(w => `- Line ${w.line}: ${w.pattern} — \`${w.content}\``).join("\n")}`
            : "";

          const fileNotes = getNotesForFile(self.repoRoot, body.file);
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
              streamAIResponse(prompt, provider, self.repoRoot, send, finish);
            },
          });
          return new Response(stream, {
            headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", ...headers },
          });
        }

        if (url.pathname === "/api/review-all" && req.method === "POST") {
          const body = await req.json() as { files: string[]; userNote: string };

          const diffs = body.files.map((file) => {
            const r = spawnSync("git", ["diff", "--cached", "--", file], { encoding: "utf-8" });
            return { file, diff: r.stdout ?? "" };
          });

          const diffSection = diffs
            .filter((d) => d.diff.trim())
            .map((d) => {
              const fileNotes = getNotesForFile(self.repoRoot, d.file);
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
              streamAIResponse(prompt, provider, self.repoRoot, send, finish);
            },
          });
          return new Response(stream, {
            headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", ...headers },
          });
        }

        if (url.pathname === "/api/review-message" && req.method === "POST") {
          const body = await req.json() as {
            file: string;
            messages: { role: string; content: string }[];
          };

          const history = body.messages.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
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
              streamAIResponse(history, provider, self.repoRoot, send, finish);
            },
          });
          return new Response(stream, {
            headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", ...headers },
          });
        }

        if (url.pathname === "/api/review-save" && req.method === "POST") {
          const body = await req.json() as { file: string; content: string };
          const reviewDir = join(self.repoRoot, ".reviews");
          mkdirSync(reviewDir, { recursive: true });

          const gitignorePath = join(self.repoRoot, ".gitignore");
          let gitignore = "";
          try { gitignore = readFileSync(gitignorePath, "utf-8"); } catch {}
          if (!gitignore.includes(".reviews")) {
            writeFileSync(gitignorePath, gitignore + (gitignore.endsWith("\n") ? "" : "\n") + ".reviews/\n");
          }

          const safeName = body.file.replace(/\//g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
          const outPath = join(reviewDir, `${safeName}.md`);
          writeFileSync(outPath, body.content);
          return Response.json({ ok: true, path: `.reviews/${safeName}.md` }, { headers });
        }

        // --- Settings ---
        if (url.pathname === "/api/settings" && req.method === "GET") {
          return Response.json(readSettings(), { headers });
        }

        if (url.pathname === "/api/settings" && req.method === "POST") {
          const body = await req.json();
          writeSettings(body);
          return Response.json({ ok: true }, { headers });
        }

        // --- Static files ---
        let filePath: string;
        if (url.pathname === "/" || url.pathname === "/index.html") {
          filePath = join(uiDistPath, "index.html");
        } else {
          filePath = join(uiDistPath, url.pathname);
        }

        if (!existsSync(filePath)) {
          const indexPath = join(uiDistPath, "index.html");
          if (!existsSync(indexPath)) {
            return new Response("UI not built. Run: bun run build", { status: 503 });
          }
          filePath = indexPath;
        }

        const ext = extname(filePath);
        return new Response(readFileSync(filePath), {
          headers: { "Content-Type": MIME[ext] ?? "application/octet-stream" },
        });
      },
    });

    console.log(`\x1b[2m  url\x1b[0m    \x1b[36m\x1b[4m${uiUrl}\x1b[0m`);
    console.log(`\n\x1b[2m  watching for changes... Ctrl+C to stop\x1b[0m\n`);

    // Open browser
    const platform = process.platform;
    const openCmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
    spawn(openCmd, [uiUrl], { detached: true, stdio: "ignore" }).unref();

    // Cleanup on exit
    const cleanup = () => {
      unregisterRoute(this.hostname);
      process.exit(0);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Keep alive
    await new Promise(() => {});
  }

  private broadcast(data: string) {
    const encoded = new TextEncoder().encode(`data: ${data}\n\n`);
    for (const ctrl of this.sseClients) {
      try { ctrl.enqueue(encoded); } catch { this.sseClients.delete(ctrl); }
    }
  }
}
