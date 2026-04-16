import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createServer } from "node:net";

export interface RouteEntry {
  port: number;
  pid: number;
  startedAt: string;
}

export type RoutesMap = Record<string, RouteEntry>;

const DATA_DIR = join(homedir(), ".git-add-safely");
const ROUTES_FILE = join(DATA_DIR, "routes.json");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getRoutes(): RoutesMap {
  ensureDataDir();
  if (!existsSync(ROUTES_FILE)) return {};
  try {
    return JSON.parse(readFileSync(ROUTES_FILE, "utf-8")) as RoutesMap;
  } catch {
    return {};
  }
}

function writeRoutes(routes: RoutesMap): void {
  ensureDataDir();
  const tmp = ROUTES_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(routes, null, 2), { mode: 0o600 });
  try {
    renameSync(tmp, ROUTES_FILE);
  } catch {
    // Fallback for Windows locked-file edge case
    writeFileSync(ROUTES_FILE, JSON.stringify(routes, null, 2), { mode: 0o600 });
  }
}

export function registerRoute(hostname: string, port: number, pid: number): void {
  const routes = getRoutes();
  routes[hostname] = { port, pid, startedAt: new Date().toISOString() };
  writeRoutes(routes);
}

export function unregisterRoute(hostname: string): void {
  const routes = getRoutes();
  delete routes[hostname];
  writeRoutes(routes);
}

export function cleanStaleRoutes(): void {
  const routes = getRoutes();
  let changed = false;
  for (const [hostname, entry] of Object.entries(routes)) {
    if (!isPidAlive(entry.pid)) {
      delete routes[hostname];
      changed = true;
    }
  }
  if (changed) writeRoutes(routes);
}

export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close(() => reject(new Error("Could not get address")));
        return;
      }
      const port = addr.port;
      server.close(() => resolve(port));
    });
  });
}
