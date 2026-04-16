import { spawn, spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  openSync,
  closeSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { connect as netConnect } from "node:net";
import { fileURLToPath } from "node:url";
import { ensureCerts, certsExist } from "../core/cert-manager";

const DATA_DIR = join(homedir(), ".git-add-safely");
const PID_FILE = join(DATA_DIR, "proxy.pid");
const LOG_FILE = join(DATA_DIR, "proxy.log");
// Port determined at runtime after cert check in ensureProxyRunning()

// manager.ts is bundled into dist/index.js — use that as anchor
// daemon.ts is compiled separately to dist/proxy/daemon.js
const DAEMON_PATH = join(dirname(fileURLToPath(import.meta.url)), "proxy", "daemon.js");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = netConnect(port, "127.0.0.1");
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.setTimeout(300, () => { socket.destroy(); resolve(false); });
  });
}

function readPid(): number | null {
  if (!existsSync(PID_FILE)) return null;
  try {
    const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function isPidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}

function writePid(pid: number): void {
  ensureDataDir();
  writeFileSync(PID_FILE, String(pid), { mode: 0o600 });
}

function clearPid(): void {
  if (existsSync(PID_FILE)) {
    try { unlinkSync(PID_FILE); } catch {}
  }
}

function resolveNodeExe(): string {
  // process.execPath may be bun — find actual node binary
  const { execSync } = require("node:child_process") as typeof import("node:child_process");
  try {
    return execSync("which node", { encoding: "utf-8" }).trim();
  } catch {
    return "node"; // fallback, let PATH resolve it
  }
}

function spawnDaemon(useSudo: boolean): Promise<number> {
  return new Promise((resolve, reject) => {
    ensureDataDir();
    const nodeExe = resolveNodeExe();
    const logFd = openSync(LOG_FILE, "a");

    let child: ReturnType<typeof spawn>;
    if (useSudo && process.stdin.isTTY) {
      // Interactive TTY — sudo prompts for password inline
      const result = spawnSync("sudo", [nodeExe, DAEMON_PATH], {
        stdio: ["inherit", "inherit", "inherit"],
        detached: false,
      });
      closeSync(logFd);
      if (result.status === 2) { reject(new Error("EACCES")); return; }
      if (result.status !== 0) { reject(new Error(`exit ${result.status}`)); return; }
      resolve(-1);
      return;
    }

    const cmd = useSudo ? "sudo" : nodeExe;
    const args = useSudo ? ["-n", nodeExe, DAEMON_PATH] : [DAEMON_PATH];

    child = spawn(cmd, args, {
      detached: true,
      stdio: ["ignore", "pipe", logFd],
      env: { ...process.env },
    });

    let output = "";
    const timeout = setTimeout(() => {
      child.stdout?.destroy();
      closeSync(logFd);
      reject(new Error("Timeout waiting for proxy to start"));
    }, 5000);

    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes("PROXY_READY")) {
        clearTimeout(timeout);
        child.stdout?.destroy();
        child.unref();
        closeSync(logFd);
        resolve(child.pid!);
      }
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      closeSync(logFd);
      if (code === 2) reject(new Error("EACCES"));
      else reject(new Error(`Daemon exited with code ${code}`));
    });
  });
}

export async function ensureProxyRunning(): Promise<void> {
  // Always ensure certs first — before any port check
  const hadCerts = certsExist();
  try {
    ensureCerts();
  } catch (err) {
    console.warn(`\x1b[33m  warn   HTTPS setup failed: ${(err as Error).message}\x1b[0m`);
    console.warn(`\x1b[2m         Falling back to HTTP.\x1b[0m`);
  }
  const nowHasCerts = certsExist();
  const certsJustGenerated = !hadCerts && nowHasCerts;

  const targetPort = nowHasCerts ? 443 : 80;
  const portBusy = await isPortListening(targetPort);

  if (portBusy && !certsJustGenerated) {
    // Already listening on correct port — done
    return;
  }

  // Kill old HTTP daemon if certs were just generated (need to upgrade to HTTPS)
  if (certsJustGenerated) {
    const oldPid = readPid();
    if (oldPid && isPidAlive(oldPid)) {
      try { process.kill(oldPid, "SIGTERM"); } catch {}
      clearPid();
      await new Promise((r) => setTimeout(r, 400));
    }
    // Also kill anything on port 80 (old daemon without PID file)
    if (await isPortListening(80)) {
      // Can't kill without PID — just let it be, HTTPS on 443 will work
    }
  }

  // Check stale PID
  const existingPid = readPid();
  if (existingPid) {
    if (isPidAlive(existingPid)) {
      await new Promise((r) => setTimeout(r, 300));
      if (await isPortListening(targetPort)) return;
    }
    clearPid();
  }

  console.log(`\x1b[2m  proxy  Starting on port ${targetPort}...\x1b[0m`);

  try {
    const pid = await spawnDaemon(false);
    if (pid > 0) writePid(pid);
    console.log(`\x1b[32m  proxy  Ready\x1b[0m`);
  } catch (err) {
    if (err instanceof Error && err.message === "EACCES") {
      await handlePermissionError();
    } else {
      console.warn(`\x1b[33m  warn   Could not start proxy: ${(err as Error).message}\x1b[0m`);
      console.warn(`\x1b[2m         URL will include port number.\x1b[0m`);
    }
  }
}

async function handlePermissionError(): Promise<void> {
  if (process.platform === "win32") {
    console.warn(`\x1b[33m  warn   Cannot bind port 80. Run as Administrator for clean URLs.\x1b[0m`);
    return;
  }

  const nodeExe = resolveNodeExe();
  console.log(`
\x1b[1m  Proxy needs port 80\x1b[0m

\x1b[2m  Clean URLs like http://my-project.git.studio require\x1b[0m
\x1b[2m  the proxy to listen on port 80. Needs sudo once.\x1b[0m
`);

  if (process.stdin.isTTY) {
    // Interactive terminal — run sudo inline so user sees password prompt
    const nodeExe = resolveNodeExe();
    spawnSync("sudo", [nodeExe, DAEMON_PATH], { stdio: "inherit" });
    // Daemon is now running (sudo started it synchronously in foreground...
    // but we need it detached). Re-spawn detached after confirming port is up.
    await new Promise((r) => setTimeout(r, 500));
    if (await isPortListening(certsExist() ? 443 : 80)) {
      console.log(`\x1b[32m  proxy  Ready\x1b[0m`);
      return;
    }
  }

  // Non-TTY or port still not up — try sudo -n (NOPASSWD)
  try {
    const pid = await spawnDaemon(true);
    if (pid > 0) writePid(pid);
    console.log(`\x1b[32m  proxy  Ready\x1b[0m`);
  } catch {
    console.warn(`\x1b[33m  warn   Could not start proxy automatically.\x1b[0m`);
    console.warn(`\x1b[2m  Start manually (once):\x1b[0m  \x1b[1msudo node ${nodeExe} ${DAEMON_PATH}\x1b[0m`);
    console.warn(`\x1b[2m  Or add to sudoers NOPASSWD for passwordless start.\x1b[0m`);
  }
}

export async function stopProxy(): Promise<void> {
  const pid = readPid();
  if (!pid) return;
  try { process.kill(pid, "SIGTERM"); } catch {}
  clearPid();
}
