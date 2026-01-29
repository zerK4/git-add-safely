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

  private generateHTML(context: PluginContext): string {
    const files = context.stagedFiles
      .map(
        (f) => `
      <div class="file-item">
        <div class="file-header">
          <span class="status-badge status-${f.status}">${f.status}</span>
          <span class="file-path">${this.escapeHtml(f.path)}</span>
        </div>
      </div>
    `,
      )
      .join("");

    const warnings = context.scanResults
      .map(
        (r) => `
      <div class="warning-item">
        <div class="warning-header">
          <span class="warning-icon">⚠️</span>
          <span class="warning-pattern">${this.escapeHtml(r.pattern)}</span>
        </div>
        <div class="warning-details">
          <span class="warning-file">${this.escapeHtml(r.file)}:${r.line}</span>
          <pre class="warning-content">${this.escapeHtml(r.content)}</pre>
        </div>
      </div>
    `,
      )
      .join("");

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>git-add-safely - Review Changes</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      padding: 2rem;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      color: #58a6ff;
    }
    .subtitle {
      color: #8b949e;
      margin-bottom: 2rem;
    }
    .section {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .section-title {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      color: #f0f6fc;
    }
    .file-item {
      padding: 0.75rem;
      border-bottom: 1px solid #21262d;
    }
    .file-item:last-child { border-bottom: none; }
    .file-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .status-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 3px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-added { background: #238636; color: #fff; }
    .status-modified { background: #1f6feb; color: #fff; }
    .status-deleted { background: #da3633; color: #fff; }
    .file-path {
      font-family: ui-monospace, monospace;
      color: #58a6ff;
    }
    .warning-item {
      padding: 1rem;
      background: #271d1b;
      border: 1px solid #bd561d;
      border-radius: 6px;
      margin-bottom: 1rem;
    }
    .warning-item:last-child { margin-bottom: 0; }
    .warning-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .warning-pattern {
      font-weight: 600;
      color: #f85149;
    }
    .warning-file {
      font-family: ui-monospace, monospace;
      color: #8b949e;
      font-size: 0.875rem;
    }
    .warning-content {
      margin-top: 0.5rem;
      padding: 0.75rem;
      background: #0d1117;
      border-radius: 3px;
      overflow-x: auto;
      font-size: 0.875rem;
    }
    .actions {
      display: flex;
      gap: 1rem;
      margin-top: 2rem;
    }
    button {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-approve {
      background: #238636;
      color: #fff;
    }
    .btn-approve:hover { background: #2ea043; }
    .btn-cancel {
      background: #21262d;
      color: #c9d1d9;
      border: 1px solid #30363d;
    }
    .btn-cancel:hover { background: #30363d; }
    .empty {
      color: #8b949e;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 git-add-safely</h1>
    <p class="subtitle">Review your changes before committing</p>

    <div class="section">
      <h2 class="section-title">📁 Staged Files (${context.stagedFiles.length})</h2>
      ${files || '<p class="empty">No files staged</p>'}
    </div>

    ${
      context.scanResults.length > 0
        ? `
    <div class="section">
      <h2 class="section-title">⚠️ Warnings (${context.scanResults.length})</h2>
      ${warnings}
    </div>
    `
        : ""
    }

    <div class="actions">
      <button class="btn-approve" onclick="approve()">
        ✓ Approve & Continue
      </button>
      <button class="btn-cancel" onclick="cancel()">
        ✗ Cancel
      </button>
    </div>
  </div>

  <script>
    async function approve() {
      await fetch('/api/approve', { method: 'POST' });
      document.body.innerHTML = '<div style="text-align:center;margin-top:5rem;"><h1>✅ Approved!</h1><p>You can close this window.</p></div>';
      setTimeout(() => window.close(), 2000);
    }

    async function cancel() {
      await fetch('/api/cancel', { method: 'POST' });
      document.body.innerHTML = '<div style="text-align:center;margin-top:5rem;"><h1>❌ Cancelled</h1><p>You can close this window.</p></div>';
      setTimeout(() => window.close(), 2000);
    }
  </script>
</body>
</html>
    `;
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
