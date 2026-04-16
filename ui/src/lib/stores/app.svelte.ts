import { fetchContext, fetchDiff, postApprove, postCancel, createConversation, persistMessage, fetchMessages } from "$lib/api/client";
import { parseDiff, toSplitRows } from "$lib/diff/parser";
import type { AppContext, FileStatus, ParsedDiff, SplitRow, ChatMessage } from "$lib/types";

// All reactive state — module-level $state
let _context = $state<AppContext | null>(null);
let _contextLoading = $state(true);
let _contextError = $state<string | null>(null);
let _selectedFile = $state<string | null>(null);
let _rawDiff = $state<string | null>(null);
let _diffLoading = $state(false);
let _diffMode = $state<"unified" | "split">("unified");
let _notes = $state<Record<string, string>>({});
let _activeNoteIndex = $state<number | null>(null);

// Claude review state
let _claudeStatus = $state<"idle" | "working" | "done" | "error">("idle");
let _claudePanelOpen = $state(false);
let _chatMessages = $state<ChatMessage[]>([]);
let _chatStreaming = $state(false);
let _reviewedFile = $state<string | null>(null);
let _activeConversationId = $state<number | null>(null);
// Review all view
let _reviewAllOpen = $state(false);
let _reviewAllPinned = $state(false); // true = shown as right panel while DiffView is in center

// Derived
const _parsedDiff = $derived<ParsedDiff | null>(_rawDiff ? parseDiff(_rawDiff) : null);
const _splitRows = $derived<SplitRow[][] | null>(_parsedDiff ? toSplitRows(_parsedDiff.hunks) : null);
const _warningCount = $derived(_context?.scanResults.length ?? 0);
const _groupedFiles = $derived<Record<string, FileStatus[]>>(
  (_context?.stagedFiles ?? []).reduce<Record<string, FileStatus[]>>((map, f) => {
    const parts = f.path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
    if (!map[dir]) map[dir] = [];
    map[dir].push(f);
    return map;
  }, {})
);

// --- Exported reactive getters (read-only) ---
export const store = {
  get context() { return _context; },
  get contextLoading() { return _contextLoading; },
  get contextError() { return _contextError; },
  get selectedFile() { return _selectedFile; },
  get diffLoading() { return _diffLoading; },
  get diffMode() { return _diffMode; },
  get activeNoteIndex() { return _activeNoteIndex; },
  get parsedDiff() { return _parsedDiff; },
  get splitRows() { return _splitRows; },
  get warningCount() { return _warningCount; },
  get groupedFiles() { return _groupedFiles; },
  get rawDiff() { return _rawDiff; },
  // Claude
  get claudeStatus() { return _claudeStatus; },
  get claudePanelOpen() { return _claudePanelOpen; },
  get chatMessages() { return _chatMessages; },
  get chatStreaming() { return _chatStreaming; },
  get reviewedFile() { return _reviewedFile; },
  get activeConversationId() { return _activeConversationId; },
  get reviewAllOpen() { return _reviewAllOpen; },
  get reviewAllPinned() { return _reviewAllPinned; },
};

// --- Actions ---
export async function loadContext() {
  _contextLoading = true;
  _contextError = null;
  try {
    _context = await fetchContext();
  } catch (e) {
    _contextError = (e as Error).message;
  } finally {
    _contextLoading = false;
  }
}

export async function selectFile(path: string) {
  if (_selectedFile === path) return;
  _selectedFile = path;
  _rawDiff = null;
  _activeNoteIndex = null;
  _diffLoading = true;
  // If review all is open in main panel, pin it to the right so DiffView can take center
  if (_reviewAllOpen && !_reviewAllPinned) {
    _reviewAllPinned = true;
  }
  try {
    _rawDiff = await fetchDiff(path);
  } catch {
    _rawDiff = null;
  } finally {
    _diffLoading = false;
  }
}

export function setDiffMode(mode: "unified" | "split") {
  _diffMode = mode;
}

export function openNoteEditor(rawIndex: number) {
  _activeNoteIndex = _activeNoteIndex === rawIndex ? null : rawIndex;
}

export function closeNoteEditor() {
  _activeNoteIndex = null;
}

export function saveNote(rawIndex: number, text: string) {
  if (!_selectedFile) return;
  const key = `${_selectedFile}::${rawIndex}`;
  if (text.trim()) {
    _notes[key] = text;
  } else {
    delete _notes[key];
  }
  _activeNoteIndex = null;
}

export function getNote(filePath: string, rawIndex: number): string | undefined {
  return _notes[`${filePath}::${rawIndex}`];
}

export async function approve() {
  await postApprove();
}

export async function cancel() {
  await postCancel();
}

// --- Claude review actions ---

export function openReviewAll() {
  _reviewAllOpen = true;
  _reviewAllPinned = false;
  _selectedFile = null;
}

export function closeReviewAll() {
  _reviewAllOpen = false;
  _reviewAllPinned = false;
}

export function pinReviewAll() {
  _reviewAllPinned = true;
}

export function unpinReviewAll() {
  _reviewAllPinned = false;
  _selectedFile = null; // go back to main panel, deselect file
}

export function openClaudePanel() {
  _claudePanelOpen = true;
}

export function closeClaudePanel() {
  _claudePanelOpen = false;
}

export function toggleClaudePanel() {
  _claudePanelOpen = !_claudePanelOpen;
}

export async function startReview(file: string, diff: string, warnings: import("$lib/types").ScanResult[]) {
  _claudeStatus = "working";
  _reviewedFile = file;
  _claudePanelOpen = true;
  _chatStreaming = true;

  const warningsSummary = warnings.length > 0
    ? `\n\nWarnings detected:\n${warnings.map(w => `- Line ${w.line}: ${w.pattern} — \`${w.content}\``).join("\n")}`
    : "";

  // Create conversation in DB
  const title = `Review: ${file.split("/").pop()}`;
  const convId = await createConversation(file, title);
  _activeConversationId = convId;

  _chatMessages = [
    {
      role: "assistant",
      content: "",
      streaming: true,
    },
  ];

  try {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, diff, warnings, warningsSummary }),
    });

    if (!res.ok || !res.body) throw new Error("Review request failed");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "text" && parsed.text) {
            _chatMessages[0] = {
              ..._chatMessages[0],
              content: _chatMessages[0].content + parsed.text,
            };
          } else if (parsed.type === "error") {
            throw new Error(parsed.error);
          }
        } catch {
          // non-JSON line, skip
        }
      }
    }

    _chatMessages[0] = { ..._chatMessages[0], streaming: false };
    _claudeStatus = "done";
    // Persist to DB
    if (_activeConversationId && _chatMessages[0].content) {
      await persistMessage(_activeConversationId, "assistant", _chatMessages[0].content);
    }
  } catch (e) {
    _chatMessages[0] = {
      role: "assistant",
      content: `Error: ${(e as Error).message}`,
      streaming: false,
    };
    _claudeStatus = "error";
  } finally {
    _chatStreaming = false;
  }
}

export async function sendChatMessage(text: string) {
  if (_chatStreaming) return;

  // Persist user message
  if (_activeConversationId) {
    await persistMessage(_activeConversationId, "user", text);
  }

  _chatMessages = [
    ..._chatMessages,
    { role: "user", content: text },
    { role: "assistant", content: "", streaming: true },
  ];
  _chatStreaming = true;

  const assistantIdx = _chatMessages.length - 1;

  try {
    const res = await fetch("/api/review-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: _reviewedFile,
        messages: _chatMessages.slice(0, assistantIdx).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!res.ok || !res.body) throw new Error("Message request failed");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "text" && parsed.text) {
            const msgs = [..._chatMessages];
            msgs[assistantIdx] = {
              ...msgs[assistantIdx],
              content: msgs[assistantIdx].content + parsed.text,
            };
            _chatMessages = msgs;
          }
        } catch {
          // skip
        }
      }
    }

    const msgs = [..._chatMessages];
    msgs[assistantIdx] = { ...msgs[assistantIdx], streaming: false };
    _chatMessages = msgs;
    // Persist assistant reply
    if (_activeConversationId && msgs[assistantIdx].content) {
      await persistMessage(_activeConversationId, "assistant", msgs[assistantIdx].content);
    }
  } catch (e) {
    const msgs = [..._chatMessages];
    msgs[assistantIdx] = {
      role: "assistant",
      content: `Error: ${(e as Error).message}`,
      streaming: false,
    };
    _chatMessages = msgs;
  } finally {
    _chatStreaming = false;
  }
}

export async function loadConversation(id: number, file: string, title: string) {
  const messages = await fetchMessages(id);
  _activeConversationId = id;
  _reviewedFile = file;
  _claudeStatus = "done";
  _chatStreaming = false;
  _chatMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  if (title.startsWith("Review all:")) {
    // Open in ReviewAllView central panel
    _reviewAllOpen = true;
    _claudePanelOpen = false;
  } else {
    // Open in right ClaudePanel
    _claudePanelOpen = true;
    _reviewAllOpen = false;
    _selectedFile = null;
  }
}

export async function saveReviewToFile() {
  const review = _chatMessages.find((m) => m.role === "assistant")?.content;
  if (!review || !_reviewedFile) return;
  await fetch("/api/review-save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: _reviewedFile, content: review }),
  });
}
