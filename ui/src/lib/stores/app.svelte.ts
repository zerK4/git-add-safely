import { fetchContext, fetchDiff, fetchUnstagedDiff, stageFile, unstageFile, postApprove, postCancel, createConversation, persistMessage, fetchMessages, fetchNotes, saveNoteRemote, fetchDiffStats, fetchAllNotes, fetchSettings, postSettings } from "$lib/api/client";
import type { NoteEntry, AppSettings, UIPreferences } from "$lib/api/client";
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
let _notes = $state<Record<string, NoteEntry>>({});
let _activeNoteIndex = $state<number | null>(null);

// Claude review state
let _claudeStatus = $state<"idle" | "working" | "done" | "error">("idle");
let _claudePanelOpen = $state(false);
let _chatMessages = $state<ChatMessage[]>([]);
let _chatStreaming = $state(false);
let _reviewedFile = $state<string | null>(null);
let _activeConversationId = $state<number | null>(null);
// Diff stats per file
let _diffStats = $state<Record<string, { added: number; removed: number }>>({});
// Review all view
let _reviewAllOpen = $state(false);
let _reviewAllPinned = $state(false); // true = shown as right panel while DiffView is in center

// Settings
let _settingsOpen = $state(false);
let _settings = $state<AppSettings | null>(null);

// Watch mode
let _watchMode = $state(false);
let _unstagedFiles = $state<import("$lib/types").FileStatus[]>([]);
let _selectedFileStaged = $state(true); // is the selected file staged or unstaged?

// Derived
const _noteCountsByFile = $derived<Record<string, number>>(
  Object.keys(_notes).reduce<Record<string, number>>((map, key) => {
    const file = key.split("::")[0];
    map[file] = (map[file] ?? 0) + 1;
    return map;
  }, {})
);
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
  get diffStats() { return _diffStats; },
  get noteCountsByFile() { return _noteCountsByFile; },
  // Settings
  get settingsOpen() { return _settingsOpen; },
  get settings() { return _settings; },
  get diffLineNumbers(): 1 | 2 { return (_settings?.ui?.diffLineNumbers ?? 2); },
  // Watch mode
  get watchMode() { return _watchMode; },
  get unstagedFiles() { return _unstagedFiles; },
  get selectedFileStaged() { return _selectedFileStaged; },
};

// --- Actions ---
export async function loadContext() {
  _contextLoading = true;
  _contextError = null;
  try {
    _context = await fetchContext();
    _unstagedFiles = _context.unstagedFiles ?? [];
    _watchMode = _context.watchMode ?? false;

    // Load stats and notes in parallel, non-blocking
    Promise.all([fetchDiffStats(), fetchAllNotes()]).then(([stats, allNotes]) => {
      _diffStats = stats;
      for (const [filePath, lineMap] of Object.entries(allNotes)) {
        for (const [lineNo, entry] of Object.entries(lineMap)) {
          _notes[`${filePath}::${lineNo}`] = entry;
        }
      }
    }).catch(() => {});

    // Load settings separately so one failure can't block the other
    fetchSettings().then((s) => { _settings = s; }).catch(() => {});

    // In watch mode, connect SSE for live updates
    if (_watchMode) {
      connectWatchSSE();
    }
  } catch (e) {
    _contextError = (e as Error).message;
  } finally {
    _contextLoading = false;
  }
}

function connectWatchSSE() {
  const es = new EventSource("/api/watch-events");
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === "status") {
        // Update staged files in context
        if (_context) {
          _context = {
            ..._context,
            stagedFiles: data.staged ?? [],
          };
        }
        _unstagedFiles = [...(data.unstaged ?? []), ...(data.untracked ?? [])];
        // Refresh diff stats silently
        fetchDiffStats().then(s => { _diffStats = s; }).catch(() => {});
      }
    } catch {}
  };
  es.onerror = () => {
    // Reconnect after 3s on error
    setTimeout(connectWatchSSE, 3000);
    es.close();
  };
}


export async function selectFile(path: string, staged = true) {
  if (_selectedFile === path && _selectedFileStaged === staged) return;
  _selectedFile = path;
  _selectedFileStaged = staged;
  _rawDiff = null;
  _activeNoteIndex = null;
  _diffLoading = true;
  if (_reviewAllOpen && !_reviewAllPinned) {
    _reviewAllPinned = true;
  }
  try {
    const diffFn = staged ? fetchDiff : fetchUnstagedDiff;
    const [diff, remoteNotes] = await Promise.all([diffFn(path), fetchNotes(path)]);
    _rawDiff = diff;
    for (const [lineNo, entry] of Object.entries(remoteNotes)) {
      _notes[`${path}::${lineNo}`] = entry;
    }
  } catch {
    _rawDiff = null;
  } finally {
    _diffLoading = false;
  }
}

export function setDiffMode(mode: "unified" | "split") {
  _diffMode = mode;
}

export function openNoteEditor(lineNo: number) {
  _activeNoteIndex = _activeNoteIndex === lineNo ? null : lineNo;
}

export function closeNoteEditor() {
  _activeNoteIndex = null;
}

export async function saveNote(rawIndex: number, text: string) {
  if (!_selectedFile) return;
  const file = _selectedFile;
  const key = `${file}::${rawIndex}`;
  _activeNoteIndex = null;
  await saveNoteRemote(file, rawIndex, text);
  // fetch fresh from server to get author info
  const updated = await fetchNotes(file);
  // rebuild entire _notes for this file
  const next: Record<string, NoteEntry> = {};
  // keep notes from other files
  for (const [k, v] of Object.entries(_notes)) {
    if (!k.startsWith(`${file}::`)) next[k] = v;
  }
  // add updated notes for this file
  for (const [lineNo, entry] of Object.entries(updated)) {
    next[`${file}::${lineNo}`] = entry;
  }
  _notes = next;
}

export async function deleteNote(rawIndex: number) {
  if (!_selectedFile) return;
  const key = `${_selectedFile}::${rawIndex}`;
  delete _notes[key];
  _activeNoteIndex = null;
  await saveNoteRemote(_selectedFile, rawIndex, "");
}

export function getNote(filePath: string, rawIndex: number): NoteEntry | undefined {
  return _notes[`${filePath}::${rawIndex}`];
}

export async function stageFileAction(path: string) {
  // Optimistic: move file from unstaged → staged instantly
  const file = _unstagedFiles.find(f => f.path === path);
  if (file && _context) {
    _unstagedFiles = _unstagedFiles.filter(f => f.path !== path);
    _context = { ..._context, stagedFiles: [..._context.stagedFiles, { ...file, staged: true }] };
  }
  await stageFile(path);
}

export async function unstageFileAction(path: string) {
  // Optimistic: move file from staged → unstaged instantly
  const file = _context?.stagedFiles.find(f => f.path === path);
  if (file && _context) {
    _context = { ..._context, stagedFiles: _context.stagedFiles.filter(f => f.path !== path) };
    _unstagedFiles = [..._unstagedFiles, { ...file, staged: false }];
    // If this was the selected file, clear diff view
    if (_selectedFile === path) {
      _selectedFile = null;
      _rawDiff = null;
    }
  }
  await unstageFile(path);
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

// --- Settings actions ---

export function openSettings() {
  _settingsOpen = true;
}

export function closeSettings() {
  _settingsOpen = false;
}

export async function loadSettingsFromServer() {
  try {
    _settings = await fetchSettings();
  } catch {
    _settings = { providers: [], featureAssignments: {} };
  }
}

export async function saveSettingsToServer(settings: AppSettings) {
  await postSettings(settings);
  _settings = { ...settings };
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
