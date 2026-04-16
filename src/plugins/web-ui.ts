import type { Plugin, PluginContext } from "../types/plugin";
import { spawn } from "node:child_process";

interface WebUIConfig {
  autoOpen?: boolean;
  port?: number;
}

export class WebUIPlugin implements Plugin {
  name = "web-ui";
  version = "1.0.0";
  description = "Interactive web UI for reviewing changes";

  private config: WebUIConfig = {
    autoOpen: true,
    port: 3450,
  };
  private serverProcess: any = null;
  private decisionResolver: ((value: boolean) => void) | null = null;

  async init(config?: WebUIConfig) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  hooks = {
    afterScan: async (context: PluginContext): Promise<PluginContext> => {
      // Only show UI if there are staged files
      if (context.stagedFiles.length === 0) {
        return context;
      }

      console.log(`\nOpening web UI at http://localhost:${this.config.port}`);

      // Start server
      await this.startServer(context);

      // Auto-open browser if configured
      if (this.config.autoOpen) {
        this.openBrowser();
      }

      // Wait for user interaction (the server will communicate back)
      const userDecision = await this.waitForUserDecision();

      if (!userDecision) {
        throw new Error("User cancelled the operation");
      }

      return context;
    },
  };

  private async startServer(context: PluginContext) {
    // Start Bun server with React app
    // For now, we'll create a simple HTML page
    const html = this.generateHTML(context);
    const self = this;

    const server = Bun.serve({
      port: this.config.port,
      fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === "/") {
          return new Response(html, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }

        if (url.pathname === "/api/context") {
          return Response.json(context);
        }

        if (url.pathname === "/api/approve") {
          // User approved - close server and continue
          console.log("\nUser approved changes");
          if (self.decisionResolver) {
            self.decisionResolver(true);
          }
          server.stop();
          return Response.json({ ok: true, canceled: false });
        }

        if (url.pathname === "/api/cancel") {
          // User cancelled - close server and abort
          console.log("\nUser cancelled operation");
          if (self.decisionResolver) {
            self.decisionResolver(false);
          }
          server.stop();
          return Response.json({ ok: true, cancelled: true });
        }

        return new Response("Not Found", { status: 404 });
      },
    });

    console.log(`Server running on http://localhost:${this.config.port}`);
    this.serverProcess = server;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // SVG icons as HTML strings — no emoji, no encoding issues
  private readonly icons = {
    warn: `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm1 6a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z"/></svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>`,
    x: `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>`,
    checkLg: `<svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>`,
    xLg: `<svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>`,
  } as const;

  private generateHTML(context: PluginContext): string {
    const statusMeta: Record<string, { label: string; color: string; dot: string }> = {
      added:    { label: "A", color: "#3fb950", dot: "#3fb950" },
      modified: { label: "M", color: "#d29922", dot: "#d29922" },
      deleted:  { label: "D", color: "#f85149", dot: "#f85149" },
      renamed:  { label: "R", color: "#79c0ff", dot: "#79c0ff" },
    };

    const countByStatus = (status: string) =>
      context.stagedFiles.filter((f) => f.status === status).length;

    const statsHtml = ["added", "modified", "deleted", "renamed"]
      .filter((s) => countByStatus(s) > 0)
      .map((s) => {
        const m = statusMeta[s];
        return `<span class="stat" style="color:${m.color}"><span class="stat-dot" style="background:${m.dot}"></span>${countByStatus(s)} ${s}</span>`;
      })
      .join("");

    const groupedFiles: Record<string, typeof context.stagedFiles> = {};
    for (const f of context.stagedFiles) {
      const parts = f.path.split("/");
      const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
      if (!groupedFiles[dir]) groupedFiles[dir] = [];
      groupedFiles[dir].push(f);
    }

    const filesHtml = Object.entries(groupedFiles)
      .map(([dir, files]) => {
        const filesRows = files.map((f) => {
          const m = statusMeta[f.status] ?? { label: "?", color: "#8b949e", dot: "#8b949e" };
          const filename = f.path.split("/").pop() ?? f.path;
          const sensitiveFile = context.scanResults.some((r) => r.file === f.path);
          return `
            <div class="file-row${sensitiveFile ? " file-sensitive" : ""}">
              <span class="file-status" style="color:${m.color}">${m.label}</span>
              <span class="file-name">${this.escapeHtml(filename)}</span>
              ${sensitiveFile ? `<span class="file-warn-badge">${this.icons.warn} sensitive</span>` : ""}
            </div>`;
        }).join("");

        return `
          <div class="file-group">
            ${dir ? `<div class="file-dir">${this.escapeHtml(dir)}/</div>` : ""}
            ${filesRows}
          </div>`;
      })
      .join("");

    const warningsHtml = context.scanResults.map((r) => `
      <div class="warning-card">
        <div class="warning-top">
          <span class="warning-tag">${this.escapeHtml(r.pattern)}</span>
          <span class="warning-loc">${this.escapeHtml(r.file)}:${r.line}</span>
        </div>
        <pre class="warning-code">${this.escapeHtml(r.content)}</pre>
      </div>`).join("");

    const hasWarnings = context.scanResults.length > 0;
    const badgeHtml = hasWarnings
      ? `<span class="header-badge header-badge--warn">${this.icons.warn} ${context.scanResults.length} warning${context.scanResults.length !== 1 ? "s" : ""}</span>`
      : `<span class="header-badge header-badge--ok">${this.icons.check} No issues found</span>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>git-add-safely</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --surface2: #1c2128;
      --border: #30363d;
      --border2: #21262d;
      --text: #e6edf3;
      --text-muted: #7d8590;
      --blue: #58a6ff;
      --green: #3fb950;
      --yellow: #d29922;
      --red: #f85149;
      --orange: #e3b341;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      line-height: 1.5;
      min-height: 100vh;
    }

    .layout {
      display: grid;
      grid-template-columns: 280px 1fr;
      grid-template-rows: auto 1fr auto;
      min-height: 100vh;
    }

    /* Header */
    .header {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }
    .header-logo {
      font-size: 16px;
      font-weight: 600;
      color: var(--text);
      letter-spacing: -0.3px;
    }
    .header-logo span { color: var(--blue); }
    .header-sep { color: var(--border); margin: 0 2px; }
    .header-sub { color: var(--text-muted); font-size: 13px; }
    .header-badge {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      font-weight: 500;
      padding: 3px 10px;
      border-radius: 20px;
    }
    .header-badge--warn {
      background: rgba(248,81,73,0.12);
      color: var(--red);
      border: 1px solid rgba(248,81,73,0.3);
    }
    .header-badge--ok {
      background: rgba(63,185,80,0.12);
      color: var(--green);
      border: 1px solid rgba(63,185,80,0.3);
    }

    /* Sidebar */
    .sidebar {
      border-right: 1px solid var(--border);
      background: var(--surface);
      overflow-y: auto;
      padding: 16px 0;
    }
    .sidebar-section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--text-muted);
      padding: 0 16px 8px;
    }
    .stats-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 16px 16px;
    }
    .stat {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      font-weight: 500;
    }
    .stat-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .file-group { padding: 0 0 8px; }
    .file-dir {
      font-size: 11px;
      color: var(--text-muted);
      padding: 4px 16px 2px;
      font-family: ui-monospace, "SF Mono", monospace;
    }
    .file-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 16px;
      cursor: default;
      transition: background 0.1s;
    }
    .file-row:hover { background: var(--surface2); }
    .file-row.file-sensitive { background: rgba(248,81,73,0.05); }
    .file-row.file-sensitive:hover { background: rgba(248,81,73,0.1); }
    .file-status {
      font-size: 11px;
      font-weight: 700;
      font-family: ui-monospace, monospace;
      width: 14px;
      flex-shrink: 0;
    }
    .file-name {
      font-family: ui-monospace, "SF Mono", monospace;
      font-size: 12.5px;
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .file-warn-badge {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 600;
      color: var(--orange);
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* Main content */
    .main {
      overflow-y: auto;
      padding: 24px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: var(--text-muted);
      gap: 8px;
    }
    .empty-state svg { color: var(--green); }

    .warnings-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--red);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .warning-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-left: 3px solid var(--red);
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 10px;
    }
    .warning-card:last-child { margin-bottom: 0; }
    .warning-top {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .warning-tag {
      font-size: 11px;
      font-weight: 600;
      background: rgba(248,81,73,0.15);
      color: var(--red);
      padding: 2px 8px;
      border-radius: 3px;
    }
    .warning-loc {
      font-family: ui-monospace, monospace;
      font-size: 11px;
      color: var(--text-muted);
    }
    .warning-code {
      font-family: ui-monospace, "SF Mono", "Cascadia Code", monospace;
      font-size: 12px;
      background: var(--bg);
      border: 1px solid var(--border2);
      border-radius: 4px;
      padding: 8px 12px;
      overflow-x: auto;
      color: var(--orange);
      white-space: pre;
    }

    /* Footer / Actions */
    .footer {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 20px;
      border-top: 1px solid var(--border);
      background: var(--surface);
    }
    .footer-info {
      font-size: 12px;
      color: var(--text-muted);
      margin-right: auto;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
    }
    button:active { transform: scale(0.98); }
    .btn-approve { background: var(--green); color: #fff; }
    .btn-approve:hover { opacity: 0.88; }
    .btn-cancel {
      background: var(--surface2);
      color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .btn-cancel:hover { background: var(--border); color: var(--text); }

    .done-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 12px;
      color: var(--text-muted);
      font-size: 15px;
    }
    .done-screen .done-title { font-size: 20px; font-weight: 600; color: var(--text); }
  </style>
</head>
<body>
  <div class="layout">
    <header class="header">
      <div class="header-logo">git<span>-add-safely</span></div>
      <span class="header-sep">/</span>
      <span class="header-sub">Review staged changes</span>
      ${badgeHtml}
    </header>

    <aside class="sidebar">
      <div class="sidebar-section-title">Files &middot; ${context.stagedFiles.length}</div>
      <div class="stats-row">${statsHtml}</div>
      <div class="file-list">${filesHtml || '<p style="padding:0 16px;color:var(--text-muted);font-size:12px">No files</p>'}</div>
    </aside>

    <main class="main">
      ${hasWarnings
        ? `<div class="warnings-title">${this.icons.warn} Potential secrets detected</div>${warningsHtml}`
        : `<div class="empty-state"><div>${this.icons.checkLg}</div><div>No sensitive patterns found</div></div>`
      }
    </main>

    <footer class="footer">
      <span class="footer-info">${context.stagedFiles.length} file${context.stagedFiles.length !== 1 ? "s" : ""} staged${hasWarnings ? ` &middot; ${context.scanResults.length} warning${context.scanResults.length !== 1 ? "s" : ""}` : ""}</span>
      <button class="btn-cancel" onclick="cancel()">${this.icons.x} Cancel</button>
      <button class="btn-approve" onclick="approve()">${this.icons.check} Approve &amp; Continue</button>
    </footer>
  </div>

  <script>
    async function approve() {
      await fetch('/api/approve', { method: 'POST' });
      document.body.innerHTML = '<div class="done-screen"><div style="color:var(--green)">${this.icons.checkLg}</div><div class="done-title">Approved</div><div>You can close this window.</div></div>';
      setTimeout(() => window.close(), 1800);
    }
    async function cancel() {
      await fetch('/api/cancel', { method: 'POST' });
      document.body.innerHTML = '<div class="done-screen"><div style="color:var(--red)">${this.icons.xLg}</div><div class="done-title">Cancelled</div><div>You can close this window.</div></div>';
      setTimeout(() => window.close(), 1800);
    }
  </script>
</body>
</html>`;
  }

  private openBrowser() {
    const url = `http://localhost:${this.config.port}`;
    const platform = process.platform;

    let command: string;
    if (platform === "darwin") command = "open";
    else if (platform === "win32") command = "start";
    else command = "xdg-open";

    spawn(command, [url], { detached: true, stdio: "ignore" }).unref();
  }

  private async waitForUserDecision(): Promise<boolean> {
    return new Promise((resolve) => {
      this.decisionResolver = resolve;

      // Timeout after 5 minutes
      setTimeout(() => {
        console.log("\nTimeout - auto-approving");
        resolve(true);
      }, 300000);
    });
  }

  async cleanup() {
    if (this.serverProcess) {
      try {
        this.serverProcess.stop();
      } catch (err) {
        // Server already stopped
      }
    }
  }
}
