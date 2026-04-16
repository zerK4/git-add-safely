import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

function getDb(repoRoot: string): Database {
  const dir = join(repoRoot, ".git-notes");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const db = new Database(join(dir, "notes.db"));
  db.run("PRAGMA journal_mode = WAL");
  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      file    TEXT    NOT NULL,
      line_no INTEGER NOT NULL,
      content TEXT    NOT NULL,
      PRIMARY KEY (file, line_no)
    )
  `);
  return db;
}

export function getNote(repoRoot: string, file: string, lineNo: number): string | null {
  const db = getDb(repoRoot);
  const row = db.query<{ content: string }, [string, number]>(
    "SELECT content FROM notes WHERE file = ? AND line_no = ?"
  ).get(file, lineNo);
  return row?.content ?? null;
}

export function setNote(repoRoot: string, file: string, lineNo: number, content: string): void {
  const db = getDb(repoRoot);
  if (content.trim()) {
    db.run(
      "INSERT INTO notes (file, line_no, content) VALUES (?, ?, ?) ON CONFLICT(file, line_no) DO UPDATE SET content = excluded.content",
      [file, lineNo, content]
    );
  } else {
    db.run("DELETE FROM notes WHERE file = ? AND line_no = ?", [file, lineNo]);
  }
}

export function getNotesForFile(repoRoot: string, file: string): Record<string, string> {
  const db = getDb(repoRoot);
  const rows = db.query<{ line_no: number; content: string }, [string]>(
    "SELECT line_no, content FROM notes WHERE file = ?"
  ).all(file);
  return Object.fromEntries(rows.map((r) => [String(r.line_no), r.content]));
}

export function getAllNotes(repoRoot: string): Record<string, Record<string, string>> {
  const db = getDb(repoRoot);
  const rows = db.query<{ file: string; line_no: number; content: string }, []>(
    "SELECT file, line_no, content FROM notes ORDER BY file, line_no"
  ).all();
  const result: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    if (!result[row.file]) result[row.file] = {};
    result[row.file][String(row.line_no)] = row.content;
  }
  return result;
}
