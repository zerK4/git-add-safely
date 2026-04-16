import { fetchContext, fetchDiff, postApprove, postCancel } from "$lib/api/client";
import { parseDiff, toSplitRows } from "$lib/diff/parser";
import type { AppContext, FileStatus, ParsedDiff, SplitRow } from "$lib/types";

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
