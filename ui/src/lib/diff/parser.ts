import type { DiffLine, DiffHunk, ParsedDiff, SplitRow } from "$lib/types";

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseDiff(raw: string): ParsedDiff {
  const lines = raw.split("\n");
  let oldPath = "";
  let newPath = "";
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLineNo = 0;
  let newLineNo = 0;
  let rawIndex = 0;

  for (const line of lines) {
    if (line.startsWith("--- a/")) {
      oldPath = line.slice(6);
      continue;
    }
    if (line.startsWith("+++ b/")) {
      newPath = line.slice(6);
      continue;
    }
    if (line.startsWith("--- /dev/null")) {
      oldPath = "/dev/null";
      continue;
    }
    if (line.startsWith("+++ /dev/null")) {
      newPath = "/dev/null";
      continue;
    }
    if (line.startsWith("diff --git") || line.startsWith("index ") || line.startsWith("new file") || line.startsWith("deleted file")) {
      continue;
    }

    const hunkMatch = HUNK_HEADER_RE.exec(line);
    if (hunkMatch) {
      currentHunk = {
        header: line,
        oldStart: parseInt(hunkMatch[1], 10),
        newStart: parseInt(hunkMatch[2], 10),
        lines: [],
      };
      oldLineNo = currentHunk.oldStart;
      newLineNo = currentHunk.newStart;
      hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith("+")) {
      currentHunk.lines.push({ type: "add", content: line.slice(1), oldLineNo: null, newLineNo: newLineNo++, rawIndex: rawIndex++ });
    } else if (line.startsWith("-")) {
      currentHunk.lines.push({ type: "remove", content: line.slice(1), oldLineNo: oldLineNo++, newLineNo: null, rawIndex: rawIndex++ });
    } else if (line.startsWith(" ")) {
      currentHunk.lines.push({ type: "context", content: line.slice(1), oldLineNo: oldLineNo++, newLineNo: newLineNo++, rawIndex: rawIndex++ });
    }
    // skip "\ No newline at end of file" etc.
  }

  return { oldPath, newPath, hunks };
}

export function toSplitRows(hunks: DiffHunk[]): SplitRow[][] {
  return hunks.map((hunk) => {
    const rows: SplitRow[] = [];
    const lines = hunk.lines;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.type === "context") {
        rows.push({ left: line, right: line, rawIndex: line.rawIndex });
        i++;
        continue;
      }

      // Collect a run of removes followed by adds — pair them side-by-side
      if (line.type === "remove") {
        const removes: DiffLine[] = [];
        const adds: DiffLine[] = [];

        while (i < lines.length && lines[i].type === "remove") {
          removes.push(lines[i++]);
        }
        while (i < lines.length && lines[i].type === "add") {
          adds.push(lines[i++]);
        }

        const maxLen = Math.max(removes.length, adds.length);
        for (let j = 0; j < maxLen; j++) {
          const left = removes[j] ?? null;
          const right = adds[j] ?? null;
          rows.push({ left, right, rawIndex: (left ?? right)!.rawIndex });
        }
        continue;
      }

      if (line.type === "add") {
        rows.push({ left: null, right: line, rawIndex: line.rawIndex });
        i++;
        continue;
      }

      i++;
    }

    return rows;
  });
}
