import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
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

const PORT = 3450;

export class WatchModeServer {
  private repoRoot: string;
  private watcher: GitWatcher;
  private scanner: SecretScanner;
  private sseClients = new Set<ReadableStreamDefaultController>();

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
    this.watcher = new GitWatcher();
    this.scanner = new SecretScanner();
  }

  async start() {
    const repoName = this.repoRoot.split("/").pop() ?? "unknown";
    console.log(`\nWatch mode — repo: ${repoName}`);
    console.log(`Opening web UI at http://localhost:${PORT}`);

    // Start file watcher — broadcast changes to all SSE clients
    this.watcher.onChange((status) => {
      this.broadcast(JSON.stringify({ type: "status", ...status }));
    });
    this.watcher.start(2000);

    const self = this;
    const uiDistPath = join(import.meta.dir, "ui");

    const server = Bun.serve({
      port: PORT,
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

        // --- Diff stats (staged) ---
        if (url.pathname === "/api/diff-stats") {
          const result = spawnSync("git", ["diff", "--cached", "--numstat"], { encoding: "utf-8" });
          const stats: Record<string, { added: number; removed: number }> = {};
          for (const line of result.stdout.trim().split("\n").filter(Boolean)) {
            const [added, removed, ...fileParts] = line.split("\t");
            const file = fileParts.join("\t");
            stats[file] = { added: parseInt(added) || 0, removed: parseInt(removed) || 0 };
          }
          return Response.json(stats, { headers });
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

    console.log(`Server running on http://localhost:${PORT}`);
    console.log("Watching for git changes... (Ctrl+C to stop)\n");

    // Open browser
    spawn("open", [`http://localhost:${PORT}`], { detached: true, stdio: "ignore" }).unref();

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
