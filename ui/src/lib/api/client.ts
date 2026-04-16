import type { AppContext } from "$lib/types";

export async function fetchContext(): Promise<AppContext> {
  const res = await fetch("/api/context");
  if (!res.ok) throw new Error(`Failed to fetch context: ${res.status}`);
  return res.json();
}

export async function fetchDiff(filePath: string): Promise<string> {
  const res = await fetch(`/api/diff?file=${encodeURIComponent(filePath)}`);
  if (!res.ok) throw new Error(`Failed to fetch diff: ${res.status}`);
  return res.text();
}

export interface FileLinesResult {
  file: string;
  targetLine: number;
  lines: { lineNo: number; content: string; isTarget: boolean }[];
}

export async function fetchFileLines(filePath: string, line: number): Promise<FileLinesResult> {
  const res = await fetch(`/api/file-lines?file=${encodeURIComponent(filePath)}&line=${line}`);
  if (!res.ok) throw new Error(`Failed to fetch file lines: ${res.status}`);
  return res.json();
}

export async function postApprove(): Promise<void> {
  await fetch("/api/approve", { method: "POST" });
}

export async function postCancel(): Promise<void> {
  await fetch("/api/cancel", { method: "POST" });
}
