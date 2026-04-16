import { spawnSync } from "node:child_process";
import type { FileStatus } from "../types/plugin";

export interface WatchStatus {
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: FileStatus[];
}

function parsePortcelain(output: string): WatchStatus {
  const staged: FileStatus[] = [];
  const unstaged: FileStatus[] = [];
  const untracked: FileStatus[] = [];

  for (const line of output.split("\n").filter(Boolean)) {
    const xy = line.slice(0, 2);
    const path = line.slice(3).trim();

    const X = xy[0]; // staged status
    const Y = xy[1]; // unstaged status

    // Untracked
    if (X === "?" && Y === "?") {
      untracked.push({ path, status: "added", staged: false });
      continue;
    }

    // Staged changes
    if (X !== " " && X !== "?") {
      const status =
        X === "A" ? "added" :
        X === "M" ? "modified" :
        X === "D" ? "deleted" :
        X === "R" ? "renamed" : "modified";
      staged.push({ path, status, staged: true });
    }

    // Unstaged changes
    if (Y !== " " && Y !== "?") {
      const status =
        Y === "M" ? "modified" :
        Y === "D" ? "deleted" : "modified";
      unstaged.push({ path, status, staged: false });
    }
  }

  return { staged, unstaged, untracked };
}

export function getWatchStatus(): WatchStatus {
  const result = spawnSync("git", ["status", "--porcelain"], { encoding: "utf-8" });
  if (result.error || result.status !== 0) return { staged: [], unstaged: [], untracked: [] };
  return parsePortcelain(result.stdout);
}

export class GitWatcher {
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastSnapshot = "";
  private listeners = new Set<(status: WatchStatus) => void>();

  start(intervalMs = 2000) {
    this.poll(); // immediate first poll
    this.interval = setInterval(() => this.poll(), intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  onChange(cb: (status: WatchStatus) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private poll() {
    const result = spawnSync("git", ["status", "--porcelain"], { encoding: "utf-8" });
    const snapshot = result.stdout ?? "";
    if (snapshot === this.lastSnapshot) return;
    this.lastSnapshot = snapshot;
    const status = parsePortcelain(snapshot);
    for (const cb of this.listeners) cb(status);
  }
}
