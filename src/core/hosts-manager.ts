import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const HOSTS_FILE = "/etc/hosts";
const HOSTS_IP = "127.0.0.1";

export function buildHostname(projectName: string): string {
  // sanitize: lowercase, replace non-alphanumeric with dash
  const safe = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${safe}.git.studio`;
}

export function isHostsEntryPresent(hostname: string): boolean {
  try {
    const contents = readFileSync(HOSTS_FILE, "utf-8");
    return contents.split("\n").some((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("#")) return false;
      const parts = trimmed.split(/\s+/);
      return parts[0] === HOSTS_IP && parts.includes(hostname);
    });
  } catch {
    return false;
  }
}

export function ensureHostsEntry(hostname: string): void {
  if (isHostsEntryPresent(hostname)) return;

  console.log(`
\x1b[1m  Setting up local domain\x1b[0m

\x1b[2m  url \x1b[0m  http://${hostname}
\x1b[2m  file\x1b[0m  /etc/hosts

  One-time setup. We need sudo to add a single line.
  It stays permanently, no re-prompts next time.
`);

  const entry = `${HOSTS_IP} ${hostname} # git-add-safely`;
  const result = spawnSync(
    "sudo",
    ["sh", "-c", `echo '${entry}' >> ${HOSTS_FILE}`],
    { stdio: "inherit" }
  );

  if (result.status !== 0) {
    console.warn(`\n  \x1b[33mwarn   Could not write to /etc/hosts. Falling back to http://localhost.\x1b[0m\n`);
  } else {
    console.log(`\n  \x1b[32mdone   http://${hostname} is ready.\x1b[0m\n`);
  }
}
