// Manages mkcert installation and wildcard cert generation for *.git.studio
// Called once from proxy manager before starting the HTTPS daemon.

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import { spawnSync, execSync } from "node:child_process";

const DATA_DIR = join(homedir(), ".git-add-safely");
export const CERT_DIR = join(DATA_DIR, "certs");
export const CERT_FILE = join(CERT_DIR, "cert.pem");
export const KEY_FILE = join(CERT_DIR, "key.pem");
const DOMAIN = "*.git.studio";

function isMkcertInstalled(): boolean {
  try {
    execSync("mkcert --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function installMkcert(): void {
  const os = platform();
  console.log(`\x1b[2m  cert   Installing mkcert...\x1b[0m`);

  if (os === "darwin") {
    // Try brew first, then port
    const hasBrew = (() => { try { execSync("which brew", { stdio: "ignore" }); return true; } catch { return false; } })();
    if (hasBrew) {
      const r = spawnSync("brew", ["install", "mkcert"], { stdio: "inherit" });
      if (r.status !== 0) throw new Error("brew install mkcert failed");
    } else {
      throw new Error("Homebrew not found. Install mkcert manually: https://github.com/FiloSottile/mkcert");
    }
  } else if (os === "linux") {
    // Try apt, then snap, then direct binary download
    const hasApt = (() => { try { execSync("which apt-get", { stdio: "ignore" }); return true; } catch { return false; } })();
    if (hasApt) {
      spawnSync("sudo", ["apt-get", "install", "-y", "libnss3-tools"], { stdio: "inherit" });
      // apt may not have mkcert — download binary directly
      const r = spawnSync("sudo", ["sh", "-c",
        `curl -Lo /usr/local/bin/mkcert https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v1.4.4-linux-amd64 && chmod +x /usr/local/bin/mkcert`
      ], { stdio: "inherit" });
      if (r.status !== 0) throw new Error("mkcert install failed on Linux");
    } else {
      throw new Error("Could not install mkcert automatically. Install manually: https://github.com/FiloSottile/mkcert");
    }
  } else if (os === "win32") {
    const hasChoco = (() => { try { execSync("choco --version", { stdio: "ignore" }); return true; } catch { return false; } })();
    const hasScoop = (() => { try { execSync("scoop --version", { stdio: "ignore" }); return true; } catch { return false; } })();
    if (hasChoco) {
      const r = spawnSync("choco", ["install", "mkcert", "-y"], { stdio: "inherit" });
      if (r.status !== 0) throw new Error("choco install mkcert failed");
    } else if (hasScoop) {
      const r = spawnSync("scoop", ["install", "mkcert"], { stdio: "inherit" });
      if (r.status !== 0) throw new Error("scoop install mkcert failed");
    } else {
      throw new Error("Could not install mkcert automatically. Install manually: https://github.com/FiloSottile/mkcert");
    }
  } else {
    throw new Error(`Unsupported platform: ${os}`);
  }
}

function installRootCA(): void {
  console.log(`\x1b[2m  cert   Installing local root CA (requires sudo/password)...\x1b[0m`);
  const r = spawnSync("mkcert", ["-install"], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("mkcert -install failed");
}

function generateCert(): void {
  mkdirSync(CERT_DIR, { recursive: true });
  console.log(`\x1b[2m  cert   Generating wildcard cert for ${DOMAIN}...\x1b[0m`);
  const r = spawnSync(
    "mkcert",
    ["-cert-file", CERT_FILE, "-key-file", KEY_FILE, DOMAIN, "localhost", "127.0.0.1"],
    { stdio: "inherit", cwd: CERT_DIR }
  );
  if (r.status !== 0) throw new Error("mkcert cert generation failed");
}

export function certsExist(): boolean {
  return existsSync(CERT_FILE) && existsSync(KEY_FILE);
}

export function ensureCerts(): void {
  if (certsExist()) return;

  console.log(`
\x1b[1m  Setting up HTTPS for *.git.studio\x1b[0m

\x1b[2m  One-time setup: installs a local root CA so your browser\x1b[0m
\x1b[2m  trusts https://project.git.studio without warnings.\x1b[0m
`);

  if (!isMkcertInstalled()) {
    installMkcert();
  }

  installRootCA();
  generateCert();

  console.log(`\x1b[32m  cert   Done — HTTPS ready\x1b[0m\n`);
}
