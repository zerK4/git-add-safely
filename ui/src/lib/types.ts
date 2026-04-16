export interface FileStatus {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  staged: boolean;
}

export interface ScanResult {
  file: string;
  line: number;
  pattern: string;
  content: string;
}

export interface AppContext {
  stagedFiles: FileStatus[];
  scanResults: ScanResult[];
  config: Record<string, unknown>;
  repoName?: string;
}

export type DiffLineType = "add" | "remove" | "context" | "hunk-header";

export interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLineNo: number | null;
  newLineNo: number | null;
  rawIndex: number;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

export interface ParsedDiff {
  oldPath: string;
  newPath: string;
  hunks: DiffHunk[];
}

export interface SplitRow {
  left: DiffLine | null;
  right: DiffLine | null;
  rawIndex: number;
}
