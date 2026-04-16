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

// --- Commit / push ---

export async function postCommit(message: string): Promise<{ ok: boolean; output?: string; error?: string }> {
  const res = await fetch("/api/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return res.json();
}

export async function postPush(): Promise<{ ok: boolean; output?: string; error?: string }> {
  const res = await fetch("/api/push", { method: "POST" });
  return res.json();
}

// --- Diff stats ---

export async function fetchDiffStats(): Promise<Record<string, { added: number; removed: number }>> {
  try {
    const res = await fetch("/api/diff-stats");
    if (!res.ok) return {};
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return {};
    return res.json();
  } catch {
    return {};
  }
}

// --- Inline notes ---

export interface NoteEntry {
  content: string;
  authorName: string;
  authorEmail: string;
  gravatarHash: string;
  createdAt: string;
}

export async function fetchNotes(filePath: string): Promise<Record<string, NoteEntry>> {
  const res = await fetch(`/api/notes?file=${encodeURIComponent(filePath)}`);
  if (!res.ok) return {};
  return res.json();
}

export async function fetchAllNotes(): Promise<Record<string, Record<string, NoteEntry>>> {
  try {
    const res = await fetch("/api/notes/all");
    if (!res.ok) return {};
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return {};
    return res.json();
  } catch {
    return {};
  }
}

export async function saveNoteRemote(filePath: string, lineNo: number, content: string): Promise<void> {
  await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: filePath, lineNo, content }),
  });
}

// --- History ---

export interface Conversation {
  id: number;
  repo: string;
  file: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface HistoryMessage {
  id: number;
  conversation_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export async function fetchConversations(all = false): Promise<Conversation[]> {
  const res = await fetch(`/api/history/conversations${all ? "?all=1" : ""}`);
  if (!res.ok) throw new Error("Failed to fetch conversations");
  return res.json();
}

export async function createConversation(file: string, title: string): Promise<number> {
  const res = await fetch("/api/history/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file, title }),
  });
  const data = await res.json();
  return data.id;
}

export async function deleteConversation(id: number): Promise<void> {
  await fetch(`/api/history/conversations?id=${id}`, { method: "DELETE" });
}

export async function fetchMessages(conversationId: number): Promise<HistoryMessage[]> {
  const res = await fetch(`/api/history/messages?conversation_id=${conversationId}`);
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export async function persistMessage(conversationId: number, role: "user" | "assistant", content: string): Promise<void> {
  await fetch("/api/history/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id: conversationId, role, content }),
  });
}
