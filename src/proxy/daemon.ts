// Standalone reverse proxy daemon — HTTPS on port 443.
// Compiled separately as dist/proxy/daemon.js — spawned detached by manager.ts.
// Uses only Node built-ins: no Bun APIs, no external deps.

import {
  createServer as createHttpServer,
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { connect as netConnect } from "node:net";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DATA_DIR = join(homedir(), ".git-add-safely");
const ROUTES_FILE = join(DATA_DIR, "routes.json");
const CERT_FILE = join(DATA_DIR, "certs", "cert.pem");
const KEY_FILE = join(DATA_DIR, "certs", "key.pem");
const HTTPS_PORT = 443;
const HTTP_PORT = 80;

type RoutesMap = Record<string, { port: number; pid: number }>;

function getRoutes(): RoutesMap {
  if (!existsSync(ROUTES_FILE)) return {};
  try {
    return JSON.parse(readFileSync(ROUTES_FILE, "utf-8")) as RoutesMap;
  } catch {
    return {};
  }
}

function parseHost(raw: string | undefined): string {
  if (!raw) return "";
  const colon = raw.lastIndexOf(":");
  if (colon === -1) return raw;
  if (/^\d+$/.test(raw.slice(colon + 1))) return raw.slice(0, colon);
  return raw;
}

const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailers", "transfer-encoding", "upgrade",
]);

function proxyHttpRequest(req: IncomingMessage, res: ServerResponse, targetPort: number): void {
  const headers: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) headers[k] = v;
  }
  const existing = req.headers["x-forwarded-for"];
  const remoteAddr = req.socket.remoteAddress ?? "127.0.0.1";
  headers["x-forwarded-for"] = existing ? `${existing}, ${remoteAddr}` : remoteAddr;
  headers["x-forwarded-host"] = req.headers.host ?? "";
  headers["x-forwarded-proto"] = "https";

  const proxyReq = httpRequest(
    {
      hostname: "127.0.0.1",
      port: targetPort,
      path: req.url ?? "/",
      method: req.method ?? "GET",
      headers,
    },
    (proxyRes) => {
      const resHeaders: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(proxyRes.headers)) {
        if (v !== undefined) resHeaders[k] = v;
      }
      res.writeHead(proxyRes.statusCode ?? 200, resHeaders);

      // Flush immediately for SSE
      if (proxyRes.headers["content-type"]?.startsWith("text/event-stream")) {
        (res as any).flushHeaders?.();
      }

      proxyRes.pipe(res, { end: true });
    }
  );

  proxyReq.on("error", (err) => {
    if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`Bad Gateway: ${err.message}`);
  });

  req.pipe(proxyReq, { end: true });
}

function notFound(res: ServerResponse, hostname: string): void {
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  res.end(
    `<h2>No route for ${hostname}</h2>` +
    `<p>No git-add-safely instance is running for this project.</p>` +
    `<p>Start one: <code>git-add-safely --watch</code></p>`
  );
}

function handleUpgrade(req: IncomingMessage, socket: any, head: Buffer): void {
  const hostname = parseHost(req.headers.host);
  const route = getRoutes()[hostname];
  if (!route) { socket.write("HTTP/1.1 404 Not Found\r\n\r\n"); socket.destroy(); return; }

  const targetSocket = netConnect(route.port, "127.0.0.1", () => {
    const requestLine = `${req.method ?? "GET"} ${req.url ?? "/"} HTTP/1.1\r\n`;
    const headerLines = Object.entries(req.headers)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("\r\n");
    targetSocket.write(`${requestLine}${headerLines}\r\n\r\n`);
    if (head?.length) targetSocket.write(head);
    targetSocket.pipe(socket);
    socket.pipe(targetSocket);
  });
  targetSocket.on("error", () => { socket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n"); socket.destroy(); });
  socket.on("error", () => targetSocket.destroy());
}

const hasCerts = existsSync(CERT_FILE) && existsSync(KEY_FILE);

if (hasCerts) {
  // HTTPS server on 443
  const tlsOptions = {
    cert: readFileSync(CERT_FILE),
    key: readFileSync(KEY_FILE),
  };

  const httpsServer = createHttpsServer(tlsOptions, (req, res) => {
    const hostname = parseHost(req.headers.host);
    const route = getRoutes()[hostname];
    if (!route) { notFound(res, hostname); return; }
    proxyHttpRequest(req, res, route.port);
  });
  httpsServer.on("upgrade", handleUpgrade);
  httpsServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EACCES") { process.stderr.write(`[proxy] EACCES: cannot bind port ${HTTPS_PORT}\n`); process.exit(2); }
    process.stderr.write(`[proxy] Fatal: ${err.message}\n`); process.exit(1);
  });
  httpsServer.listen(HTTPS_PORT, "0.0.0.0", () => {
    process.stdout.write(`[proxy] HTTPS listening on port ${HTTPS_PORT}\n`);
    process.stdout.write("PROXY_READY\n");
  });

  // HTTP → HTTPS redirect on port 80
  const redirectServer = createHttpServer((req, res) => {
    const host = parseHost(req.headers.host);
    res.writeHead(301, { Location: `https://${host}${req.url ?? "/"}` });
    res.end();
  });
  redirectServer.listen(HTTP_PORT, "0.0.0.0");

  function shutdown() {
    httpsServer.close();
    redirectServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

} else {
  // Fallback: HTTP only on port 80 (certs not generated yet)
  const httpServer = createHttpServer((req, res) => {
    const hostname = parseHost(req.headers.host);
    const route = getRoutes()[hostname];
    if (!route) { notFound(res, hostname); return; }
    proxyHttpRequest(req, res, route.port);
  });
  httpServer.on("upgrade", handleUpgrade);
  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EACCES") { process.stderr.write(`[proxy] EACCES: cannot bind port ${HTTP_PORT}\n`); process.exit(2); }
    process.stderr.write(`[proxy] Fatal: ${err.message}\n`); process.exit(1);
  });
  httpServer.listen(HTTP_PORT, "0.0.0.0", () => {
    process.stdout.write(`[proxy] HTTP listening on port ${HTTP_PORT}\n`);
    process.stdout.write("PROXY_READY\n");
  });

  function shutdown() {
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
