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

export async function fetchUnstagedDiff(filePath: string): Promise<string> {
  const res = await fetch(`/api/diff-unstaged?file=${encodeURIComponent(filePath)}`);
  if (!res.ok) return "";
  return res.text();
}

export async function stageFile(filePath: string): Promise<void> {
  await fetch("/api/stage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: filePath }),
  });
}

export async function unstageFile(filePath: string): Promise<void> {
  await fetch("/api/unstage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: filePath }),
  });
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

// --- PR info ---

export interface PRAuthor {
  login: string;
  name?: string;
}

export interface PRComment {
  author: PRAuthor;
  body: string;
  createdAt: string;
}

export interface PRReview {
  author: PRAuthor;
  body: string;
  state: string;
  createdAt?: string;
  submittedAt?: string;
}

export interface PRReviewComment {
  id: number;
  inReplyToId: number | null;
  author: string;
  body: string;
  createdAt: string;
  path: string;
  line: number | null;
  diffHunk: string;
  reviewId: number | null;
}

export interface PRInfo {
  number: number;
  title: string;
  body: string;
  state: string;
  url: string;
  author: PRAuthor;
  createdAt: string;
  updatedAt: string;
  baseRefName: string;
  headRefName: string;
  comments: PRComment[];
  reviews: PRReview[];
  reviewRequests: { requestedReviewer: PRAuthor }[];
  reviewComments: PRReviewComment[];
  diff: string;
}

export interface PRInfoResponse {
  ghMissing?: boolean;
  prs?: PRInfo[];
}

export async function fetchPRInfo(): Promise<PRInfoResponse> {
  try {
    const res = await fetch("/api/pr-info");
    if (!res.ok) return { prs: [] };
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return { prs: [] };
    return res.json();
  } catch {
    return { prs: [] };
  }
}

// --- PR review threads ---

export type PRReviewThreads = Record<string, Record<number, PRReviewComment[]>>;

export async function fetchPRFileDiff(pr: number, file: string): Promise<string> {
  try {
    const res = await fetch(`/api/pr-file-diff?pr=${pr}&file=${encodeURIComponent(file)}`);
    if (!res.ok) return "";
    return res.text();
  } catch { return ""; }
}

export async function fetchPRReviewThreads(pr: number): Promise<PRReviewThreads> {
  try {
    const res = await fetch(`/api/pr-review-threads?pr=${pr}`);
    if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) return {};
    return res.json();
  } catch { return {}; }
}

export async function postPRReply(pr: number, commentId: number, body: string): Promise<boolean> {
  try {
    const res = await fetch("/api/pr-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pr, commentId, body }),
    });
    return res.ok;
  } catch { return false; }
}

// --- Stashes ---

export interface StashEntry {
  ref: string;
  message: string;
  date: string;
}

export async function fetchStashes(): Promise<StashEntry[]> {
  try {
    const res = await fetch("/api/stashes");
    if (!res.ok) return [];
    const data = await res.json();
    return data.stashes ?? [];
  } catch { return []; }
}

export async function createStash(message?: string, includeUntracked = false): Promise<{ ok: boolean; output: string }> {
  const res = await fetch("/api/stash", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, includeUntracked }),
  });
  return res.json();
}

export async function applyStash(ref: string): Promise<{ ok: boolean; output: string }> {
  const res = await fetch("/api/stash/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref }),
  });
  return res.json();
}

export async function popStash(ref: string): Promise<{ ok: boolean; output: string }> {
  const res = await fetch("/api/stash/pop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref }),
  });
  return res.json();
}

export async function dropStash(ref: string): Promise<{ ok: boolean; output: string }> {
  const res = await fetch("/api/stash/drop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref }),
  });
  return res.json();
}

export async function fetchStashDiff(ref: string): Promise<string> {
  try {
    const res = await fetch(`/api/stash/diff?ref=${encodeURIComponent(ref)}`);
    if (!res.ok) return "";
    return res.text();
  } catch { return ""; }
}

// --- AI Settings ---

export type AIProviderType = "anthropic" | "google" | "openai" | "openai-compatible";

export interface AIProviderConfig {
  id: string;
  name: string;
  type: AIProviderType;
  apiKey: string;
  baseURL?: string;
  model?: string;
}

export interface FeatureAssignments {
  generateCommit?: string;
  codeReview?: string;
}

export interface UIPreferences {
  diffLineNumbers?: 1 | 2; // 1 = new only, 2 = old + new (default)
}

export interface AppSettings {
  providers: AIProviderConfig[];
  featureAssignments: FeatureAssignments;
  ui?: UIPreferences;
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error(`Failed to fetch settings: ${res.status}`);
  return res.json();
}

export async function postSettings(settings: AppSettings): Promise<{ ok: boolean }> {
  const res = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`Failed to save settings: ${res.status}`);
  return res.json();
}
